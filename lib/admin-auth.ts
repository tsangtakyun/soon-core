import { createSupabaseRouteClient } from '@/lib/supabase-route'

const ADMIN_EMAILS = new Set([
  'tsangtakyun@gmail.com',
])

export async function requireCoreAdmin() {
  const supabase = await createSupabaseRouteClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const email = session?.user?.email ?? ''

  return {
    email,
    isAdmin: ADMIN_EMAILS.has(email),
    userId: session?.user?.id ?? null,
  }
}
