import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { signedInUserInRewardsPreview } from '@/lib/rewards/preview'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'
import { POINTS, POINTS_PER_DOLLAR, REWARDS } from '@/lib/loyalty/constants'
import {
  CAPS,
  ENROLLMENT_VALID_DAYS,
  PROGRAM_NAME,
  PROGRAM_RULES_EFFECTIVE,
  PROGRAM_RULES_VERSION,
  PROGRAM_SPONSOR,
  PROGRAM_SPONSOR_ADDRESS,
} from '@/lib/rewards/program'
import { programStates, purchasePointStates } from '@/lib/rewards/state-rules'
import { stateName } from '@/lib/rewards/states'

export const metadata: Metadata = {
  title: `${PROGRAM_NAME} Program Rules | Untamed Beverages`,
  description:
    'Who can join Untamed Pack Rewards, how points are earned and redeemed, referral rules, and state availability. Adults 21+ only.',
  // Staff preview until counsel signs off; not public yet.
  robots: { index: false, follow: false },
}

const CONTACT_EMAIL = 'loyalty@untamedbeverages.com'

function dollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

export default async function ProgramRulesPage() {
  if (!(await signedInUserInRewardsPreview())) notFound()

  const purchaseStates = purchasePointStates().map(stateName)
  const openStates = programStates().map(stateName)
  const purchaseStateList =
    purchaseStates.length > 0 ? purchaseStates.join(', ') : 'no states at this time'

  return (
    <div className="flex flex-col min-h-screen bg-untamed-black">
      <Navigation />

      <main className="flex-1 py-16 md:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <header className="mb-12">
            <h1 className="font-condensed text-4xl sm:text-5xl font-bold text-white uppercase mb-3">
              {PROGRAM_NAME} Program Rules
            </h1>
            <p className="text-untamed-white-muted/60 text-sm">
              Effective {PROGRAM_RULES_EFFECTIVE} &middot; Version {PROGRAM_RULES_VERSION}
            </p>
          </header>

          <div className="space-y-10 text-untamed-white-muted text-[15px] leading-relaxed">
            <section className="space-y-3">
              <p>
                {PROGRAM_NAME} (the &ldquo;Program&rdquo;) is offered by {PROGRAM_SPONSOR}{' '}
                (&ldquo;Untamed,&rdquo; &ldquo;we,&rdquo; or &ldquo;us&rdquo;). These rules
                apply in addition to our{' '}
                <Link href="/terms" className="text-untamed-white underline">Terms of Service</Link>{' '}
                and{' '}
                <Link href="/privacy" className="text-untamed-white underline">Privacy Policy</Link>.
                By enrolling you agree to them. The Program is void where prohibited or
                restricted by law.
              </p>
              <p className="text-untamed-white">
                The Program is only for adults 21 and older. Enjoy Untamed responsibly.
              </p>
            </section>

            <Section title="1. Where Untamed is sold">
              <p>
                You can buy Untamed in stores, at bars, and on our online shop. Online
                orders are processed and shipped by a licensed retailer in our checkout
                partner AccelPay&rsquo;s network, which is the seller of record, as state
                law requires. Rewards are provided by Untamed, not by any retailer.
                Retailers do not redeem, honor, or administer Program rewards, and no
                reward is a coupon or discount at any retailer.
              </p>
            </Section>

            <Section title="2. Who can join">
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  Legal residents of the states Untamed ships to who are{' '}
                  <strong className="text-untamed-white">21 or older</strong>. You enroll with
                  your full date of birth and state of residence. Accounts of anyone under 21
                  are closed.
                </li>
                <li>
                  <strong className="text-untamed-white">Open in:</strong> {openStates.join(', ')}.
                  The Program is not offered in other states.
                </li>
                <li>One account per person and per household.</li>
                <li>
                  <strong className="text-untamed-white">Not eligible:</strong> owners,
                  officers, employees, agents, or representatives of any alcohol retailer,
                  bar, restaurant, wholesaler, distributor, or alcohol manufacturer or
                  importer (including Untamed), and their immediate family and household
                  members. Rewards earned in breach of this rule are forfeited.
                </li>
                <li>
                  You confirm your eligibility when you enroll and again every{' '}
                  {Math.round(ENROLLMENT_VALID_DAYS / 30)} months, and whenever these rules
                  change. Until you do, you can&apos;t earn or redeem.
                </li>
              </ul>
            </Section>

            <Section title="3. Where the Program is available">
              <p>
                Enrollment, the welcome bonus, content points, referral points, and
                merchandise rewards are available in every US state and the District of
                Columbia, except where prohibited by law.
              </p>
              <p>
                <strong className="text-untamed-white">Purchase points</strong> (points for
                online orders and retail receipts) are available only to residents of, and
                for purchases made in: <strong className="text-untamed-white">{purchaseStateList}</strong>.
                Purchase points are not available to residents of, or purchases made in,
                any other state. We add states as state law allows and will update this
                list when we do.
              </p>
            </Section>

            <Section title="4. How to earn points">
              <div className="rounded-xl border border-white/10 overflow-hidden">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-white/10">
                    {[
                      ['Enroll in the Program (once)', `${POINTS.SIGNUP_BONUS.toLocaleString()} points`],
                      [
                        'A friend you referred enrolls and confirms they are 21+',
                        `${POINTS.REFERRAL_SIGNUP.toLocaleString()} points, up to ${CAPS.REFERRAL_CREDITS_PER_YEAR} friends per calendar year`,
                      ],
                      [
                        'A friend you referred places their first-ever Untamed order through your link (purchase-point states only)',
                        `${POINTS.REFERRAL_FIRST_PURCHASE.toLocaleString()} bonus points, up to ${CAPS.REFERRAL_CREDITS_PER_YEAR} friends per calendar year`,
                      ],
                      ['Your photo or video is approved for the community', `${POINTS.PER_UGC_APPROVED.toLocaleString()} points`],
                      ['Your content is featured by Untamed', `${POINTS.PER_UGC_FEATURED.toLocaleString()} points in total`],
                      [
                        `Online order (purchase-point states only)`,
                        `${POINTS_PER_DOLLAR} points per $1 of merchandise subtotal`,
                      ],
                      [
                        'Retail receipt (purchase-point states only)',
                        `${POINTS.PER_RECEIPT.toLocaleString()} points per 4-pack shown on an approved receipt`,
                      ],
                    ].map(([label, value]) => (
                      <tr key={label}>
                        <td className="px-4 py-2.5 text-untamed-white">{label}</td>
                        <td className="px-4 py-2.5">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  Purchase points require proof of purchase. Online orders are matched
                  automatically by email; both your state of residence and the
                  ship-to state must be eligible. Online orders placed up to{' '}
                  {CAPS.PURCHASE_LOOKBACK_DAYS} days before you enroll count once you enroll.
                </li>
                <li>
                  Receipts from any licensed retailer earn the same points. Upload clear,
                  original, unaltered receipts dated within 30 days, up to{' '}
                  {CAPS.RECEIPTS_PER_DAY} per day. We review every receipt and may ask for the
                  original.
                </li>
                <li>
                  <strong className="text-untamed-white">You never earn anything for what
                  someone else buys</strong>, for introducing a bar, restaurant, store, or
                  distributor, or for writing a review. Rewards are never conditioned on a
                  positive review or rating.
                </li>
              </ul>
            </Section>

            <Section title="5. Rewards">
              <div className="rounded-xl border border-white/10 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-untamed-white">
                      <th className="px-4 py-2.5 font-semibold">Reward</th>
                      <th className="px-4 py-2.5 font-semibold">Points</th>
                      <th className="px-4 py-2.5 font-semibold">Approx. retail value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {REWARDS.map((r) => (
                      <tr key={r.id}>
                        <td className="px-4 py-2.5 text-untamed-white">{r.name}</td>
                        <td className="px-4 py-2.5">{r.pointsCost.toLocaleString()}</td>
                        <td className="px-4 py-2.5">{dollars(r.retailValueCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong className="text-untamed-white">No reward is, or can be exchanged
                  for, alcohol</strong>, a discount on alcohol, cash, or a gift card.
                </li>
                <li>
                  Rewards are branded merchandise, in adult sizes, shipped to your address
                  in your state of residence. We confirm your address by email and may
                  verify your identity and age before shipping.
                </li>
                <li>
                  You can redeem rewards worth up to {dollars(CAPS.ANNUAL_REWARD_VALUE_CENTS)}{' '}
                  in total retail value per calendar year.
                </li>
                <li>
                  If a reward is unavailable we may substitute one of equal or greater
                  value. Allow up to 6 weeks for delivery.
                </li>
              </ul>
            </Section>

            <Section title="6. Referral rules">
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  You get a personal link after you enroll. You earn referral points
                  when someone you referred creates a new account through your link and
                  completes enrollment, including confirming they are 21+ and eligible,
                  and a first-order bonus when that friend places their first-ever Untamed
                  order through your link. The first-order bonus follows the purchase
                  points rules in section 3: you and the order must both be in a
                  purchase-point state. People who already have an account or have bought
                  from us before don&apos;t count. Each friend counts for one referrer, once. Referring
                  yourself or someone in your household doesn&apos;t count.
                </li>
                <li>
                  <strong className="text-untamed-white">Share only with people you know
                  are 21 or older</strong>, and ask them not to forward your link to anyone
                  under 21.
                </li>
                <li>
                  <strong className="text-untamed-white">Say that you earn rewards.</strong>{' '}
                  Any time you share or post about Untamed, include a clear disclosure in
                  the post or message itself, such as &ldquo;#ad&rdquo; at the start or
                  &ldquo;I get rewards from Untamed.&rdquo; A note in your profile alone
                  isn&apos;t enough.
                </li>
                <li>
                  Share it yourself, to people you know or on your own profile. No spam or
                  bulk messages, no texts or calls to anyone who hasn&apos;t agreed to hear
                  from you, no paid ads, no coupon or deal sites, and no posting in places
                  where people under 21 are likely to be. Untamed never sends messages to
                  your friends for you.
                </li>
                <li>
                  You are not an employee, agent, or salesperson of Untamed. Don&apos;t
                  solicit sales to bars, restaurants, stores, or distributors, or offer
                  anyone discounts or anything of value to buy. Businesses interested in
                  Untamed can contact us through the{' '}
                  <Link href="/retail" className="text-untamed-white underline">Retail page</Link>;
                  that never earns rewards.
                </li>
              </ul>
            </Section>

            <Section title="7. Responsible content">
              <p>
                When you post about Untamed or submit content to us: everyone shown must be
                21 or older (Untamed only features content in which everyone is and looks
                25 or older); never show or suggest drinking with driving, boating, or other
                risky activities, drinking to excess, or drinking games; make no health or
                strength claims; and don&apos;t aim content at people under 21. Untamed may
                review posts that mention the Program and ask you to change or remove them,
                and may remove content or end your participation if you don&apos;t.
              </p>
            </Section>

            <Section title="8. Points">
              <p>
                Points have no cash value, are not property, can&apos;t be sold,
                transferred, or combined between accounts, and are forfeited if your
                account closes. Points may expire after 12 consecutive months with no
                earning or redemption activity; we&apos;ll email you at least 30 days
                before. We may correct points credited in error.
              </p>
            </Section>

            <Section title="9. Fraud and audits">
              <p>
                We may verify any activity, request original receipts or proof of
                eligibility, reverse points, cancel redemptions, and suspend or close
                accounts for fraud, abuse, duplicate or fake accounts, automated activity,
                altered receipts, or any breach of these rules.
              </p>
            </Section>

            <Section title="10. Taxes">
              <p>
                Rewards may be taxable income to you, and you are responsible for any taxes.
                We may ask for tax information (such as a Form W-9) and issue tax forms
                where the law requires. Rewards are valued at their approximate retail
                value.
              </p>
            </Section>

            <Section title="11. Your information">
              <p>
                We use your date of birth and state to confirm eligibility and apply state
                rules, and receipt images only to run the Program. We don&apos;t share
                Program data with retailers. We keep Program records, including your
                enrollment confirmations, for at least three years as the law requires.
                Program emails are separate from marketing emails, and you can unsubscribe
                from marketing at any time. See our{' '}
                <Link href="/privacy" className="text-untamed-white underline">Privacy Policy</Link>.
              </p>
            </Section>

            <Section title="12. Changes and ending the Program">
              <p>
                We may change, suspend, or end the Program or any feature, in any state, to
                the extent the law allows. We&apos;ll give at least 30 days&apos; notice of
                material changes where practicable, and you&apos;ll be asked to accept
                updated rules before you earn or redeem again. If the Program ends, we&apos;ll
                give you at least 30 days to redeem points, except where the law requires us
                to stop sooner.
              </p>
            </Section>

            <Section title="13. Sweepstakes">
              <p>
                The Program does not include any sweepstakes or contest. Any sweepstakes we
                run will have its own official rules, with no purchase necessary.
              </p>
            </Section>

            <Section title="14. Contact">
              <p>
                Questions: <a href={`mailto:${CONTACT_EMAIL}`} className="text-untamed-white underline">{CONTACT_EMAIL}</a>.
                Program sponsor: {PROGRAM_SPONSOR}, {PROGRAM_SPONSOR_ADDRESS}. These rules
                are governed by the laws of the State of Florida, without regard to its
                conflict-of-law rules.
              </p>
            </Section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-untamed-white font-semibold uppercase tracking-wider text-lg">
        {title}
      </h2>
      {children}
    </section>
  )
}
