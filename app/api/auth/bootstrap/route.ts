import { NextResponse } from 'next/server'

import { bootstrapUserWorkspace } from '@/lib/auth-bootstrap'
import { createSupabaseRouteClient } from '@/lib/supabase-route'

export async function POST() {
  const supabase = await createSupabaseRouteClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await bootstrapUserWorkspace(session.user)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Bootstrap failed' }, { status: 500 })
  }
}
