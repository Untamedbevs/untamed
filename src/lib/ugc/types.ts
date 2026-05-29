export type UgcStatus = 'pending' | 'approved' | 'rejected' | 'featured'
export type UgcContributorType = 'loyalty' | 'distributor' | 'staff'
export type UgcAssetType = 'image' | 'video'
export type UgcProcessingStatus =
  | 'uploaded'
  | 'processing'
  | 'ready'
  | 'failed'

export interface UgcSubmissionAsset {
  id: string
  submission_id: string
  asset_type: UgcAssetType
  s3_key: string
  url: string
  mime_type: string | null
  processed_urls: {
    '1080p'?: string
    '720p'?: string
    original?: string
    thumb?: string
  } | null
  mediaconvert_job_id: string | null
  processing_status: UgcProcessingStatus
  width: number | null
  height: number | null
  duration_seconds: number | null
  file_size_bytes: number | null
  display_order: number
  created_at: string
}

export interface UgcSubmission {
  id: string
  auth_user_id: string
  contributor_type: UgcContributorType
  loyalty_member_id: string | null
  distributor_lead_id: string | null
  contributor_email: string | null
  contributor_display_name: string | null
  caption: string | null
  drink_slug: string | null
  tags: string[]
  location: string | null
  consent_granted: boolean
  consent_signature: string | null
  consent_at: string | null
  status: UgcStatus
  is_public: boolean
  reviewed_by: string | null
  reviewed_at: string | null
  rejection_reason: string | null
  promoted_media_ids: string[]
  points_awarded: number
  created_at: string
  updated_at: string
}

export interface UgcSubmissionWithAssets extends UgcSubmission {
  assets: UgcSubmissionAsset[]
}

export const POINTS_PER_UGC_APPROVED = 50
export const POINTS_PER_UGC_FEATURED = 150
