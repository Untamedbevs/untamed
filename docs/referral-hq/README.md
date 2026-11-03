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

Right now it's a **staff preview on demo data** at
https://untamedbeverages.com/referral-hq. Sign in at `/admin/login` and click
**Referral HQ** in the admin sidebar; anyone who isn't active staff is sent to the admin
login. Switch between four demo members (not enrolled, new, regular, top referrer) at the
top. Sections are labeled with the portal page each piece will appear on.

Nothing reads or writes Supabase, and members don't see any of it yet.

## Where things live

| What | Where |
| --- | --- |
| Ranks, badges, engagement types, catalog art | `src/lib/referral-hq/program.ts` |
| Demo members for the preview | `src/lib/referral-hq/mock-data.ts` |
| Real-data loader for the portal (not used yet) | `src/lib/referral-hq/progress.ts` |
| Program caps, state rules, eligibility | `src/lib/rewards/` |
| Components and motion CSS | `src/components/referral-hq/` |
| Cash back preview | `src/app/portal/rewards/CashBackPreview.tsx` |
| Preview page and staff gate | `src/app/referral-hq/(hq)/` |
| Site art (WebP, transparent) | `public/images/referral-hq/` |
| Transparent PNG masters (512px) | `docs/referral-hq/art/{ranks,trophies,rewards}/` |

## Going live for members

The full program (portal pages on real data, 21+ enrollment, birthdate age gate, public
Program Rules, database migration `00028_rewards_program_compliance.sql`) was built in a
separate session on branch `claude/rewards-compliance` and isn't merged yet. Before it
ships:

- Have counsel sign off on the program, including cash back before it's more than a preview.
- Run the migration before deploying the code that reads its columns.
- Confirm the approximate retail values in `src/lib/loyalty/constants.ts`.

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
