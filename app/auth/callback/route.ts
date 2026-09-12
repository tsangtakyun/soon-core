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
      return NextResponse.redirect(new URL('/login?error=workspace_bootstrap_failed', requestUrl.origin))
    }
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin))
}
