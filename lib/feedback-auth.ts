import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseRouteClient } from '@/lib/supabase-route'

const CORE_ADMIN_EMAILS = new Set(['tsangtakyun@gmail.com'])

export type FeedbackActor = {
  userId: string
  email: string
  isAdmin: boolean
  feedbackOnly: boolean
}

export async function requireFeedbackActor(): Promise<FeedbackActor | null> {
  const sessionClient = await createSupabaseRouteClient()
  const { data: { user: cookieUser } } = await sessionClient.auth.getUser()
  let user = cookieUser

  // Some existing Core sessions were issued by the older auth-helper flow.
  // Validate their access token with Supabase Auth before accepting the user;
  // never trust the locally decoded getSession() payload by itself.
  if (!user) {
    const { data: { session } } = await sessionClient.auth.getSession()
    if (session?.access_token) {
      const admin = createSupabaseAdmin()
      const { data: { user: verifiedUser } } = await admin.auth.getUser(session.access_token)
      user = verifiedUser
    }
  }
  const email = user?.email?.trim().toLowerCase() ?? ''
  if (!user || !email) return null

  if (CORE_ADMIN_EMAILS.has(email)) {
    return { userId: user.id, email, isAdmin: true, feedbackOnly: false }
  }

  const admin = createSupabaseAdmin()
  const { data: userAccess } = await admin
    .from('product_feedback_reporter_access')
    .select('id,user_id,role,access_scope,status')
    .eq('status', 'active')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()
  const { data: emailAccess } = userAccess ? { data: null } : await admin
    .from('product_feedback_reporter_access')
    .select('id,user_id,role,access_scope,status')
    .eq('status', 'active')
    .eq('email', email)
    .limit(1)
    .maybeSingle()
  const access = userAccess ?? emailAccess

  if (!access) return null
  if (!access.user_id) {
    await admin.from('product_feedback_reporter_access').update({ user_id: user.id }).eq('id', access.id)
  }

  return {
    userId: user.id,
    email,
    isAdmin: access.role === 'triage_admin',
    feedbackOnly: access.access_scope === 'feedback_only',
  }
}

export async function canReadFeedbackReport(reportId: string, actor: FeedbackActor) {
  const admin = createSupabaseAdmin()
  let query = admin.from('product_feedback_reports').select('id,reporter_user_id').eq('id', reportId)
  if (!actor.isAdmin) query = query.eq('reporter_user_id', actor.userId)
  const { data } = await query.maybeSingle()
  return Boolean(data)
}
