import { NextResponse } from 'next/server'

import { bootstrapUserWorkspace } from '@/lib/auth-bootstrap'
import { createSupabaseRouteClient } from '@/lib/supabase-route'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const requestedNext = requestUrl.searchParams.get('next') || '/'
  const next = requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/'
  const skipBootstrap = requestUrl.searchParams.get('skipBootstrap') === '1'

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=oauth_missing_code', requestUrl.origin))
  }

  const supabase = await createSupabaseRouteClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data.user) {
    console.error('[auth/callback] code exchange failed', error?.message)
    return NextResponse.redirect(new URL('/login?error=oauth_callback_failed', requestUrl.origin))
  }

  if (!skipBootstrap) {
    try {
      await bootstrapUserWorkspace(data.user)
    } catch (bootstrapError) {
      console.error('[auth/callback] workspace bootstrap failed', bootstrapError)
      // Authentication has already succeeded at this point. A transient
      // workspace bootstrap failure must not send the user back to /login and
      // create an OAuth loop. The signed-in app can retry/bootstrap its data
      // independently after the session cookie has been established.
      const destination = new URL(next, requestUrl.origin)
      destination.searchParams.set('auth_warning', 'workspace_bootstrap_failed')
      return NextResponse.redirect(destination)
    }
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin))
}
