// JavaScript stand-ins for the database functions the order and redemption code calls, written to
// match supabase/migrations/00028 (loyalty_apply_points) and 00032 line for line. The fake db runs
// each one as a transaction (see ../fake-supabase.mjs). migration.test.mjs runs the real SQL; keep
// the two in step when either changes.
import { randomUUID } from 'node:crypto'

const raise = (code, message) => Object.assign(new Error(message), { code })
const one = (row) => [row]

function applyPoints(db, { p_member_id, p_points, p_type, p_description, p_order_id = null, p_receipt_id = null, p_staff_id = null }) {
  const member = db.rows('loyalty_members').find((m) => m.id === p_member_id) // FOR UPDATE
  if (!member) throw raise('P0002', `loyalty member ${p_member_id} not found`)
  const balance = member.points_balance ?? 0
  if (balance + p_points < 0) throw raise('23514', `insufficient points: balance ${balance}, change ${p_points}`)
  const txn = {
    id: randomUUID(), member_id: p_member_id, points: p_points, type: p_type, description: p_description,
    order_id: p_order_id, receipt_id: p_receipt_id, created_by_staff_id: p_staff_id,
  }
  db.rows('loyalty_transactions').push(txn)
  db.step('ledger written')
  member.points_balance = balance + p_points
  return one({ transaction_id: txn.id, new_balance: member.points_balance })
}

function awardOrder(db, orderId, memberId) {
  const order = db.rows('loyalty_orders').find((o) => o.id === orderId) // FOR UPDATE
  if (!order || order.points_claimed) return 0
  if (order.member_id != null && order.member_id !== memberId) return 0
  let points = 0
  const alreadyInLedger = db.rows('loyalty_transactions').some((t) => t.order_id === orderId && t.type === 'online_order')
  if (order.points_awarded > 0 && !alreadyInLedger) {
    points = order.points_awarded
    applyPoints(db, { p_member_id: memberId, p_points: points, p_type: 'online_order', p_description: `Online order (+${points} pts)`, p_order_id: orderId })
  }
  db.step('order credited')
  Object.assign(order, { member_id: memberId, points_claimed: true })
  return points
}

function creditOnlineOrder(db, { p_order, p_member_id }) {
  const orders = db.rows('loyalty_orders')
  const existing = orders.find((o) => o.accelpay_sale_id === p_order.accelpay_sale_id)
  if (!existing) {
    // INSERT ... ON CONFLICT (accelpay_sale_id) DO NOTHING
    const order = {
      id: randomUUID(), ...structuredClone(p_order), member_id: p_member_id, points_claimed: false,
      points_awarded: p_order.points_awarded ?? 0,
    }
    orders.push(order)
    db.step('order saved')
    if (p_member_id != null && order.points_awarded > 0) {
      return one({ result: 'credited', order_id: order.id, points: awardOrder(db, order.id, p_member_id) })
    }
    return one({ result: 'pending', order_id: order.id, points: order.points_awarded })
  }
  if (p_member_id != null) {
    const awarded = awardOrder(db, existing.id, p_member_id)
    if (awarded > 0) return one({ result: 'credited', order_id: existing.id, points: awarded })
  }
  return one({ result: 'duplicate', order_id: existing.id, points: 0 })
}

function claimPendingOrders(db, { p_member_id, p_email }) {
  const email = p_email.trim().toLowerCase()
  const ids = db.rows('loyalty_orders')
    .filter((o) => !o.points_claimed && (o.member_id == null || o.member_id === p_member_id) && String(o.email).toLowerCase() === email)
    .map((o) => o.id)
  return ids.reduce((total, id) => total + awardOrder(db, id, p_member_id), 0)
}

function redeemReward(db, { p_member_id, p_reward_slug, p_reward_label, p_points_cost, p_retail_value_cents = 0, p_ship_state = null }) {
  if (!(p_points_cost > 0)) throw raise('22023', `points cost must be positive (got ${p_points_cost})`)
  const [debit] = applyPoints(db, { p_member_id, p_points: -p_points_cost, p_type: 'redemption', p_description: `Redeemed: ${p_reward_label}` })
  const redemption = {
    id: randomUUID(), member_id: p_member_id, reward_slug: p_reward_slug, reward_label: p_reward_label,
    points_cost: p_points_cost, retail_value_cents: p_retail_value_cents ?? 0, ship_state: p_ship_state,
    status: 'pending', redeem_transaction_id: debit.transaction_id, created_at: new Date().toISOString(),
  }
  db.rows('loyalty_redemptions').push(redemption)
  return one({ redemption: structuredClone(redemption), new_balance: debit.new_balance })
}

export function installPointsFunctions(db) {
  Object.assign(db.functions, {
    loyalty_apply_points: applyPoints,
    loyalty_credit_online_order: creditOnlineOrder,
    loyalty_claim_pending_orders: (fakeDb, args) => claimPendingOrders(fakeDb, args),
    loyalty_redeem_reward: redeemReward,
  })
  return db
}
