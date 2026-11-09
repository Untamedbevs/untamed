# OrderPoints

TLC reached 190 states and 337 steps. The chart draws 7 states and 13 arrows.
The chart does not draw 199 steps that stay in one chart state.
The view hides 18 steps, so the chart does not draw them.

## BalanceMatchesHistory breaks
The shortest path has 9 steps:
0. Order not saved yet
1. an order delivery starts and reads the balance: Order not saved yet
2. the order is saved: Order saved, no points yet
3. an order delivery starts and reads the balance: Order saved, no points yet
4. another delivery finds the order already saved: Order saved, no points yet
5. the order's points go into the history: Order points added
6. the member starts a redemption: Order points added
7. the reward's cost goes into the history: Order points added, reward redeemed
8. the balance had not changed, so the redemption saves: Order points added, reward redeemed
9. the balance is set to the balance read earlier plus the points: Order points added, reward redeemed, balance higher than the history (free points)

## Rules that hold
CreditedAtMostOnce, SavedOrderGetsPoints, NeverNegative, NoDeadlock
