import Image from 'next/image'
import { Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ORDER_STATUS, formatUsd, type MemberOrder, type OrderLine } from '@/lib/rewards/orders'
import './portal.css'

const dateLabel = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

/** One product from an order as a picture card: the drink's can over its colors, with the cat behind it. */
export function ProductTile({
  line,
  order,
  className,
}: {
  line: OrderLine
  order: Pick<MemberOrder, 'placedAt' | 'status'>
  className?: string
}) {
  const d = line.drink
  const color = d?.color ?? '#9B30FF'
  const status = ORDER_STATUS[order.status] ?? { label: order.status, tone: '#A0A0A0' }
  return (
    <article
      className={cn('pk-tile group relative flex h-80 flex-col justify-end overflow-hidden rounded-[26px] border border-white/10', className)}
      style={{
        background: `radial-gradient(120% 80% at 50% 0%, ${d?.colorLight ?? color}66, transparent 60%), linear-gradient(180deg, ${d?.colorDark ?? '#222'}, #070709 85%)`,
        boxShadow: `0 30px 60px -35px ${color}`,
      }}
    >
      {d && (
        <Image
          src={d.animalImage}
          alt=""
          width={260}
          height={388}
          className="absolute -right-10 top-0 h-[85%] w-auto object-contain opacity-40 mix-blend-luminosity transition-opacity duration-500 group-hover:opacity-60"
        />
      )}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4">
        <span className="rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider backdrop-blur" style={{ color: status.tone }}>
          {status.label}
        </span>
        <span className="rounded-full bg-black/50 px-2.5 py-1 font-headline text-sm backdrop-blur">×{line.quantity}</span>
      </div>
      {d ? (
        <Image
          src={d.canImage}
          alt={d.name}
          width={110}
          height={288}
          className="pk-can absolute left-1/2 top-9 h-[58%] w-auto -translate-x-1/2 object-contain drop-shadow-[0_24px_24px_rgba(0,0,0,0.75)]"
        />
      ) : (
        <Package className="absolute left-1/2 top-16 h-20 w-20 -translate-x-1/2 text-white/30" />
      )}
      <div className="relative bg-gradient-to-t from-black via-black/80 to-transparent p-4 pt-10">
        <div className="font-headline text-2xl uppercase leading-none" style={{ color: d?.colorLight ?? '#fff' }}>
          {d?.name ?? 'Untamed'}
        </div>
        <div className="mt-1 truncate text-xs text-white/70">{d?.flavor ?? line.title}</div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 text-[11px] text-white/50">
          <span>{line.title.replace(/\s+-\s+/, ' ')}</span>
          <span>{dateLabel(order.placedAt)}</span>
        </div>
      </div>
    </article>
  )
}

/** Recent purchases as a swipeable row of product cards. */
export function OrderStrip({ orders }: { orders: MemberOrder[] }) {
  const tiles = orders.flatMap((o) => o.lines.map((line, i) => ({ key: `${o.id}-${i}`, line, order: o })))
  if (tiles.length === 0) return null
  return (
    <div className="pk-snap -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
      {tiles.slice(0, 10).map((t) => (
        <ProductTile key={t.key} line={t.line} order={t.order} className="w-56 shrink-0 sm:w-60" />
      ))}
    </div>
  )
}

/** Every order with its products as picture cards, for the Orders page. */
export function OrderHistory({ orders }: { orders: MemberOrder[] }) {
  return (
    <div className="space-y-10">
      {orders.map((o, i) => (
        <section key={o.id} className="pk-enter" style={{ ['--i' as string]: i + 1 }}>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b border-white/10 pb-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/50">Order · {dateLabel(o.placedAt)}</div>
              <div className="mt-1 font-headline text-2xl uppercase">
                {o.packCount} pack{o.packCount === 1 ? '' : 's'} <span className="text-white/40">/</span> {formatUsd(o.totalCents)}
              </div>
            </div>
            {o.pointsAwarded > 0 && (
              <span className="rounded-full border border-[#FFD700]/30 bg-[#FFD700]/10 px-3 py-1 text-xs font-semibold text-[#FFD700]">
                +{o.pointsAwarded.toLocaleString('en-US')} pts
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {o.lines.map((line, j) => (
              <ProductTile key={j} line={line} order={o} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
