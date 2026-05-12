import type { ClientBrief, ConceptSection } from '@/lib/concept-board'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'Missing ANTHROPIC_API_KEY' }, { status: 500 })
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

請以以下 JSON 格式回應，不要有任何 markdown 或額外文字：
{
  "overall_score": 8,
  "concepts": [
    {
      "concept_index": 0,
      "fields": {
        "title": { "issue": "問題描述或null", "suggestion": "建議內容或null" },
        "subtitle": { "issue": "問題描述或null", "suggestion": "建議內容或null" },
        "product_integration": [
          { "index": 0, "issue": "問題描述或null", "suggestion": "建議內容或null" }
        ],
        "breakdowns": [
          { "index": 0, "issue": "問題描述或null", "suggestion": "建議內容或null" }
        ]
      }
    }
  ],
  "general_comments": "整體建議"
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
      max_tokens: 2400,
      system: '你係一個專業內容策劃顧問。你必須只返回 JSON，不要任何其他文字。',
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
        overall_score: 0,
        concepts: [],
        general_comments: 'AI 回應不是有效 JSON，請再試一次。',
        raw_response: text,
      },
      { status: 502 }
    )
  }
}
