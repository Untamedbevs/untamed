// Replays the OrderPoints statechart's two bug paths against Untamed's real creditOnlineOrder,
// claimPendingOrdersForMember and redeemReward, now that crediting and redeeming each run as one
// locked database call (migration 00032). The fake database runs those calls through the stand-ins
// in points-functions.mjs; migration.test.mjs checks the real SQL.
// Run with: node --import ./register.mjs --test order-points.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { createFakeDb } from '../fake-supabase.mjs'
import { installPointsFunctions } from './points-functions.mjs'

const { creditOnlineOrder, claimPendingOrdersForMember } = await import('@/lib/loyalty/orders')
const { redeemReward } = await import('@/lib/rewards/ledger')

const MEMBER = 'member-1'
const EMAIL = 'fan@example.com'
function setup(history) {
  const db = createFakeDb({
    tables: {
      loyalty_members: [{ id: MEMBER, email: EMAIL, points_balance: history }],
      loyalty_transactions: history ? [{ id: 't0', member_id: MEMBER, points: history, type: 'online_order' }] : [],
      loyalty_redemptions: [],
      loyalty_order_attributions: [],
      loyalty_orders: [],
    },
    unique: { loyalty_orders: [['accelpay_sale_id']] },
  })
  return installPointsFunctions(db)
}
// A $40.00 sale earns 4,000 points (pointsForSubtotalCents).
const sale = { saleId: 1001, email: EMAIL, name: 'Pat Fan', subtotalCents: 4000, totalCents: 4400, taxCents: 400, deliveryCents: 0, discountCents: 0, packCount: 2, items: [], status: 'paid', raw: null }
const balance = (db) => db.tables.loyalty_members[0].points_balance
const history = (db) => db.tables.loyalty_transactions.reduce((sum, t) => sum + t.points, 0)
const orderCredits = (db) => db.tables.loyalty_transactions.filter((t) => t.type === 'online_order' && t.order_id).length
const redeemTee = (db) => redeemReward(db, { memberId: MEMBER, rewardSlug: 'tee', rewardLabel: 'Untamed tee', pointsCost: 10000 })

// How many database calls one creditOnlineOrder makes for this member and sale.
const stepsInCredit = await (async () => {
  const db = setup(0)
  await creditOnlineOrder(db, sale)
  return db.log.length
})()

test('creditOnlineOrder writes points only through the locked call', async () => {
  const db = setup(0)
  await creditOnlineOrder(db, sale)
  assert.deepEqual(db.log.filter((q) => q.table === 'loyalty_members' && q.op !== 'select'), [])
  assert.deepEqual(db.log.filter((q) => q.table === 'loyalty_transactions'), [])
  assert.deepEqual(db.log.filter((q) => q.op === 'rpc').map((q) => q.fn), ['loyalty_credit_online_order'])
})

test('a redemption landing at any step of an order credit is kept, and paid for', async () => {
  // The member has 10,000 points of history already (one earlier order), and the balance matches it.
  for (let at = 0; at <= stepsInCredit; at++) {
    const db = setup(10000)
    let calls = 0
    let redeemed = null
    const redeemHere = async () => {
      if (redeemed === null && calls++ === at) {
        redeemed = 'running'
        redeemed = await redeemTee(db)
      }
    }
    db.hooks.before.push(redeemHere)
    const result = await creditOnlineOrder(db, sale)
    await redeemHere() // at === stepsInCredit: after the credit finished
    assert.equal(result.status, 'credited', `redeem before step ${at}`)
    assert.notEqual(redeemed, 'insufficient', `redeem before step ${at}`)
    assert.equal(db.tables.loyalty_redemptions.length, 1, `redeem before step ${at}`)
    assert.equal(history(db), 10000 + 4000 - 10000, `redeem before step ${at}`)
    assert.equal(balance(db), history(db), `redeem before step ${at}: the balance matches the history`)
  }
})

// Every place the server can stop: before or after each database call, and inside the locked call.
const stops = [
  ...Array.from({ length: stepsInCredit }, (_, i) => ({ label: `before call ${i + 1}`, before: i })),
  ...Array.from({ length: stepsInCredit }, (_, i) => ({ label: `after call ${i + 1}`, after: i })),
  ...['order saved', 'ledger written', 'order credited'].map((inside) => ({ label: `inside the call, ${inside}`, inside })),
]

test('a delivery that stops anywhere gets its points from the retry, exactly once', async () => {
  for (const stop of stops) {
    const db = setup(0)
    let before = 0
    let after = 0
    let stopped = false
    const halt = () => {
      stopped = true
      throw new Error('server stopped (function timeout)')
    }
    db.hooks.before.push(() => { if (!stopped && before++ === stop.before) halt() })
    db.hooks.after.push(() => { if (!stopped && after++ === stop.after) halt() })
    db.hooks.inside.push((name) => { if (!stopped && name === stop.inside) halt() })

    await assert.rejects(creditOnlineOrder(db, sale), /server stopped/, stop.label)
    // The locked call is all or nothing: a stop inside it leaves no trace.
    if (stop.inside) assert.equal(db.tables.loyalty_orders.length, 0, stop.label)

    // AccelPay's fulfillment webhook and the hourly reconcile deliver the same sale again.
    const first = await creditOnlineOrder(db, sale)
    assert.equal(first.status, stop.after === stepsInCredit - 1 ? 'duplicate' : 'credited', stop.label)
    assert.deepEqual(await creditOnlineOrder(db, sale), { status: 'duplicate' }, stop.label)
    // And the sign-in recovery finds nothing left to do.
    assert.equal(await claimPendingOrdersForMember(db, MEMBER, EMAIL), 0, stop.label)

    const order = db.tables.loyalty_orders[0]
    assert.equal(order.points_claimed, true, stop.label)
    assert.equal(orderCredits(db), 1, `${stop.label}: credited exactly once`)
    assert.equal(history(db), 4000, stop.label)
    assert.equal(balance(db), 4000, stop.label)
  }
})

test('an order the old code saved without points is finished by the next delivery', async () => {
  const db = setup(0)
  db.tables.loyalty_orders.push({ id: 'o-old', accelpay_sale_id: sale.saleId, member_id: MEMBER, email: EMAIL, points_awarded: 4000, points_claimed: false })
  assert.deepEqual(await creditOnlineOrder(db, sale), { status: 'credited', orderId: 'o-old', memberId: MEMBER, points: 4000 })
  assert.deepEqual(await creditOnlineOrder(db, sale), { status: 'duplicate' })
  assert.equal(history(db), 4000)
  assert.equal(balance(db), 4000)
})

test("or by the member's next sign-in, once the reconcile window has passed", async () => {
  const db = setup(0)
  db.tables.loyalty_orders.push({ id: 'o-old', accelpay_sale_id: sale.saleId, member_id: MEMBER, email: EMAIL, points_awarded: 4000, points_claimed: false })
  assert.equal(await claimPendingOrdersForMember(db, MEMBER, EMAIL), 4000)
  assert.equal(await claimPendingOrdersForMember(db, MEMBER, EMAIL), 0)
  assert.equal(history(db), 4000)
  assert.equal(balance(db), 4000)
})
