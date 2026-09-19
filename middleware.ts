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

  const isPublicMachineRoute = isPublicTopicRoute || publicApiRoutes.some((route) => pathname.startsWith(route))

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

  if (!session && isPublicMachineRoute) return res

  if (!session && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  let feedbackOnly = false
  if (session?.user) {
    const email = session.user.email?.trim().toLowerCase() ?? ''
    const { data: userFeedbackAccess } = await supabase
      .from('product_feedback_reporter_access')
      .select('access_scope,status')
      .eq('status', 'active')
      .eq('user_id', session.user.id)
      .limit(1)
      .maybeSingle()
    const { data: emailFeedbackAccess } = userFeedbackAccess ? { data: null } : await supabase
      .from('product_feedback_reporter_access')
      .select('access_scope,status')
      .eq('status', 'active')
      .eq('email', email)
      .limit(1)
      .maybeSingle()
    const feedbackAccess = userFeedbackAccess ?? emailFeedbackAccess
    feedbackOnly = feedbackAccess?.access_scope === 'feedback_only'
  }

  if (session && feedbackOnly) {
    const allowed = pathname === '/feedback' || pathname.startsWith('/api/feedback') || pathname.startsWith('/auth')
    if (!allowed) {
      if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Feedback-only account' }, { status: 403 })
      return NextResponse.redirect(new URL('/feedback', req.url))
    }
  }

  if (session && pathname === '/login') {
    return NextResponse.redirect(new URL(feedbackOnly ? '/feedback' : '/', req.url))
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|soon_core_logo.png).*)',
  ],
}
