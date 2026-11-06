import { redirect } from 'next/navigation'
import { ShoppingBag } from 'lucide-react'
import { resolveMember } from '@/lib/auth/resolve-member'
import { createAdminClient } from '@/lib/supabase/admin'
import { showsPackRewards } from '@/lib/rewards/preview'
import { formatUsd, loadMemberOrders } from '@/lib/rewards/orders'
import { OrderHistory } from '@/components/rewards/OrderGallery'

export const dynamic = 'force-dynamic'

/** Pack Rewards: every online order, each product shown as its own picture card. */
export default async function PortalOrdersPage() {
  const member = await resolveMember()
  if (!member?.loyaltyMember || !(await showsPackRewards(member))) redirect('/portal')

  const orders = await loadMemberOrders(createAdminClient(), {
    id: member.loyaltyMember.id,
    email: member.loyaltyMember.email,
  }, 60)
  const cans = orders.reduce((sum, o) => sum + o.packCount * 4, 0)
  const spent = orders.reduce((sum, o) => sum + o.totalCents, 0)
  const flavors = new Set(orders.flatMap((o) => o.lines.map((l) => l.drink?.slug).filter(Boolean))).size

  return (
    <div className="space-y-10">
      <header className="pk-enter pk-glass overflow-hidden p-6 sm:p-8">
        <div className="text-[11px] font-semibold uppercase tracking-[0.35em]" style={{ color: 'var(--pk-accent)' }}>
          Your haul
        </div>
        <h1 className="mt-2 font-headline text-5xl uppercase leading-none sm:text-6xl">Orders</h1>
        {orders.length > 0 ? (
          <div className="mt-6 grid grid-cols-3 gap-3 sm:max-w-lg">
            {[
              [cans.toLocaleString('en-US'), 'cans poured'],
              [`${flavors}/4`, 'flavors tried'],
              [formatUsd(spent), 'all-time'],
            ].map(([value, label]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-black/30 p-3">
                <div className="font-headline text-2xl sm:text-3xl">{value}</div>
                <div className="text-[11px] uppercase tracking-wider text-white/50">{label}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-white/65">Nothing here yet. Online orders show up here with every flavor you bought.</p>
        )}
        <a
          href="/shop"
          className="mt-6 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-black"
          style={{ background: 'linear-gradient(100deg, var(--pk-accent), #FFD700)' }}
        >
          <ShoppingBag className="h-4 w-4" /> Shop Untamed
        </a>
      </header>
      <OrderHistory orders={orders} />
    </div>
  )
}
