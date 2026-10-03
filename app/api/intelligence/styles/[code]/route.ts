import { NextResponse } from 'next/server'

import { authorisedStyleReader, loadPublishedStyles } from '@/lib/style-registry'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  if (!authorisedStyleReader(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { code } = await context.params
  if (!/^[a-z][a-z0-9_]{2,79}$/.test(code)) return NextResponse.json({ error: 'Invalid style code' }, { status: 400 })
  try {
    const payload = await loadPublishedStyles({ code })
    if (!payload.styles.length) return NextResponse.json({ error: 'Published style not found' }, { status: 404 })
    const response = NextResponse.json({ ...payload, style: payload.styles[0], styles: undefined })
    response.headers.set('ETag', `"${payload.contentHash}"`)
    response.headers.set('Cache-Control', 'private, max-age=300')
    return response
  } catch (error) {
    console.error('Published style unavailable', error)
    return NextResponse.json({ error: 'Published style unavailable' }, { status: 500 })
  }
}
