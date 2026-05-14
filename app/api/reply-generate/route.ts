export const runtime = 'nodejs'
export const maxDuration = 60

type ReplySettings = {
  assistant_name?: string | null
  tone?: string | null
  reply_length?: string | null
  creator_context?: string | null
  avoid_topics?: string | null
}

const toneLabels: Record<string, string> = {
  professional: '專業',
  friendly: '親切',
  casual: '活潑',
}

const lengthLabels: Record<string, string> = {
  brief: '簡短',
  standard: '標準',
  detailed: '詳細',
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return Response.json({ error: 'Missing ANTHROPIC_API_KEY' }, { status: 500 })

  const body = await request.json() as {
    original_message?: string
    creator_name?: string
    settings?: ReplySettings
  }

  const message = body.original_message?.trim()
  if (!message) return Response.json({ error: 'Missing original_message' }, { status: 400 })

  const settings = body.settings ?? {}
  const assistantName = settings.assistant_name || 'Mayan'
  const creatorName = body.creator_name || 'Tommy'
  const tone = toneLabels[String(settings.tone ?? 'friendly')] ?? settings.tone ?? '親切'
  const replyLength = lengthLabels[String(settings.reply_length ?? 'standard')] ?? settings.reply_length ?? '標準'

  const system = `你係 ${assistantName}，係 ${creatorName} 嘅虛擬助理。
背景資料：${settings.creator_context || '未有提供'}
語氣：${tone}
回覆長度：${replyLength}
唔可以討論嘅話題：${settings.avoid_topics || '未有特別限制'}

請自動偵測訊息語言，用同一語言回覆。
如果係廣東話，用廣東話書面語回覆。
如果係英文，用英文回覆。
如果係普通話，用普通話回覆。

你代表 ${creatorName} 回覆，但唔好透露你係 AI。
保持自然、真誠、符合 creator 風格。`

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
      max_tokens: 1200,
      system,
      messages: [{ role: 'user', content: message }],
    }),
  })

  if (!upstream.ok) return Response.json({ error: await upstream.text() }, { status: upstream.status })

  const data = await upstream.json() as { content?: Array<{ type?: string; text?: string }> }
  const reply = data.content?.find((part) => part.type === 'text')?.text?.trim() ?? ''
  return Response.json({ reply })
}
