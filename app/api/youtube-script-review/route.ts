import type { BlockType, SegmentType } from '@/lib/youtube-script'

export const runtime = 'nodejs'
export const maxDuration = 60

type ReviewBlock = {
  type: BlockType | 'other'
  typeLabel: string
  speaker: string
  content: string
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'Missing ANTHROPIC_API_KEY' }, { status: 500 })
  }

  const body = (await request.json()) as {
    segmentType: SegmentType
    segmentTypeLabel: string
    segmentTitle: string
    blocks: ReviewBlock[]
  }

  const blockText = body.blocks
    .map((block, index) => {
      const speaker = block.speaker ? ` / Speaker: ${block.speaker}` : ''
      return `Block ${index}
Type: ${block.typeLabel}${speaker}
Content:
${block.content}`
    })
    .join('\n\n---\n\n')

  const userPrompt = `請審閱以下 YouTube 腳本段落：

段落類型：${body.segmentTypeLabel}
段落標題：${body.segmentTitle || '(未命名)'}
內容：
${blockText || '(沒有內容)'}

請以 JSON 格式回應，不要 markdown，不要額外文字：
{
  "overall": "整體評語（1-2句）",
  "score": 8,
  "blocks": [
    {
      "block_index": 0,
      "type": "對白",
      "issue": "問題描述或null",
      "suggestion": "建議修改內容或null"
    }
  ],
  "clarity": "清晰度評語",
  "typos": "錯字或語法問題，冇就填null"
}`

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
      max_tokens: 1800,
      system: '你係一個專業 YouTube 內容顧問，專門審閱廣東話短片腳本。你必須只返回 JSON，不要任何其他文字。',
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!upstream.ok) {
    return Response.json({ error: await upstream.text() }, { status: upstream.status })
  }

  const data = (await upstream.json()) as {
    content?: Array<{ type?: string; text?: string }>
  }
  const text = data.content?.find((part) => part.type === 'text')?.text ?? '{}'
  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim()

  try {
    return Response.json(JSON.parse(cleaned))
  } catch {
    return Response.json(
      {
        overall: 'AI 回應不是有效 JSON，請稍後重試。',
        score: 0,
        blocks: [],
        clarity: '',
        typos: null,
        raw_response: text,
      },
      { status: 502 }
    )
  }
}
