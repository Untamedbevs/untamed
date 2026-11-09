import type { Metadata } from 'next'
import { Sparkles, Tag, Users } from 'lucide-react'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'
import { EmailSignupForm, type SignupListOption } from '@/components/EmailSignupForm'
import { getPublicSignupLists } from '@/lib/email/signup'

// Ad landing page. Deliberately not under /email/: it keeps the age gate,
// pixels, and page-view tracking that email-link pages skip.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Get First Word | Untamed Beverages',
  description:
    'New flavors, limited drops, and offers from Untamed Beverages, straight to your inbox. 21+ only.',
}

const PERKS = [
  { icon: Sparkles, title: 'New drinks first', text: 'New flavors, limited releases, and restocks before they sell out.' },
  { icon: Tag, title: 'Offers', text: 'Bundles, discounts, and shop promotions.' },
  { icon: Users, title: 'The pack', text: 'Points events, rewards, and news from the community.' },
]

/** Topics for the form; on failure the form fetches them itself. */
async function loadLists(): Promise<SignupListOption[] | undefined> {
  try {
    return await getPublicSignupLists()
  } catch (err) {
    console.error('[subscribe] list lookup failed:', err instanceof Error ? err.message : err)
    return undefined
  }
}

export default async function SubscribePage() {
  const lists = await loadLists()

  return (
    <div className="flex flex-col min-h-screen bg-untamed-black">
      <Navigation />

      <main className="relative flex-1 overflow-hidden py-12 md:py-20 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-[150px] opacity-20 bg-panther" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full blur-[140px] opacity-10 bg-lioness" />
        </div>

        <div className="relative max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#9B30FF] mb-4">
              Untamed email
            </p>
            <h1 className="font-condensed text-4xl md:text-6xl font-bold uppercase tracking-wider text-untamed-white mb-4">
              Get <span className="font-wild cyber-brush-fix text-gradient-wild">First Word</span>
            </h1>
            <p className="text-untamed-white-muted text-base md:text-lg max-w-xl mx-auto">
              Premium ready-to-serve vodka martinis, and the first to hear what&apos;s next. Pick
              your topics; unsubscribe any time.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-3 mb-8">
            {PERKS.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-2xl border border-card-border bg-untamed-black-card p-5">
                <Icon className="w-5 h-5 text-[#9B30FF] mb-3" />
                <p className="text-untamed-white font-semibold text-sm mb-1">{title}</p>
                <p className="text-untamed-white-muted text-xs leading-relaxed">{text}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-card-border bg-[#111] p-6 md:p-8">
            <EmailSignupForm variant="full" placement="subscribe" lists={lists} />
          </div>

          <p className="text-center text-xs text-untamed-white-muted/60 mt-6">
            For adults 21 and over. Please enjoy responsibly.
          </p>
        </div>
      </main>

      <Footer showSignup={false} />
    </div>
  )
}
