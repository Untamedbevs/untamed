---- MODULE OrderPoints ----
\* One member's points while an online order is credited and the member redeems a reward.
\*
\* Code this model describes (Untamedbevs/untamed):
\*   src/lib/loyalty/orders.ts             creditOnlineOrder (and, at 956e98a, awardOrderPoints)
\*   src/app/api/webhooks/untamed-orders/route.ts, untamed-order-fulfillment/route.ts,
\*   src/app/api/cron/reconcile-orders/route.ts      the deliveries that call creditOnlineOrder
\*   src/app/api/portal/redemptions/route.ts         the member's redemption (live today)
\*   supabase/migrations/00028_rewards_program_compliance.sql   loyalty_apply_points (locked)
\*   supabase/migrations/00032_locked_points_changes.sql        loyalty_credit_online_order,
\*                                                  loyalty_award_order, loyalty_redeem_reward
\*
\* Fixed = FALSE is main at 956e98a. Fixed = TRUE is the branch claude/order-points-fix: crediting an
\* order (insert included) and redeeming each run as one locked database call, so each is
\* all-or-nothing and reads the balance under the lock. A delivery that finds the order saved but
\* not credited credits it then.
\*
\* Abstractions:
\*   One sale, one member who already exists (the buyer's email matches), start balance Start.
\*   ledger is the sum of the member's loyalty_transactions rows since the start.
\*   "Webhook" and "Cron" are two deliveries of the same sale (the order webhook, and the
\*   fulfillment webhook or the hourly reconcile); each runs creditOnlineOrder.
\*   Fails(p) is the server stopping between two writes (timeout, deploy, dropped connection).
\*   At 956e98a, Supabase errors inside awardOrderPoints are not checked, so a stop is the kindest case.
\*   A locked call has no step in between, so with Fixed = TRUE nothing can stop partway. A stop
\*   before a delivery's call is that delivery not happening; the two deliveries stand for the
\*   ones that do run (AccelPay retries, and the reconcile runs hourly for 72 hours).
\*   Leftover = TRUE also starts from an order the old code saved without its points. Its ledger
\*   row is not there either; an old order whose ledger row was written but whose balance was not
\*   starts with the balance off from the history, which no code path repairs.
EXTENDS Integers

CONSTANTS Start, Points, Cost, Fixed, CanFail, Leftover

Deliveries == {"Webhook", "Cron"}
Procs == Deliveries \cup {"Redeem"}

VARIABLES
    balance,      \* loyalty_members.points_balance
    ledger,       \* sum of loyalty_transactions.points added since Start
    credits,      \* online_order ledger rows for this sale
    stored,       \* the loyalty_orders row exists (accelpay_sale_id is unique)
    redeemed,     \* a redemption debit is in the ledger
    pc,           \* where each request is
    seen          \* the balance each request read

vars == <<balance, ledger, credits, stored, redeemed, pc, seen>>

Init ==
    /\ balance = Start
    /\ ledger = 0
    /\ credits = 0
    /\ stored \in (IF Leftover THEN {FALSE, TRUE} ELSE {FALSE})
    /\ redeemed = FALSE
    /\ pc = [p \in Procs |-> "idle"]
    /\ seen = [p \in Procs |-> 0]

\* ---- Order delivery, code as it is ----
\* ensureMemberForOrder reads points_balance before the order is inserted.
DeliveryReads(p) ==
    /\ ~Fixed /\ p \in Deliveries /\ pc[p] = "idle"
    /\ seen' = [seen EXCEPT ![p] = balance]
    /\ pc' = [pc EXCEPT ![p] = "insert"]
    /\ UNCHANGED <<balance, ledger, credits, stored, redeemed>>

\* Insert into loyalty_orders; a unique violation returns "duplicate" and stops.
DeliveryInserts(p) ==
    /\ pc[p] = "insert"
    /\ IF stored
       THEN /\ pc' = [pc EXCEPT ![p] = "done"]
            /\ UNCHANGED stored
       ELSE /\ stored' = TRUE
            /\ pc' = [pc EXCEPT ![p] = "ledger"]
    /\ UNCHANGED <<balance, ledger, credits, redeemed, seen>>

\* awardOrderPoints: ledger row, then points_balance = (balance read earlier) + points.
DeliveryWritesLedger(p) ==
    /\ pc[p] = "ledger"
    /\ ledger' = ledger + Points
    /\ credits' = credits + 1
    /\ pc' = [pc EXCEPT ![p] = "balance"]
    /\ UNCHANGED <<balance, stored, redeemed, seen>>

DeliveryWritesBalance(p) ==
    /\ pc[p] = "balance"
    /\ balance' = seen[p] + Points
    /\ pc' = [pc EXCEPT ![p] = "done"]
    /\ UNCHANGED <<ledger, credits, stored, redeemed, seen>>

\* ---- Order delivery, fixed: loyalty_credit_online_order saves the order and credits it in one
\* locked call; finding it saved and credited is a duplicate; finding it saved but not credited,
\* it credits it (loyalty_award_order, which also checks for the ledger row) ----
DeliveryCreditsAtomically(p) ==
    /\ Fixed /\ p \in Deliveries /\ pc[p] = "idle"
    /\ IF stored /\ credits > 0
       THEN UNCHANGED <<balance, ledger, credits, stored>>
       ELSE /\ stored' = TRUE
            /\ ledger' = ledger + Points
            /\ credits' = credits + 1
            /\ balance' = balance + Points
    /\ pc' = [pc EXCEPT ![p] = "done"]
    /\ UNCHANGED <<redeemed, seen>>

\* ---- Member redemption, code as it is (portal/redemptions POST) ----
\* Reads the balance, inserts the ledger debit, then updates the balance only if it is unchanged;
\* on a mismatch it deletes the debit again.
RedeemReads ==
    /\ ~Fixed /\ pc["Redeem"] = "idle"
    /\ seen' = [seen EXCEPT !["Redeem"] = balance]
    /\ pc' = [pc EXCEPT !["Redeem"] = IF balance >= Cost THEN "debit" ELSE "done"]
    /\ UNCHANGED <<balance, ledger, credits, stored, redeemed>>

RedeemWritesLedger ==
    /\ pc["Redeem"] = "debit"
    /\ ledger' = ledger - Cost
    /\ redeemed' = TRUE
    /\ pc' = [pc EXCEPT !["Redeem"] = "guard"]
    /\ UNCHANGED <<balance, credits, stored, seen>>

RedeemGuardedWrite ==
    /\ pc["Redeem"] = "guard"
    /\ IF balance = seen["Redeem"]
       THEN /\ balance' = seen["Redeem"] - Cost
            /\ UNCHANGED <<ledger, redeemed>>
       ELSE /\ ledger' = ledger + Cost
            /\ redeemed' = FALSE
            /\ UNCHANGED balance
    /\ pc' = [pc EXCEPT !["Redeem"] = "done"]
    /\ UNCHANGED <<credits, stored, seen>>

\* ---- Member redemption, fixed: loyalty_redeem_reward debits under the lock and saves the
\* redemption in the same call. (The route's earlier balance check can only refuse, which changes
\* nothing.) ----
RedeemAtomically ==
    /\ Fixed /\ pc["Redeem"] = "idle"
    /\ IF balance >= Cost
       THEN /\ balance' = balance - Cost
            /\ ledger' = ledger - Cost
            /\ redeemed' = TRUE
       ELSE UNCHANGED <<balance, ledger, redeemed>>
    /\ pc' = [pc EXCEPT !["Redeem"] = "done"]
    /\ UNCHANGED <<credits, stored, seen>>

\* The server stops between two writes of a request. CanFail = FALSE leaves this out, to see the
\* overlaps on their own.
Fails(p) ==
    /\ CanFail
    /\ pc[p] \in {"ledger", "balance", "guard"}
    /\ pc' = [pc EXCEPT ![p] = "done"]
    /\ UNCHANGED <<balance, ledger, credits, stored, redeemed, seen>>

Settled == \A p \in Procs : pc[p] = "done"
Finished ==
    /\ Settled
    /\ UNCHANGED vars

Next ==
    \/ \E p \in Deliveries : DeliveryReads(p)
    \/ \E p \in Deliveries : DeliveryInserts(p)
    \/ \E p \in Deliveries : DeliveryWritesLedger(p)
    \/ \E p \in Deliveries : DeliveryWritesBalance(p)
    \/ \E p \in Deliveries : DeliveryCreditsAtomically(p)
    \/ RedeemReads
    \/ RedeemWritesLedger
    \/ RedeemGuardedWrite
    \/ RedeemAtomically
    \/ \E p \in Procs : Fails(p)
    \/ Finished

Spec == Init /\ [][Next]_vars

\* Rules
\* Once every request has finished, the balance the member sees equals their points history.
BalanceMatchesHistory == Settled => balance = Start + ledger
\* A sale's points are added at most once.
CreditedAtMostOnce == credits <= 1
\* Once every request has finished, a saved order has its points.
SavedOrderGetsPoints == (Settled /\ stored) => credits = 1
\* The balance never goes below zero.
NeverNegative == balance >= 0
====
