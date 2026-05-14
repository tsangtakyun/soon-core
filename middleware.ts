import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req })
  const pathname = req.nextUrl.pathname

  if (/\.(?:png|jpg|jpeg|gif|webp|svg|ico|json|txt|xml|webmanifest)$/i.test(pathname)) {
    return res
  }

  if (!supabaseUrl || !supabaseAnonKey) return res

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

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const isPublicPath =
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/invite' ||
    pathname === '/setup-workspace' ||
    pathname.startsWith('/auth/callback')

  if (!session && !isPublicPath) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (session && pathname === '/login') {
    return NextResponse.redirect(new URL('/', req.url))
  }

  if (
    session &&
    pathname !== '/setup-workspace' &&
    pathname !== '/invite' &&
    !pathname.startsWith('/auth/callback')
  ) {
    const membershipClient =
      supabaseUrl && supabaseServiceRoleKey
        ? createClient(supabaseUrl, supabaseServiceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
          })
        : supabase

    const { data: memberships, error: membershipError } = await membershipClient
      .from('workspace_members')
      .select('id')
      .eq('user_id', session.user.id)
      .limit(1)

    if (!membershipError && !memberships?.length) {
      return NextResponse.redirect(new URL('/setup-workspace', req.url))
    }
  }

  return res
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
