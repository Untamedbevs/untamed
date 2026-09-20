import { NextRequest, NextResponse } from 'next/server'
import { resolveStaff } from '@/lib/auth/resolve-staff'
import { getMetaAdsConfigStatus, isMetaAdsConfigured } from '@/lib/ads/meta-graph'
import {
  extractAction,
  getAdAccountIdRaw,
  getInsights,
  LEAD_ACTION_TYPES,
  listCampaigns,
  testMetaAdsConnection,
} from '@/lib/ads/meta-client'
import {
  FL_RETAIL_CAMPAIGNS,
  FL_RETAIL_TOTAL_DAILY_CENTS,
  dailyBudgetDollars,
  trackedLandingUrl,
} from '@/lib/ads/fl-retail-structure'
import { existingFlRetailCampaigns } from '@/lib/ads/meta-bootstrap'

export async function GET(request: NextRequest) {
  const staff = await resolveStaff()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const datePreset = request.nextUrl.searchParams.get('date_preset') || 'last_30d'
  const config = getMetaAdsConfigStatus()

  const structure = FL_RETAIL_CAMPAIGNS.map((spec) => ({
    ...spec,
    dailyBudget: dailyBudgetDollars(spec.dailyBudgetCents),
    landingUrl: trackedLandingUrl(spec),
  }))

  if (!isMetaAdsConfigured()) {
    return NextResponse.json({
      config,
      connection: { configured: false, ok: false, missingScopes: ['ads_management', 'ads_read'] },
      campaigns: [],
      structure,
      structureDailyBudget: dailyBudgetDollars(FL_RETAIL_TOTAL_DAILY_CENTS),
      existingStructureCount: 0,
      adsManagerUrl: null,
    })
  }

  const connection = await testMetaAdsConnection()

  try {
    const campaigns = await listCampaigns(100)
    const withInsights = await Promise.all(
      campaigns.slice(0, 25).map(async (campaign) => {
        try {
          const insights = (await getInsights(campaign.id, datePreset))[0] || null
          return {
            ...campaign,
            insights,
            leads: extractAction(insights?.actions, LEAD_ACTION_TYPES),
          }
        } catch {
          return { ...campaign, insights: null, leads: 0 }
        }
      })
    )

    const accountId = getAdAccountIdRaw()
    return NextResponse.json({
      config,
      connection,
      campaigns: withInsights,
      structure,
      structureDailyBudget: dailyBudgetDollars(FL_RETAIL_TOTAL_DAILY_CENTS),
      existingStructureCount: existingFlRetailCampaigns(campaigns).length,
      adsManagerUrl: accountId
        ? `https://www.facebook.com/adsmanager/manage/campaigns?act=${accountId}`
        : null,
    })
  } catch (error) {
    return NextResponse.json(
      {
        config,
        connection,
        campaigns: [],
        structure,
        structureDailyBudget: dailyBudgetDollars(FL_RETAIL_TOTAL_DAILY_CENTS),
        existingStructureCount: 0,
        adsManagerUrl: null,
        error: error instanceof Error ? error.message : 'Failed to load campaigns',
      },
      { status: 200 }
    )
  }
}
