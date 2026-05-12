import type { ClientBrief, ConceptSection } from '@/lib/concept-board'

export const runtime = 'nodejs'
export const maxDuration = 60

const encoder = new TextEncoder()

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return new Response('Missing ANTHROPIC_API_KEY', { status: 500 })
  }

  const body = (await request.json()) as {
    briefs?: ClientBrief[]
    concepts?: ConceptSection[]
  }

  const briefText =
    body.briefs && body.briefs.length > 0
      ? body.briefs.map((brief) => `【${brief.name}】\n${brief.content}`).join('\n\n---\n\n')
      : '未上載 Client Brief'

  const userPrompt = `以下係 Client Brief 內容：
${briefText}

以下係 Concept Board 內容：
${JSON.stringify(body.concepts ?? [], null, 2)}

請：
1. 檢查有冇錯字或語法問題
2. 檢查題目、副題、產品置入方向係咪清晰
3. 如有 Client Brief，對比 Brief 要求，指出有冇未覆蓋嘅要求
4. 每個 Concept 逐一給出建議
5. 整體評分（滿分10分）

請用廣東話書面語回答。`

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
      max_tokens: 2400,
      stream: true,
      system: '你係一個專業內容策劃顧問，專門審閱社交媒體 Concept Board。',
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!upstream.ok || !upstream.body) {
    return new Response(await upstream.text(), { status: upstream.status })
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      try {
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          const events = buffer.split('\n\n')
          buffer = events.pop() ?? ''

          for (const event of events) {
            const dataLine = event
              .split('\n')
              .find((line) => line.startsWith('data: '))
              ?.slice(6)
            if (!dataLine || dataLine === '[DONE]') continue

            try {
              const payload = JSON.parse(dataLine) as {
                type?: string
                delta?: { text?: string }
              }
              if (payload.type === 'content_block_delta' && payload.delta?.text) {
                controller.enqueue(encoder.encode(payload.delta.text))
              }
            } catch {
              // Ignore non-JSON stream bookkeeping lines.
            }
          }
        }
      } catch (error) {
        controller.error(error)
        return
      }

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  })
}
