import { resolveMember } from '@/lib/auth/resolve-member'
import { showsPackRewards } from '@/lib/rewards/preview'
import { spiritAnimalFor } from '@/lib/rewards/spirit-animals'
import { ClassicChrome } from './ClassicChrome'
import { PackChrome } from './PackChrome'

/**
 * Members in the Pack Rewards preview get the app-style chrome; everyone else
 * keeps the classic sidebar portal unchanged.
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const member = await resolveMember().catch(() => null)
  if (!member || !(await showsPackRewards(member))) return <ClassicChrome>{children}</ClassicChrome>

  const loyalty = member.loyaltyMember
  const spirit = spiritAnimalFor(loyalty?.favorite_drink_slug)
  return (
    <PackChrome
      firstName={loyalty?.first_name ?? null}
      email={member.email}
      spirit={spirit ? { name: spirit.name, color: spirit.color, art: spirit.art, habitat: spirit.habitat } : null}
      viewAs={member.viewAs ? { mode: member.viewAs.mode, adminEmail: member.viewAs.adminEmail } : null}
    >
      {children}
    </PackChrome>
  )
}
