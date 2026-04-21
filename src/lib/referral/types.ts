export interface ReferralParticipant {
  id: string
  loyalty_member_id: string
  email: string
  referral_code: string
  display_name: string | null
  referred_by_participant_id: string | null
  total_clicks: number
  consumer_signups: number
  distributor_leads: number
  paid_conversions: number
  custom_message: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ReferralCodeHistory {
  id: string
  participant_id: string
  old_code: string
  replaced_at: string
}

export type ReferralEventType =
  | 'click_consumer'
  | 'click_distributor'
  | 'consumer_signup'
  | 'distributor_lead'
  | 'paid_conversion'
  | 'referral_sent'

export interface ReferralEvent {
  id: string
  participant_id: string
  event_type: ReferralEventType
  referred_email: string | null
  ip_hash: string | null
  user_agent: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export type RewardType = 'points' | 'free_product' | 'discount' | 'merch' | 'custom'

export interface ReferralRewardTier {
  id: string
  tier_name: string
  tier_order: number
  min_consumer_signups: number
  min_distributor_leads: number
  min_paid_conversions: number
  reward_type: RewardType
  reward_value: Record<string, unknown>
  description: string | null
  is_active: boolean
  created_at: string
}

export interface ReferralRewardEarned {
  id: string
  participant_id: string
  tier_id: string
  is_claimed: boolean
  claimed_at: string | null
  earned_at: string
  tier?: ReferralRewardTier
}

export type InviteType = 'consumer' | 'distributor'
export type InviteStatus = 'sent' | 'opened' | 'clicked' | 'converted'

export interface ReferralInvite {
  id: string
  participant_id: string
  referred_email: string
  referred_name: string | null
  invite_type: InviteType
  status: InviteStatus
  sent_at: string
  opened_at: string | null
  clicked_at: string | null
  converted_at: string | null
}

export type DistributorBusinessType =
  | 'bar_restaurant'
  | 'liquor_store'
  | 'distributor'
  | 'event_venue'
  | 'other'

export type VolumeInterest = 'small' | 'medium' | 'large'

export type DistributorLeadStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'negotiating'
  | 'converted'
  | 'declined'

export interface DistributorLead {
  id: string
  business_name: string
  contact_name: string
  email: string
  phone: string | null
  location: string | null
  business_type: DistributorBusinessType
  volume_interest: VolumeInterest | null
  message: string | null
  referral_participant_id: string | null
  status: DistributorLeadStatus
  admin_notes: string | null
  created_at: string
  updated_at: string
}

export interface ReferralDashboardData {
  participant: ReferralParticipant
  tiers: ReferralRewardTier[]
  rewards: ReferralRewardEarned[]
  invites: ReferralInvite[]
  consumerLink: string
  distributorLink: string
}
