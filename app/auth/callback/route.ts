import { NextResponse } from 'next/server'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseRouteClient } from '@/lib/supabase-route'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createSupabaseRouteClient()
    await supabase.auth.exchangeCodeForSession(code)
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (session?.user && !next.startsWith('/invite')) {
      const admin = createSupabaseAdmin()
      const { data: memberships } = await admin
        .from('workspace_members')
        .select('id')
        .eq('user_id', session.user.id)
        .limit(1)

      if (!memberships?.length) {
        return NextResponse.redirect(new URL('/setup-workspace', requestUrl.origin))
      }
    }
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin))
}
