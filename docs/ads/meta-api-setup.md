# Meta Marketing API setup

Graph version: `v26.0`. Admin surface: `/admin/retail/ads`.

## What the app needs

| Env | Where to get it |
|---|---|
| `META_ACCESS_TOKEN` | Business Settings → Users → System users → Generate token |
| `META_AD_ACCOUNT_ID` | Ads Manager URL `act=` number (with or without `act_` prefix) |
| `NEXT_PUBLIC_META_PIXEL_ID` | Events Manager → Pixel ID |
| `META_CAPI_ACCESS_TOKEN` | Same system-user token is fine if it can write Pixel events |
| `META_FB_PAGE_ID` | Page About / Graph (needed later for creatives and organic publish) |
| `META_PAGE_ACCESS_TOKEN` | Page token or the same system-user token if assigned to the Page |
| `META_IG_USER_ID` | Instagram professional account connected to the Page |

Token permissions: `ads_management`, `ads_read`, `business_management`. Add `pages_read_engagement` and `pages_manage_posts` if the same token should publish organic posts.

## Steps

1. Confirm Business Manager owns the Untamed Page, ad account, and Pixel.
2. Complete alcohol advertising authorization. Every audience must be 21+.
3. Create a Business-type app named Untamed Ads. Add **Marketing API**. Attach the app to the business.
4. Create system user **Untamed Server** (Admin). Assign **Manage ads** on the ad account and manage on the Pixel.
5. Generate a token for the Untamed Ads app. Paste values into `.env.local` and Vercel Production.
6. Restart the Next server. Open `/admin/retail/ads` and use Recheck.
7. Create paused Florida drafts (campaign + ad set only). Add creatives before turning anything on.

Development-mode apps can manage ad accounts owned by the same business. Request Standard Access only if Meta blocks a call.

## Florida structure

Paused drafts, optimize for website `Lead` on the retail LPs:

- `Untamed | FL Retail | Bars` → `/lp/retail/bars` · $35/day
- `Untamed | FL Retail | Liquor` → `/lp/retail/liquor` · $25/day
- `Untamed | FL Retail | Distributors` → `/lp/retail/distributors` · $16/day

Sync spend writes Meta insights into `ad_spend_daily` (`source = meta_ads`) for the retail performance page.
