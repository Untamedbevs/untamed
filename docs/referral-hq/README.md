# Referral HQ

A gamified referral dashboard: referrers earn Wild Credit per 4-pack sold through their
code and climb seven ranks on a fog-of-war territory map. It runs on demo data only.
Nothing reads or writes Supabase yet.

## Where to find it

It's live at https://untamedbeverages.com/referral-hq for staff only. Sign in at
`/admin/login` and click **Referral HQ** in the admin sidebar. Anyone who isn't signed in
as active staff is sent to the admin login.

- **My Territory** (`/referral-hq`): the referrer dashboard. Use **Demo progress**
  (bottom right) to simulate 0–300 packs and watch the map fill in.
- **Program Blueprint** (`/referral-hq/blueprint`): the full rank ladder, rewards,
  trophies, cumulative cost per rank, and open questions for Untamed.

Locally it's the same: run `npm run dev` with a `.env.local` that points at Supabase, sign
in at http://localhost:3003/admin/login, then open http://localhost:3003/referral-hq.

## Where things live

| What | Where |
| --- | --- |
| Ranks, rates, bonuses, trophies, map marker positions | `src/lib/referral-hq/program.ts` |
| Demo referrer (Jess) | `src/lib/referral-hq/mock-data.ts` |
| Staff gate | `src/app/referral-hq/(hq)/layout.tsx` (uses `resolveStaff`) |
| Pages and components | `src/app/referral-hq/` |
| Site art (WebP, transparent) | `public/images/referral-hq/` |
| Transparent PNG masters (512px) | `docs/referral-hq/art/{ranks,trophies,rewards}/` |

## Regenerating art

The art was generated with Codex image generation (ChatGPT login) from the prompts in
`art/prompts/`. Each prompt produces one sprite sheet. `art/slice.js` removes the white
background, splits each sheet into square transparent images, and writes both the PNG
masters and the site WebPs:

```bash
node docs/referral-hq/art/slice.js <folder with ranks/ trophies/ rewards/ map/> .
```

## Before referrers use it

- Swap mock data for `referral_participants`, `referral_events` (`paid_conversion`), and
  AccelPay order line items. Per-flavor counts come from the line items.
- Move it behind the existing Supabase portal login so each referrer sees their own numbers.
- Resolve the open questions on the Blueprint page, especially state alcohol-incentive rules.
