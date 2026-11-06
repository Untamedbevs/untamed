# Pack Rewards points program

Members earn points, climb a trail of milestones, and unlock rewards. Staff run all of it
from the admin: the reward catalog, where milestones sit on the trail, and promotions
("Hunts" in the portal) that members complete for points.

**Status:** staff preview. Staff accounts (and admins in View As, Pack Rewards mode) see
it in the member portal; members keep the current portal until counsel signs off. Removing
the `inRewardsPreview()` gate in `src/lib/rewards/preview.ts` opens it to everyone.

## How points work

The trail runs on **engagement points**, lifetime, never lowered by claiming:

| Earned for | Points | Where it comes from |
|---|---|---|
| Joining Pack Rewards (21+ enrollment) | 1,000 | `signup_bonus` |
| A friend joins through your link and confirms 21+ | 1,000 | `referral_signup` |
| Approved / featured post | 2,500 / 7,500 total | `ugc_approved` |
| Approved Hunt | set per Hunt (Fifty-Like Hunt: 5,000) | `promotion` |
| Staff bonus | any | positive `adjustment` |

Purchases never count toward the trail, ranks or milestones, so no reward is a rebate on
alcohol. Purchase points still build the spendable balance for the merch catalog.

## Milestones and rewards

- **Rewards** (Admin → Rewards Program → Trail & Rewards → Rewards): name, kind (gift card,
  merch, experience, other), approximate value, art, a staff fulfillment note, active.
- **Milestones** (same page, Trail tab): a point threshold, title, tagline, art, and an
  optional reward. A milestone with no reward is a recognition marker.
- Reaching a milestone lets the member **claim** its reward once (Claims tab). Staff
  fulfill it with a note (a gift card code, a tracking number) and the member gets the
  "reward on its way" email. Cancelling a claim lets the member claim it again.
- Claims and catalog redemptions share the **$500 retail-value yearly cap** per member.

Starting trail: First Tracks 2,500 (marker), $5 at 5K, $10 at 10K, $25 at 25K, $50 at
50K, $100 at 100K, $150 at 200K (Legend). All gift cards are placeholders.

## Hunts (promotions)

Admin → Rewards Program → Hunts. Each Hunt has steps, member rules (members tick each one
to submit), a reviewer checklist, points, dates, a per-member limit, art, and its proof
settings: **link**, **screenshot** and **note**, each Off / Optional / Required. Links can
be limited to hosts (the Fifty-Like Hunt accepts facebook.com, fb.com and fb.me).

Members send proof from the portal's Hunts page. It lands in Admin → Rewards Program →
Review queue. Approving needs every checklist item ticked, credits the points through the
atomic ledger (`loyalty_apply_points`), and emails the member; rejecting needs a note and
emails it to them.

## Emails

Editable templates in Admin → CRM → Templates:

- Transactional: `hunt-approved`, `hunt-needs-changes`, `reward-on-its-way` (sent from loyalty@).
- Campaign: `pack-rewards-hunt-launch`, `pack-rewards-trail`.
- Merge tags `{{hunts_url}}` and `{{rewards_url}}` work in every campaign.

Staff also get an email at loyalty@ whenever a member claims a reward.

## Before members see it

- **Gift cards:** the legal review recommended merchandise only; gift cards are cash
  equivalents. Confirm with counsel, or switch the rewards to merch.
- **Facebook Hunts:** Meta's Pages Terms say a promotion run or announced from a Page "must
  not require or incentivize participants to share, repost, tag others or in any other way
  publicize your promotion." Have counsel and whoever runs the Facebook Page review the
  Fifty-Like Hunt before it's announced there.
- Choose the gift card brand and how codes are delivered.

## Where things live

| What | Where |
|---|---|
| Tables, seeds, ledger type | `supabase/migrations/00030_points_rewards_program.sql` |
| Email templates | `supabase/migrations/00031_rewards_email_templates.sql` |
| Types, trail math, proof checks | `src/lib/rewards/catalog.ts` |
| A member's trail for the portal | `src/lib/rewards/member-rewards.ts` |
| Art picker keys | `src/lib/rewards/art.ts` (images in `public/images/referral-hq/{milestones,hunts}`) |
| Member emails | `src/lib/rewards/notify.ts` |
| Portal components | `src/components/rewards/` (Onboarding, PackPass, MilestoneTrail, HuntBoard, RewardStash) |
| Member APIs | `src/app/api/portal/rewards/claim`, `src/app/api/portal/hunts/submit` |
| Admin pages and APIs | `src/app/admin/rewards`, `src/app/admin/promotions`, `src/app/api/admin/{rewards,promotions}` |
| Art prompts and slicer | `docs/referral-hq/art/prompts/{milestones,hunts}.txt`, `docs/referral-hq/art/slice.js` |
