import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { resolveMember } from '@/lib/auth/resolve-member'
import { VIEW_AS_COOKIE } from '@/lib/auth/view-as'

export const dynamic = 'force-dynamic'

/** GET /api/portal/view-as — who the portal is showing, when an admin is in View As. */
export async function GET() {
  if (!(await cookies()).has(VIEW_AS_COOKIE)) return NextResponse.json({ active: false })

  const member = await resolveMember()
  if (!member?.viewAs) return NextResponse.json({ active: false })

  return NextResponse.json({
    active: true,
    mode: member.viewAs.mode,
    adminEmail: member.viewAs.adminEmail,
    member: { email: member.email, firstName: member.loyaltyMember?.first_name ?? null },
  })
}
