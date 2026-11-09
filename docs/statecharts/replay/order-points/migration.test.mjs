// Runs the real migrations (00001 onward, including 00032's locked points functions) in PGlite,
// Postgres compiled to WebAssembly, and checks each function against the rules in the model.
// PGlite is one connection, so this checks what each call does, not two calls racing; the
// row locks are what the TLA+ model and the replays cover.
//
// Needs PGlite, which the app doesn't depend on. From the repo root:
//   npm install --no-save @electric-sql/pglite@0.2.17
// then from docs/statecharts/replay/order-points/:
//   node --test migration.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

let PGlite
try {
  ;({ PGlite } = await import('@electric-sql/pglite'))
} catch {
  test('migration functions (skipped: run npm install --no-save @electric-sql/pglite@0.2.17)', { skip: true }, () => {})
}

const migrations = path.resolve(import.meta.dirname, '../../../../supabase/migrations')

// What Supabase provides that the migrations reference.
const SUPABASE_STUBS = `
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text,
    raw_user_meta_data jsonb DEFAULT '{}'::jsonb, created_at timestamptz DEFAULT now());
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
  CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'service_role'::text $$;
  CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT '{}'::jsonb $$;
  CREATE SCHEMA storage;
  CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean,
    file_size_limit bigint, allowed_mime_types text[]);
  CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text, name text, owner uuid);
`

