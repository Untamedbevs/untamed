import type { Metadata } from 'next'
import Link from 'next/link'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Privacy Policy | Untamed Beverages',
  description:
    'How Untamed Beverages, LLC collects, uses, and protects your personal information, including email communications and your choices.',
}

const LAST_UPDATED = 'June 26, 2026'

export default function PrivacyPage() {
  return (
    <div className="flex flex-col min-h-screen bg-untamed-black">
      <Navigation />

      <main className="flex-1 py-16 md:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <header className="mb-12">
            <h1 className="font-condensed text-4xl sm:text-5xl font-bold text-white uppercase mb-3">
              Privacy Policy
            </h1>
            <p className="text-untamed-white-muted/60 text-sm">
              Last updated: {LAST_UPDATED}
            </p>
          </header>

          <div className="space-y-10 text-untamed-white-muted text-[15px] leading-relaxed">
            <section className="space-y-3">
              <p>
                Untamed Beverages, LLC (&ldquo;Untamed,&rdquo; &ldquo;we,&rdquo;
                &ldquo;us,&rdquo; or &ldquo;our&rdquo;) respects your privacy.
                This Privacy Policy explains what information we collect, how we
                use it, how we communicate with you by email, and the choices you
                have. It applies to{' '}
                <span className="text-untamed-white">untamedbeverages.com</span>{' '}
                and related services.
              </p>
              <p>
                Our products are intended for adults of legal drinking age (21+).
                Our site is age-gated and we do not knowingly collect information
                from anyone under 21.
              </p>
            </section>

            <Section title="1. Information We Collect">
              <p>We collect information you provide directly to us, including:</p>
              <ul className="list-disc pl-6 space-y-1.5 mt-2">
                <li>
                  <span className="text-untamed-white">Contact details</span> —
                  name, email address, phone number, and shipping/billing
                  address when you create an account, place an order, or submit a
                  form.
                </li>
                <li>
                  <span className="text-untamed-white">
                    Loyalty &amp; referral data
                  </span>{' '}
                  — your participation in our loyalty and referral programs,
                  points, rewards, and referrals you choose to send.
                </li>
                <li>
                  <span className="text-untamed-white">
                    Trade / wholesale inquiries
                  </span>{' '}
                  — business name, role, and contact information when a retailer,
                  bar, restaurant, or distributor requests wholesale information.
                </li>
                <li>
                  <span className="text-untamed-white">
                    Communications
                  </span>{' '}
                  — messages you send us and your email engagement (opens,
                  clicks, bounces, complaints) used to maintain list quality.
                </li>
                <li>
                  <span className="text-untamed-white">Usage data</span> —
                  device, browser, and analytics data collected automatically
                  when you use our site.
                </li>
              </ul>
            </Section>

            <Section title="2. How We Use Your Information">
              <ul className="list-disc pl-6 space-y-1.5">
                <li>Process and fulfill orders and provide customer support.</li>
                <li>
                  Operate our loyalty and referral programs and deliver rewards.
                </li>
                <li>
                  Send transactional emails (order confirmations, receipts,
                  account and referral messages).
                </li>
                <li>
                  Send marketing emails about new products, offers, and updates
                  &mdash; only to recipients who have opted in.
                </li>
                <li>Respond to trade and wholesale inquiries.</li>
                <li>
                  Maintain the security, integrity, and deliverability of our
                  communications.
                </li>
                <li>Comply with legal obligations, including age verification.</li>
              </ul>
            </Section>

            <Section title="3. Email Communications &amp; Your Choices">
              <p>
                We only send marketing email to people who have opted in by
                signing up through a form on our website (loyalty enrollment,
                referral participation, or a wholesale inquiry). We do not
                purchase, rent, scrape, or import third-party email lists.
              </p>
              <p className="mt-3">You can opt out of marketing email at any time:</p>
              <ul className="list-disc pl-6 space-y-1.5 mt-2">
                <li>
                  Click the <span className="text-untamed-white">Unsubscribe</span>{' '}
                  link in the footer of any marketing email.
                </li>
                <li>
                  Use your email client&rsquo;s one-click unsubscribe button
                  (supported via the List-Unsubscribe standard).
                </li>
                <li>
                  Email{' '}
                  <a
                    href="mailto:unsubscribe@untamedbeverages.com"
                    className="text-panther-light hover:underline"
                  >
                    unsubscribe@untamedbeverages.com
                  </a>{' '}
                  and we will remove you within one business day.
                </li>
              </ul>
              <p className="mt-3">
                Unsubscribe requests are processed immediately and applied across
                all of our marketing lists. We may still send transactional
                messages related to a specific purchase, account action, or legal
                obligation.
              </p>
              <p className="mt-3">
                We automatically suppress addresses that hard-bounce or register
                a spam complaint so we do not contact them again.
              </p>
            </Section>

            <Section title="4. How We Share Information">
              <p>
                We do not sell your personal information. We share information
                only with service providers who help us operate our business,
                under contractual confidentiality obligations, including:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 mt-2">
                <li>
                  <span className="text-untamed-white">Amazon Web Services (Amazon SES)</span> — email delivery.
                </li>
                <li>
                  <span className="text-untamed-white">Supabase</span> — database and authentication.
                </li>
                <li>
                  <span className="text-untamed-white">Vercel</span> — website hosting.
                </li>
                <li>
                  Payment processors and shipping providers as needed to fulfill
                  orders.
                </li>
              </ul>
              <p className="mt-3">
                We may also disclose information to comply with the law, enforce
                our terms, or protect the rights, property, or safety of Untamed,
                our customers, or others.
              </p>
            </Section>

            <Section title="5. Data Retention">
              <p>
                We retain personal information for as long as needed to provide
                our services, comply with legal obligations, resolve disputes,
                and enforce our agreements. You may request deletion of your
                information as described below.
              </p>
            </Section>

            <Section title="6. Security">
              <p>
                We use reasonable administrative, technical, and physical
                safeguards to protect your information. No method of transmission
                or storage is completely secure, so we cannot guarantee absolute
                security.
              </p>
            </Section>

            <Section title="7. Your Rights">
              <p>
                Depending on where you live, you may have the right to access,
                correct, delete, or restrict the use of your personal
                information, and to opt out of marketing communications. To
                exercise these rights, contact us at{' '}
                <a
                  href="mailto:support@untamedbeverages.com"
                  className="text-panther-light hover:underline"
                >
                  support@untamedbeverages.com
                </a>
                .
              </p>
            </Section>

            <Section title="8. Children">
              <p>
                Our products and site are intended for adults 21 and older. We do
                not knowingly collect personal information from anyone under 21.
                If you believe a minor has provided us information, contact us and
                we will delete it.
              </p>
            </Section>

            <Section title="9. Changes to This Policy">
              <p>
                We may update this Privacy Policy from time to time. We will post
                the updated version here with a new &ldquo;Last updated&rdquo;
                date.
              </p>
            </Section>

            <Section title="10. Contact Us">
              <p>
                Untamed Beverages, LLC
                <br />
                Parrish, FL 34219, USA
                <br />
                Email:{' '}
                <a
                  href="mailto:support@untamedbeverages.com"
                  className="text-panther-light hover:underline"
                >
                  support@untamedbeverages.com
                </a>
              </p>
              <p className="mt-3">
                See also our{' '}
                <Link href="/terms" className="text-panther-light hover:underline">
                  Terms of Service
                </Link>
                .
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
