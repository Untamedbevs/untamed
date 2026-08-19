import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  Clock,
  DollarSign,
  Heart,
  Package,
  ShieldCheck,
  Sparkles,
  Store,
  Target,
  TrendingUp,
  Truck,
  Users,
  Wine,
  Zap,
} from 'lucide-react'
import type { SellIcon } from '@/lib/retail/sell'

export const SELL_ICONS: Record<SellIcon, LucideIcon> = {
  dollar: DollarSign,
  shield: ShieldCheck,
  trending: TrendingUp,
  package: Package,
  target: Target,
  store: Store,
  chart: BarChart3,
  sparkles: Sparkles,
  zap: Zap,
  users: Users,
  wine: Wine,
  clock: Clock,
  heart: Heart,
  truck: Truck,
}
