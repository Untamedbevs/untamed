import { NextResponse } from 'next/server'

/**
 * Retired legacy receipt route.
 *
 * It accepted an anonymous memberId, filed a pending receipt on that member and
 * returned an upload URL for any file type under that member's prefix. Its
 * only client (src/components/loyalty/ReceiptUpload.tsx) is no longer used;
 * members upload receipts through the signed-in portal route
 * (/api/portal/receipts). Kept as a 410 so nothing here touches the database
 * or S3.
 */
export async function POST() {
  return NextResponse.json({ error: 'Gone' }, { status: 410 })
}
