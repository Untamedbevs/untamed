---
name: verify-order-points-model
description: Recheck the TLA+ model of Untamed's points balance while an online order is credited and a member redeems a reward. Use when a change touches src/lib/loyalty/orders.ts (creditOnlineOrder, claimPendingOrdersForMember), the AccelPay order webhooks or the reconcile-orders cron, src/app/api/portal/redemptions/route.ts or src/app/api/portal/rewards/redeem/route.ts, src/lib/rewards/ledger.ts, the loyalty_* points functions in supabase/migrations (00028 loyalty_apply_points, 00032), or any other code that writes loyalty_members.points_balance.
---

# Verify the order points model

`docs/statecharts/order-points/OrderPoints.tla` models one member while one AccelPay sale is delivered twice (the order webhook, and the fulfillment webhook or hourly reconcile) and the member redeems a reward, with the server able to stop between two writes. TLC checks every order of those steps. A pass covers the model, not the whole app.

## Rules

| Rule | In plain words |
|---|---|
| `BalanceMatchesHistory` | Once every request has finished, the balance the member sees equals their points history. |
| `CreditedAtMostOnce` | A sale's points are added at most once. |
| `SavedOrderGetsPoints` | Once every request has finished, a saved order has its points. |
| `NeverNegative` | The balance never goes below zero. |

## Coverage

`Fixed = FALSE` is Untamedbevs/untamed `main` at `956e98a` ("Deploy the admin refresh, the test customer and the Pack Rewards portal overhaul to production."). `Fixed = TRUE` is the branch `claude/order-points-fix` (migration `00032_locked_points_changes.sql`). Name a newer commit here only after you confirm the model still describes the code.

| Model action | Code |
|---|---|
| `DeliveryReads`, `DeliveryInserts`, `DeliveryWritesLedger`, `DeliveryWritesBalance` | at `956e98a`: `ensureMemberForOrder` reads `points_balance`, the `loyalty_orders` insert returns `duplicate` on a unique violation, then `awardOrderPoints` writes a ledger row and `points_balance = currentBalance + points` with no condition and no error checks |
| `DeliveryCreditsAtomically` | fixed: `creditOnlineOrder` calls `loyalty_credit_online_order`, which inserts the order and credits it through `loyalty_award_order` and `loyalty_apply_points` in one transaction; a delivery that finds the order saved but unclaimed credits it then (unless its ledger row is already there) |
| `RedeemReads`, `RedeemWritesLedger`, `RedeemGuardedWrite` | at `956e98a`: `src/app/api/portal/redemptions/route.ts` writes the ledger debit, then a balance update guarded on the balance it read, deleting the debit if that fails |
| `RedeemAtomically` | fixed: both redeem routes call `redeemReward` (`src/lib/rewards/ledger.ts`), which runs `loyalty_redeem_reward`: the debit under the lock and the redemption row, in one transaction |
| `Fails` | the server stopping between two writes (a function timeout, a deploy, a dropped connection); a locked call has no such point |
| `Leftover` (constant) | an order the old code saved without points (`member_id` set, `points_claimed` false, no ledger row), which the fixed code finishes on the next delivery |

Not modeled, but moved to the same locked functions in `00032` and checked by `migration.test.mjs`: `claimPendingOrdersForMember` (`loyalty_claim_pending_orders`), `grantSignupBonusIfMissing` (`loyalty_grant_signup_bonus`), referral credits in `src/lib/referral/helpers.ts` (`applyPoints`), admin redemption cancel (`loyalty_cancel_redemption`; fulfill is conditional on `pending`), receipt review (`loyalty_review_receipt`) and UGC approval (`loyalty_review_ugc`, with a version check on `points_awarded`).

Still outside: new members created with `points_balance` already set to the signup bonus (`ensureMemberForAuthUser`, `src/app/api/tracking/identify/route.ts`, `src/app/api/distributor/lead/route.ts`) write the balance and the ledger row separately, and the admin adjust route (`src/app/api/admin/loyalty/members/[id]/adjust/route.ts`) uses a guarded write like the old redemption.

## Check a change

1. Read the diff. If it touches nothing in the coverage table, say so and stop.
2. Update the model so each action matches the new code, and set `Fixed` in the configs to describe the code as it is.
3. Run each config with the pstack `/statechart` skill, giving it `view.mts` as the view. On Eric's Windows machine the command is `statechart` (or `statechart-wsl`), from `docs/statecharts/order-points/`: `statechart OrderPoints.tla --config fixed.cfg --view view.mts --out <scratch folder>`.
4. Compare with the expected results, then copy the new chart and report into `charts/` and render the SVG with Pele.
5. Replay against the real code, from `docs/statecharts/replay/order-points/`:
   - `node --import ./register.mjs --test order-points.test.mjs` runs the real `creditOnlineOrder`, `claimPendingOrdersForMember` and `redeemReward` with a fake database whose stand-ins for the SQL functions are in `points-functions.mjs`. It lands a redemption at every step of an order credit, and stops the server before, after and inside every database call, then retries.
   - `node --test migration.test.mjs` runs every migration in PGlite (real Postgres in WebAssembly) and checks each `00032` function. It needs `npm install --no-save @electric-sql/pglite@0.2.17` from the repo root first, and skips without it.
   When a SQL function changes, change its stand-in in `points-functions.mjs` to match.

Expected results on `claude/order-points-fix`:

| Config | Rules that break |
|---|---|
| `today-no-stops.cfg` (code at `956e98a`, overlaps only) | `BalanceMatchesHistory` (a redemption during an order credit is erased) |
| `today.cfg` (code at `956e98a`, overlaps and stops) | `BalanceMatchesHistory`, `SavedOrderGetsPoints` |
| `fixed.cfg` (this branch, with a leftover order) | none |
| `order-points.test.mjs` | all 5 pass (they fail against `956e98a`'s `orders.ts`) |
| `migration.test.mjs` | all 13 pass |

## Bug or modeling error?

A new break is a finding until you show otherwise: replay its shortest path against the real code, as a test in `docs/statecharts/replay/`. If it doesn't reproduce, fix the model, not the rule. Never weaken a rule to make it pass, and don't change product code unless you were asked to.
