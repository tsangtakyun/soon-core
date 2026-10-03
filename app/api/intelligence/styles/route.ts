import { NextResponse } from 'next/server'

import { authorisedStyleReader, isStyleFormat, loadPublishedStyles } from '@/lib/style-registry'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!authorisedStyleReader(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const requestedFormat = new URL(request.url).searchParams.get('format')
  if (requestedFormat && !isStyleFormat(requestedFormat)) return NextResponse.json({ error: 'Unsupported format' }, { status: 422 })
  const format = requestedFormat && isStyleFormat(requestedFormat) ? requestedFormat : undefined
  try {
    const payload = await loadPublishedStyles({ format })
    const response = NextResponse.json(payload)
    response.headers.set('ETag', `"${payload.contentHash}"`)
    response.headers.set('Cache-Control', 'private, max-age=300')
    return response
  } catch (error) {
    console.error('Published styles unavailable', error)
    return NextResponse.json({ error: 'Published styles unavailable' }, { status: 500 })
  }
}