if (PGlite) {
  const db = new PGlite()
  await db.exec(SUPABASE_STUBS)
  for (const file of fs.readdirSync(migrations).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(fs.readFileSync(path.join(migrations, file), 'utf8'))
  }

  const one = async (sql, params) => (await db.query(sql, params)).rows[0]
  const all = async (sql, params) => (await db.query(sql, params)).rows
  let n = 0
  async function member(balance = 0) {
    n += 1
    return (await one(
      `INSERT INTO loyalty_members (email, visitor_id, points_balance) VALUES ($1, gen_random_uuid(), $2) RETURNING id, email`,
      [`fan${n}@example.com`, balance]
    ))
  }
  const balance = async (id) => (await one('SELECT points_balance FROM loyalty_members WHERE id = $1', [id])).points_balance
  const history = async (id) =>
    Number((await one('SELECT COALESCE(SUM(points), 0) AS s FROM loyalty_transactions WHERE member_id = $1', [id])).s)
  const order = (saleId, email, points) => ({
    accelpay_sale_id: saleId, email, status: 'complete', subtotal_cents: points, total_cents: points,
    tax_cents: 0, delivery_cents: 0, discount_cents: 0, pack_count: 2, points_awarded: points,
    items: [{ quantity: 2, title: 'Cheetah 4-pack' }], raw_payload: { id: saleId },
  })
  const credit = (o, memberId) =>
    one('SELECT * FROM loyalty_credit_online_order($1::jsonb, $2)', [JSON.stringify(o), memberId])
  const staff = await one(`INSERT INTO staff (email, full_name, role) VALUES ('ops@example.com', 'Ops', 'admin') RETURNING id`)

  test('an order is saved and credited in one call; a second delivery is a duplicate', async () => {
    const m = await member(100)
    assert.deepEqual({ ...(await credit(order(5001, m.email, 4000), m.id)), order_id: 'x' }, { result: 'credited', order_id: 'x', points: 4000 })
    assert.equal((await credit(order(5001, m.email, 4000), m.id)).result, 'duplicate')
    assert.equal(await balance(m.id), 4100)
    assert.equal(await history(m.id), 4000)
    const saved = await one('SELECT member_id, points_claimed FROM loyalty_orders WHERE accelpay_sale_id = 5001')
    assert.deepEqual(saved, { member_id: m.id, points_claimed: true })
  })

  test('if crediting fails, the order is not saved either (all or nothing)', async () => {
    const m = await member()
    await db.exec(`
      CREATE FUNCTION fail_ledger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'server stopped'; END $$;
      CREATE TRIGGER fail_ledger BEFORE INSERT ON loyalty_transactions FOR EACH ROW EXECUTE FUNCTION fail_ledger();`)
    await assert.rejects(credit(order(5002, m.email, 4000), m.id), /server stopped/)
    await db.exec('DROP TRIGGER fail_ledger ON loyalty_transactions; DROP FUNCTION fail_ledger();')
    assert.equal((await all('SELECT 1 FROM loyalty_orders WHERE accelpay_sale_id = 5002')).length, 0)
    // So the retry (fulfillment webhook or hourly reconcile) saves and credits it.
    assert.equal((await credit(order(5002, m.email, 4000), m.id)).result, 'credited')
    assert.equal(await balance(m.id), 4000)
  })

  test('a retry finishes an order the old code saved without points', async () => {
    const m = await member()
    await db.query(
      `INSERT INTO loyalty_orders (accelpay_sale_id, member_id, email, points_awarded, points_claimed) VALUES (5003, $1, $2, 4000, false)`,
      [m.id, m.email]
    )
    assert.equal((await credit(order(5003, m.email, 4000), m.id)).result, 'credited')
    assert.equal((await credit(order(5003, m.email, 4000), m.id)).result, 'duplicate')
    assert.equal(await balance(m.id), 4000)
    assert.equal(await history(m.id), 4000)
  })

  test('a retry never credits twice an order whose ledger row the old code already wrote', async () => {
    const m = await member()
    const o = await one(
      `INSERT INTO loyalty_orders (accelpay_sale_id, member_id, email, points_awarded, points_claimed) VALUES (5004, $1, $2, 4000, false) RETURNING id`,
      [m.id, m.email]
    )
    await db.query(`INSERT INTO loyalty_transactions (member_id, points, type, order_id) VALUES ($1, 4000, 'online_order', $2)`, [m.id, o.id])
    assert.equal((await credit(order(5004, m.email, 4000), m.id)).result, 'duplicate')
    assert.equal(await history(m.id), 4000)
    assert.equal((await one('SELECT points_claimed FROM loyalty_orders WHERE id = $1', [o.id])).points_claimed, true)
  })

  test('orders banked before signup, and own unclaimed orders, are claimed once', async () => {
    const m = await member()
    assert.equal((await credit(order(5005, m.email, 1500), null)).result, 'pending')
    await db.query(
      `INSERT INTO loyalty_orders (accelpay_sale_id, member_id, email, points_awarded, points_claimed) VALUES (5006, $1, $2, 500, false)`,
      [m.id, m.email.toUpperCase()]
    )
    assert.equal((await one('SELECT loyalty_claim_pending_orders($1, $2) AS p', [m.id, m.email])).p, 2000)
    assert.equal((await one('SELECT loyalty_claim_pending_orders($1, $2) AS p', [m.id, m.email])).p, 0)
    assert.equal(await balance(m.id), 2000)
    assert.equal(await history(m.id), 2000)
  })

  test("claiming matches the email exactly: an underscore is not a wildcard", async () => {
    const m = await member()
    await db.query(`UPDATE loyalty_members SET email = 'a_b@example.com' WHERE id = $1`, [m.id])
    await credit(order(5007, 'axb@example.com', 900), null)
    assert.equal((await one('SELECT loyalty_claim_pending_orders($1, $2) AS p', [m.id, 'a_b@example.com'])).p, 0)
  })

  test('a redemption debits and records together, and never goes below zero', async () => {
    const m = await member()
    await db.query(`SELECT loyalty_apply_points($1, 12000, 'adjustment', 'start')`, [m.id])
    const r = await one(`SELECT * FROM loyalty_redeem_reward($1, 'tee', 'Untamed tee', 10000, 2500, 'TX')`, [m.id])
    assert.equal(r.new_balance, 2000)
    assert.equal(r.redemption.status, 'pending')
    assert.equal(r.redemption.ship_state, 'TX')
    assert.ok(r.redemption.redeem_transaction_id)
    await assert.rejects(
      db.query(`SELECT * FROM loyalty_redeem_reward($1, 'tee', 'Untamed tee', 10000)`, [m.id]),
      (err) => err.code === '23514'
    )
    assert.equal((await all('SELECT 1 FROM loyalty_redemptions WHERE member_id = $1', [m.id])).length, 1)
    assert.equal(await balance(m.id), 2000)
    assert.equal(await history(m.id), 2000)
  })

  test('a cancelled redemption is refunded once, and a fulfilled one not at all', async () => {
    const m = await member()
    await db.query(`SELECT loyalty_apply_points($1, 20000, 'adjustment', 'start')`, [m.id])
    const a = (await one(`SELECT * FROM loyalty_redeem_reward($1, 'tee', 'Untamed tee', 10000)`, [m.id])).redemption
    const b = (await one(`SELECT * FROM loyalty_redeem_reward($1, 'hat', 'Untamed hat', 5000)`, [m.id])).redemption
    const cancel = (id) => one('SELECT * FROM loyalty_cancel_redemption($1, $2, $3)', [id, staff.id, 'out of stock'])
    assert.deepEqual(await cancel(a.id), { result: 'cancelled', refunded_points: 10000, new_balance: 15000 })
    assert.deepEqual(await cancel(a.id), { result: 'cancelled', refunded_points: 0, new_balance: null })
    await db.query(`UPDATE loyalty_redemptions SET status = 'fulfilled' WHERE id = $1`, [b.id])
    assert.equal((await cancel(b.id)).result, 'fulfilled')
    assert.equal(await balance(m.id), 15000)
    assert.equal(await history(m.id), 15000)
    const saved = await one('SELECT status, refund_transaction_id, admin_notes FROM loyalty_redemptions WHERE id = $1', [a.id])
    assert.equal(saved.status, 'cancelled')
    assert.ok(saved.refund_transaction_id)
    assert.equal(saved.admin_notes, 'out of stock')
  })

  test('the signup bonus is granted at most once', async () => {
    const m = await member()
    const grant = () => one(`SELECT loyalty_grant_signup_bonus($1, 1000, 'Welcome') AS g`, [m.id])
    assert.equal((await grant()).g, true)
    assert.equal((await grant()).g, false)
    assert.equal(await balance(m.id), 1000)
    assert.equal(await history(m.id), 1000)
  })

  test('a receipt is reviewed once', async () => {
    const m = await member()
    const receipt = await one(`INSERT INTO loyalty_receipts (member_id, image_url) VALUES ($1, 'r.jpg') RETURNING id`, [m.id])
    const review = (approve, points) =>
      one('SELECT * FROM loyalty_review_receipt($1, $2, $3, NULL, $4)', [receipt.id, approve, points, staff.id])
    assert.deepEqual(await review(true, 2400), { result: 'approved', awarded: 2400 })
    assert.deepEqual(await review(true, 2400), { result: 'already_reviewed', awarded: 0 })
    assert.deepEqual(await review(false, 0), { result: 'already_reviewed', awarded: 0 })
    assert.equal(await balance(m.id), 2400)
    assert.equal(await history(m.id), 2400)
  })

  test('UGC is credited only if nobody reviewed it in between', async () => {
    const m = await member()
    const user = await one(`INSERT INTO auth.users (email) VALUES ($1) RETURNING id`, [m.email])
    const s = await one(
      `INSERT INTO ugc_submissions (auth_user_id, contributor_type, loyalty_member_id) VALUES ($1, 'loyalty', $2) RETURNING id`,
      [user.id, m.id]
    )
    const review = (status, points, expected) =>
      one('SELECT * FROM loyalty_review_ugc($1, $2, $3, $4, $5, $6)', [s.id, status, points, expected, 'UGC', staff.id])
    assert.deepEqual(await review('approved', 2500, 0), { result: 'approved', awarded: 2500 })
    // A second reviewer who loaded the page before the first approval.
    assert.deepEqual(await review('approved', 2500, 0), { result: 'changed', awarded: 0 })
    // Featuring it afterwards credits the difference.
    assert.deepEqual(await review('featured', 5000, 2500), { result: 'featured', awarded: 5000 })
    assert.equal((await one('SELECT points_awarded FROM ugc_submissions WHERE id = $1', [s.id])).points_awarded, 7500)
    assert.equal(await balance(m.id), 7500)
    assert.equal(await history(m.id), 7500)
  })

  test('only the service role can call the new functions', async () => {
    const fns = [
      'loyalty_award_order(uuid,uuid)',
      'loyalty_credit_online_order(jsonb,uuid)',
      'loyalty_claim_pending_orders(uuid,text)',
      'loyalty_redeem_reward(uuid,text,text,integer,integer,text)',
      'loyalty_cancel_redemption(uuid,uuid,text)',
      'loyalty_grant_signup_bonus(uuid,integer,text)',
      'loyalty_review_receipt(uuid,boolean,integer,text,uuid)',
      'loyalty_review_ugc(uuid,ugc_status,integer,integer,text,uuid)',
    ]
    for (const fn of fns) {
      const row = await one(
        `SELECT has_function_privilege('service_role', $1, 'execute') AS svc,
                has_function_privilege('anon', $1, 'execute') AS anon,
                has_function_privilege('authenticated', $1, 'execute') AS authed`,
        [fn]
      )
      assert.deepEqual(row, { svc: true, anon: false, authed: false }, fn)
    }
  })

  test('every member the tests touched has a balance equal to their history', async () => {
    const off = await all(`
      SELECT m.email, m.points_balance, COALESCE(SUM(t.points), 0)::int AS history
      FROM loyalty_members m LEFT JOIN loyalty_transactions t ON t.member_id = m.id
      GROUP BY m.id HAVING m.points_balance <> COALESCE(SUM(t.points), 0)`)
    // fan1 started at 100 with no history row. fan4's ledger row was written by hand to play the
    // old code stopping before the balance update; the new functions don't credit it twice, and
    // they don't repair an old mismatch either (that takes a one-off audit, not a migration).
    assert.deepEqual(off.map((r) => r.email).sort(), ['fan1@example.com', 'fan4@example.com'])
  })
}
