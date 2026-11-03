import { AlertCircle } from 'lucide-react'
import {
  enrollmentStatus,
  INELIGIBLE_MESSAGES,
  type IneligibleReason,
  type MemberProgramFields,
} from '@/lib/rewards/eligibility'
import { EnrollmentCard } from './EnrollmentCard'

const ENROLLABLE: IneligibleReason[] = [
  'not_enrolled',
  'rules_updated',
  'enrollment_expired',
  'state_not_eligible',
]

/**
 * Renders nothing for an enrolled, eligible member. Otherwise shows the
 * enrollment form (when the member can fix it themselves) or an explanation.
 */
export function ProgramStatusNotice({ member }: { member: MemberProgramFields }) {
  const status = enrollmentStatus(member)
  if (status.ok) return null

  if (ENROLLABLE.includes(status.reason)) {
    return <EnrollmentCard reason={status.reason} defaultState={member.residence_state} />
  }

  return (
    <div className="flex items-start gap-3 bg-[#141414] border border-red-500/30 rounded-2xl p-5 text-sm text-[#D0D0D0]">
      <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
      <p>{INELIGIBLE_MESSAGES[status.reason]}</p>
    </div>
  )
}

export function isProgramActive(member: MemberProgramFields): boolean {
  return enrollmentStatus(member).ok
}
