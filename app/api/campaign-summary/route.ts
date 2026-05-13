export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return Response.json({ error: 'Missing ANTHROPIC_API_KEY' }, { status: 500 })
  const body = await request.json()
  const userPrompt = `以下係一個品牌活動嘅數據：
${JSON.stringify(body, null, 2)}

請生成：
1. 執行摘要（3-4句，highlight最重要數字）
2. 整體表現分析（重點、亮點、不足）
3. 下次活動建議（具體可行嘅改善方向）

只以 JSON 回應：
{
  "executive_summary": "...",
  "performance_analysis": "...",
  "recommendations": "..."
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
      system: '你係一個專業社交媒體數據分析師。請用廣東話書面語回答。你必須只返回 JSON。',
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })
  if (!upstream.ok) return Response.json({ error: await upstream.text() }, { status: upstream.status })
  const data = await upstream.json() as { content?: Array<{ type?: string; text?: string }> }
  const text = data.content?.find((part) => part.type === 'text')?.text ?? '{}'
  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim()
  try {
    return Response.json(JSON.parse(cleaned))
  } catch {
    return Response.json({ error: 'Claude response is not JSON', raw_response: text }, { status: 502 })
  }
}
