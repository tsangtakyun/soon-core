import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req })
  const pathname = req.nextUrl.pathname
  // Machine-to-machine routes must reach their own secret validation before
  // session middleware. They are not public data endpoints: each handler
  // rejects requests without its CRON/knowledge credential.
  const publicApiRoutes = [
    '/api/invite/accept',
    '/api/auth',
    '/api/ai/generate',
    '/api/campaign-experiences/search',
    '/api/campaign-experiences/sync-brand',
    '/api/intelligence/bundle',
    '/api/intelligence/styles',
    '/api/intelligence/template-drafts',
    '/api/intelligence/dna/sync',
    '/api/cron',
  ]
  const topicApiSegment = pathname.startsWith('/api/topics/') ? pathname.slice('/api/topics/'.length) : ''
  const isPublicTopicRoute =
    pathname === '/api/topics' ||
    (Boolean(topicApiSegment) && !topicApiSegment.includes('/') && !['admin', 'assist', 'upload'].includes(topicApiSegment))

  if (isPublicTopicRoute || publicApiRoutes.some((route) => pathname.startsWith(route))) {
    return res
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return res
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          req.cookies.set(name, value)
          res = NextResponse.next({ request: req })
          res.cookies.set(name, value, options)
        })
      },
    },
  })

  // Refreshes the session and writes updated auth cookies to the response.
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const isAuthPage =
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/setup-workspace' ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/invite')

  if (!session && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (session && pathname === '/login') {
    return NextResponse.redirect(new URL('/', req.url))
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|soon_core_logo.png).*)',
  ],
}
