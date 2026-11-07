# OrderPoints

TLC reached 287 states and 602 steps. The chart draws 10 states and 14 arrows.
The chart does not draw 375 steps that stay in one chart state.
The view hides 31 steps, so the chart does not draw them.

## BalanceMatchesHistory breaks
The shortest path has 8 steps:
0. Order not saved yet
1. an order delivery starts and reads the balance: Order not saved yet
2. the order is saved: Order saved, no points yet
3. an order delivery starts and reads the balance: Order saved, no points yet
4. another delivery finds the order already saved: Order saved, no points yet
5. the server stops partway: Order saved, no points yet
6. the member starts a redemption: Order saved, no points yet
7. the reward's cost goes into the history: Order saved, no points yet, reward redeemed
8. the server stops partway: Order saved, points lost for good, reward redeemed, balance higher than the history (free points)

## SavedOrderGetsPoints breaks
The shortest path has 8 steps:
0. Order not saved yet
1. an order delivery starts and reads the balance: Order not saved yet
2. the order is saved: Order saved, no points yet
3. an order delivery starts and reads the balance: Order saved, no points yet
4. another delivery finds the order already saved: Order saved, no points yet
5. the server stops partway: Order saved, no points yet
6. the member starts a redemption: Order saved, no points yet
7. the reward's cost goes into the history: Order saved, no points yet, reward redeemed
8. the balance had not changed, so the redemption saves: Order saved, points lost for good, reward redeemed

## Rules that hold
CreditedAtMostOnce, NeverNegative, NoDeadlock
