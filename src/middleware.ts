import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { VIEW_AS_COOKIE } from '@/lib/auth/view-as-cookie'

export async function middleware(request: NextRequest) {
  // View As is read-only: while an admin views the portal as a member, refuse
  // every portal write. Other portal API requests pass straight through.
  if (request.nextUrl.pathname.startsWith('/api/portal/')) {
    const isRead = request.method === 'GET' || request.method === 'HEAD'
    if (!isRead && request.cookies.has(VIEW_AS_COOKIE)) {
      return NextResponse.json(
        { error: 'VIEW_AS_READ_ONLY', message: 'View As is read-only. Exit View As to make changes.' },
        { status: 403 }
      )
    }
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_API_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as never)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  const isAdminRoute = pathname.startsWith('/admin')
  const isAdminLoginRoute = pathname === '/admin/login'

  const isPortalRoute = pathname.startsWith('/portal')
  const isPortalPublicRoute =
    pathname === '/portal/login' || pathname.startsWith('/portal/auth')

  if (isAdminRoute && !isAdminLoginRoute && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin/login'
    return NextResponse.redirect(url)
  }

  if (isAdminLoginRoute && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin'
    return NextResponse.redirect(url)
  }

  if (isPortalRoute && !isPortalPublicRoute && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/portal/login'
    url.searchParams.set('returnTo', pathname + request.nextUrl.search)
    return NextResponse.redirect(url)
  }

  if (pathname === '/portal/login' && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/portal'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/admin/:path*', '/portal/:path*', '/api/portal/:path*'],
}
