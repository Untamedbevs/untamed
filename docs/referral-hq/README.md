# Referral HQ

Referral HQ is the member-facing layer of Untamed Pack Rewards: rank art, a trail map
from jungle to summit, a territory map of where friends joined, a trophy case, an unlock
track for the merch catalog, an activity feed, and a cash-back preview.

Members climb seven ranks, Cub to Legend, on **engagement points** only: enrolling,
friends who join through their link and confirm they're 21+ (up to 25 rewarded a year),
and approved or featured posts. Purchases never count toward rank, and nothing is paid or
earned for anyone's purchase. Ranks and badges are recognition only. This replaced an
earlier draft that paid "Wild Credit" per 4-pack sold, which the legal review ruled out
(per-sale pay to unlicensed people looks like selling alcohol without a license).

## Where to find it

There are two staff-only views. Members don't see either yet.

**The real member portal, for staff accounts.** Sign in to the member portal at
https://untamedbeverages.com/portal/login with a staff email (magic link). Staff accounts
get the Pack Rewards version of `/portal`, `/portal/referrals` and `/portal/rewards` on
their own real data: 21+ enrollment, rank card, trail map, trophy case, unlock track,
activity feed, territory map, sharing tools, the new redemption rules, and the cash-back
preview. The Program Rules page (`/rewards/rules`) is visible to staff only. Everyone else
gets the current portal, and earning still follows the current flow for every account
(join bonus at signup, referral points at signup, online-order points at purchase). The
gate is `inRewardsPreview()` in `src/lib/rewards/preview.ts`.

**Demo members.** https://untamedbeverages.com/referral-hq (admin sidebar →
**Referral HQ**) shows the same pieces on four made-up members (not enrolled, new,
regular, top referrer), with no database reads.

## Where things live

| What | Where |
| --- | --- |
| Ranks, badges, engagement types, catalog art | `src/lib/referral-hq/program.ts` |
| Demo members for the preview | `src/lib/referral-hq/mock-data.ts` |
| Real-data loader for the portal | `src/lib/referral-hq/progress.ts` |
| Program caps, state rules, eligibility, enrollment, ledger, staff gate | `src/lib/rewards/` |
| Staff versions of the portal pages | `src/app/portal/_preview/` |
| Enrollment and redemption APIs (staff only) | `src/app/api/portal/rewards/{enroll,redeem}/` |
| Components and motion CSS | `src/components/referral-hq/` |
| Cash back preview | `src/app/portal/rewards/CashBackPreview.tsx` |
| Preview page and staff gate | `src/app/referral-hq/(hq)/` |
| Site art (WebP, transparent) | `public/images/referral-hq/` |
| Transparent PNG masters (512px) | `docs/referral-hq/art/{ranks,trophies,rewards}/` |

## Going live for members

Migration `00028_rewards_program_compliance.sql` is applied in production. The rest of
the full program was built in a separate session on branch `claude/rewards-compliance`
and isn't merged: points only at 21+ enrollment, referral credit at the friend's
enrollment, held order points by state, the birthdate age gate, public Program Rules,
and switching off referral links for the 22 trade-flagged members (left out of 00028
here because it changes live referral tracking). Before it ships:

- Have counsel sign off on the program, including cash back before it's more than a preview.
- Confirm the approximate retail values in `src/lib/loyalty/constants.ts`.
- Remove the `inRewardsPreview()` gate so members get the new portal.

## Regenerating art

The art was generated with Codex image generation (ChatGPT login) from the prompts in
`art/prompts/`. Each prompt produces one sprite sheet. `art/slice.js` removes the white
background, splits each sheet into square transparent images, and writes both the PNG
masters and the site WebPs:

```bash
node docs/referral-hq/art/slice.js <folder with ranks/ trophies/ rewards/ map/> .
```

Some art is unused on purpose: `rewards/four-pack` (alcohol is never a reward) and
`trophies/big-game` (a martini-glass trophy).
