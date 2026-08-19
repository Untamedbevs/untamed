import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getRetailLandingPage, RETAIL_LP_SLUGS } from '@/lib/retail/landing-pages'
import { RetailCampaignLanding } from './RetailCampaignLanding'

export function generateStaticParams() {
  return RETAIL_LP_SLUGS.map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const page = getRetailLandingPage(slug)
  if (!page) return { title: 'Untamed Beverages' }
  return {
    title: page.title,
    description: page.subhead,
    robots: { index: false, follow: false },
    openGraph: {
      title: page.title,
      description: page.subhead,
      images: ['/images/logo-mark.png'],
    },
  }
}

export default async function RetailLpPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const page = getRetailLandingPage(slug)
  if (!page) notFound()
  return <RetailCampaignLanding page={page} />
}
