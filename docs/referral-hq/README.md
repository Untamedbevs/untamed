# Referral HQ mock-up

A local-only mock-up of a gamified referral dashboard: referrers earn Wild Credit per
4-pack sold through their code and climb seven ranks on a fog-of-war territory map.
Demo data only. Nothing reads or writes Supabase.

- Run `npm.cmd run dev`, then open http://localhost:3003/referral-hq.
- Login: set `REFERRAL_HQ_USERNAME` and `REFERRAL_HQ_PASSWORD` in `.env.local`. When
  they're unset, local dev uses the fallback in `src/lib/referral-hq/auth.ts`. In
  production (including Vercel previews) the route returns 404 until both are set.
- No time to run it? Watch the videos in `showcase/`.
- **My Territory** (`/referral-hq`): the referrer dashboard. Use **Demo progress**
  (bottom right) to simulate 0–300 packs and watch the map fill in.
- **Program Blueprint** (`/referral-hq/blueprint`): the full rank ladder, rewards,
  trophies, cumulative cost per rank, and open questions for Untamed.

## Where things live

| What | Where |
| --- | --- |
| Ranks, rates, bonuses, trophies, map marker positions | `src/lib/referral-hq/program.ts` |
| Demo referrer (Jess) | `src/lib/referral-hq/mock-data.ts` |
| Login gate | `src/lib/referral-hq/auth.ts`, `src/app/referral-hq/actions.ts` |
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

## Showcase captures

`showcase/` has a 1080p desktop walkthrough, a phone scroll-through (MP4), and full-page
stills for sharing without running the app. To re-record after changes, start the dev
server and run:

```bash
node docs/referral-hq/capture/record.js . docs/referral-hq/showcase <frames-folder> all
bash docs/referral-hq/capture/encode.sh <frames-folder>/desktop <out.mp4> 12M
```

`record.js` drives the installed Google Chrome through a Playwright copy in the npx cache,
and `encode.sh` uses CapCut's ffmpeg. Both paths are specific to this machine.

## Before this goes live

- Swap mock data for `referral_participants`, `referral_events` (`paid_conversion`), and
  AccelPay order line items. Per-flavor counts come from the line items.
- Put referrers behind the existing Supabase portal login instead of the shared password.
- Resolve the open questions on the Blueprint page, especially state alcohol-incentive rules.
