export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return Response.json({ error: 'Missing ANTHROPIC_API_KEY' }, { status: 500 })

  const body = (await request.json()) as { meeting: unknown }
  const userPrompt = `請審閱以下會議記錄：
${JSON.stringify(body.meeting, null, 2)}

請只返回 JSON，不要 markdown，不要額外文字：
{
  "overall": "整體評語",
  "score": 8,
  "issues": [
    { "section": "agenda/discussion/action_items/next_steps", "issue": "問題", "suggestion": "建議" }
  ],
  "missing": "有冇缺漏嘅重要資訊",
  "clarity": "清晰度評語"
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
      max_tokens: 1600,
      system: '你係一個專業會議記錄顧問。你必須只返回 JSON，不要任何其他文字。',
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!upstream.ok) return Response.json({ error: await upstream.text() }, { status: upstream.status })

  const data = (await upstream.json()) as { content?: Array<{ type?: string; text?: string }> }
  const text = data.content?.find((part) => part.type === 'text')?.text ?? '{}'
  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim()

  try {
    return Response.json(JSON.parse(cleaned))
  } catch {
    return Response.json({ overall: 'AI 回應不是有效 JSON，請稍後重試。', score: 0, issues: [], raw_response: text }, { status: 502 })
  }
}
