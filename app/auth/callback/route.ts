import { NextResponse } from 'next/server'

import { bootstrapUserWorkspace } from '@/lib/auth-bootstrap'
import { createSupabaseRouteClient } from '@/lib/supabase-route'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/'
  const skipBootstrap = requestUrl.searchParams.get('skipBootstrap') === '1'

  if (code) {
    const supabase = await createSupabaseRouteClient()
    await supabase.auth.exchangeCodeForSession(code)
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (session?.user && !next.startsWith('/invite') && !skipBootstrap) {
      try {
        await bootstrapUserWorkspace(session.user)
      } catch {
        // Let the app load; bootstrap errors are surfaced by the client route.
      }
    }
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin))
}
