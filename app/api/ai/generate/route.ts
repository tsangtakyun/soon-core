import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      prompt,
      model = 'claude-haiku-4-5-20251001',
      max_tokens,
      maxTokens,
      system,
      messages,
    } = body ?? {}
    const resolvedMessages = Array.isArray(messages)
      ? messages
      : prompt
        ? [{ role: 'user' as const, content: prompt }]
        : []

    if (resolvedMessages.length === 0) {
      return NextResponse.json({ error: 'No prompt' }, { status: 400 })
    }

    const message = await client.messages.create({
      model,
      max_tokens: max_tokens ?? maxTokens ?? 1024,
      ...(system ? { system } : {}),
      messages: resolvedMessages,
    })

    return NextResponse.json({ content: message.content })
  } catch {
    return NextResponse.json(
      { error: 'AI generation failed' },
      { status: 500 }
    )
  }
}
