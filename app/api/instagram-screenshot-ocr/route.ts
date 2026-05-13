export const runtime = 'nodejs'
export const maxDuration = 60

type ScreenshotInput = {
  screenshots?: string[]
}

function splitDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
  if (!match) return { media_type: 'image/jpeg', data: dataUrl }
  return { media_type: match[1], data: match[2] }
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return Response.json({ error: 'Missing ANTHROPIC_API_KEY' }, { status: 500 })

  const body = (await request.json()) as ScreenshotInput
  const screenshots = (body.screenshots ?? []).slice(0, 5)
  if (!screenshots.length) return Response.json({ error: 'Missing screenshots' }, { status: 400 })

  const imageParts = screenshots.map((screenshot) => {
    const image = splitDataUrl(screenshot)
    return {
      type: 'image',
      source: {
        type: 'base64',
        media_type: image.media_type,
        data: image.data,
      },
    }
  })

  const prompt = `請分析呢啲 Instagram Insights 截圖，
提取以下數字，以 JSON 格式回應，
冇數據就填 null：
{
  "views": null,
  "likes": null,
  "comments": null,
  "saves": null,
  "shares": null,
  "profile_activity": null,
  "reach": null,
  "watch_time": null,
  "avg_watch_time": null,
  "skip_rate": null,
  "retention_rate": null,
  "audience_gender": {
    "male": null,
    "female": null
  },
  "traffic_sources": [
    {"source": "動態消息", "percentage": null}
  ]
}
只返回 JSON，不要其他文字。`

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: [...imageParts, { type: 'text', text: prompt }],
        },
      ],
    }),
  })

  if (!upstream.ok) return Response.json({ error: await upstream.text() }, { status: upstream.status })

  const data = (await upstream.json()) as { content?: Array<{ type?: string; text?: string }> }
  const text = data.content?.find((part) => part.type === 'text')?.text ?? '{}'
  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim()

  try {
    return Response.json(JSON.parse(cleaned))
  } catch {
    return Response.json({ error: 'Claude Vision response was not valid JSON', raw_response: text }, { status: 502 })
  }
}
