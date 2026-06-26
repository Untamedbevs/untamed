import type { Metadata } from 'next'
import Link from 'next/link'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Terms of Service | Untamed Beverages',
  description:
    'The terms and conditions governing your use of the Untamed Beverages website, products, and programs.',
}

const LAST_UPDATED = 'June 26, 2026'

export default function TermsPage() {
  return (
    <div className="flex flex-col min-h-screen bg-untamed-black">
      <Navigation />

      <main className="flex-1 py-16 md:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <header className="mb-12">
            <h1 className="font-condensed text-4xl sm:text-5xl font-bold text-white uppercase mb-3">
              Terms of Service
            </h1>
            <p className="text-untamed-white-muted/60 text-sm">
              Last updated: {LAST_UPDATED}
            </p>
          </header>

          <div className="space-y-10 text-untamed-white-muted text-[15px] leading-relaxed">
            <section className="space-y-3">
              <p>
                These Terms of Service (&ldquo;Terms&rdquo;) govern your access to
                and use of the website, products, and programs of Untamed
                Beverages, LLC (&ldquo;Untamed,&rdquo; &ldquo;we,&rdquo;
                &ldquo;us,&rdquo; or &ldquo;our&rdquo;). By using{' '}
                <span className="text-untamed-white">untamedbeverages.com</span>{' '}
                or any of our services, you agree to these Terms.
              </p>
            </section>

            <Section title="1. Age Requirement">
              <p>
                You must be at least 21 years old to use this site, purchase our
                products, or participate in our programs. By using the site you
                represent and warrant that you are of legal drinking age in your
                jurisdiction. We reserve the right to verify age and to refuse
                service where prohibited by law.
              </p>
            </Section>

            <Section title="2. Products &amp; Alcohol">
              <p>
                Untamed sells ready-to-drink alcoholic beverages (vodka-based
                canned cocktails, 15% ALC./VOL.). Product availability, shipping,
                and sale are subject to applicable federal, state, and local
                laws. We may be unable to ship to certain jurisdictions. Please
                always drink responsibly.
              </p>
            </Section>

            <Section title="3. Orders &amp; Payment">
              <p>
                All orders are subject to acceptance and availability. We reserve
                the right to refuse or cancel any order, including for suspected
                fraud, pricing errors, or violations of these Terms. Prices and
                promotions are subject to change.
              </p>
            </Section>

            <Section title="4. Loyalty &amp; Referral Programs">
              <p>
                Our loyalty and referral programs are offered at our discretion
                and may have additional rules. Points and rewards have no cash
                value, are non-transferable except as expressly permitted, and
                may expire or be modified. We may suspend or terminate program
                participation for abuse or violation of these Terms.
              </p>
            </Section>

            <Section title="5. Email Communications">
              <p>
                By signing up for an account, loyalty membership, referral
                participation, or a wholesale inquiry, you consent to receive
                transactional emails related to your activity. Marketing emails
                are sent only with your opt-in, and you can unsubscribe at any
                time using the link in any marketing email or by emailing{' '}
                <a
                  href="mailto:unsubscribe@untamedbeverages.com"
                  className="text-panther-light hover:underline"
                >
                  unsubscribe@untamedbeverages.com
                </a>
                . See our{' '}
                <Link href="/privacy" className="text-panther-light hover:underline">
                  Privacy Policy
                </Link>{' '}
                for details.
              </p>
            </Section>

            <Section title="6. Acceptable Use">
              <p>
                You agree not to misuse the site, including by attempting to gain
                unauthorized access, interfering with its operation, scraping
                data, or using it for any unlawful purpose. You may not use our
                communications systems to send unsolicited or unlawful messages.
              </p>
            </Section>

            <Section title="7. Intellectual Property">
              <p>
                All content on the site &mdash; including logos, branding, text,
                images, and designs &mdash; is owned by or licensed to Untamed
                Beverages, LLC and is protected by intellectual property laws.
                You may not use it without our prior written permission.
              </p>
            </Section>

            <Section title="8. Disclaimers">
              <p>
                The site and services are provided &ldquo;as is&rdquo; without
                warranties of any kind, express or implied, to the fullest extent
                permitted by law. We do not warrant that the site will be
                uninterrupted, secure, or error-free.
              </p>
            </Section>

            <Section title="9. Limitation of Liability">
              <p>
                To the fullest extent permitted by law, Untamed Beverages, LLC
                will not be liable for any indirect, incidental, special,
                consequential, or punitive damages arising from your use of the
                site or products.
              </p>
            </Section>

            <Section title="10. Changes to These Terms">
              <p>
                We may update these Terms from time to time. Changes are
                effective when posted here with an updated &ldquo;Last
                updated&rdquo; date. Your continued use of the site constitutes
                acceptance of the revised Terms.
              </p>
            </Section>

            <Section title="11. Governing Law">
              <p>
                These Terms are governed by the laws of the State of Florida,
                without regard to its conflict of laws principles.
              </p>
            </Section>

            <Section title="12. Contact Us">
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
