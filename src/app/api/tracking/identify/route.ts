import { NextResponse } from 'next/server'

/**
 * Retired legacy identify beacon.
 *
 * It used to create loyalty members from any anonymous email (crediting the
 * ut_ref referrer each time) and returned an existing member's full row to
 * anyone who knew the email. No client in this app calls it any more: members
 * are created by `ensureMemberForAuthUser` after a verified portal sign-in.
 * Kept as a 410 so stale callers get a clear answer instead of a 404, and so
 * nothing here touches the database.
 */
export async function POST() {
  return NextResponse.json({ error: 'Gone' }, { status: 410 })
}
