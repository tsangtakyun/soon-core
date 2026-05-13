export const runtime = 'nodejs'
export const maxDuration = 60

function splitDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
  if (!match) return { media_type: 'image/jpeg', data: dataUrl }
  return { media_type: match[1], data: match[2] }
}

async function convertCurrency(amount: number, from: string, to: string) {
  const fromCode = normaliseCurrencyCode(from)
  const toCode = normaliseCurrencyCode(to)
  if (!amount || fromCode === toCode) return { converted_amount: amount, exchange_rate: 1, converted_currency: to }
  try {
    const response = await fetch(`https://api.frankfurter.app/latest?from=${fromCode}&to=${toCode}`)
    const data = await response.json() as { rates?: Record<string, number> }
    const rate = Number(data.rates?.[toCode] ?? 1)
    return { converted_amount: amount * rate, exchange_rate: rate, converted_currency: to }
  } catch {
    return { converted_amount: amount, exchange_rate: 1, converted_currency: to }
  }
}

function normaliseCurrencyCode(value: string) {
  const upper = value.toUpperCase()
  if (upper.includes('HK')) return 'HKD'
  if (upper.includes('USD')) return 'USD'
  if (upper.includes('GBP')) return 'GBP'
  if (upper.includes('EUR')) return 'EUR'
  if (upper.includes('SGD')) return 'SGD'
  if (upper.includes('TWD')) return 'TWD'
  if (upper.includes('CNY') || upper.includes('RMB')) return 'CNY'
  return upper.replace(/[^A-Z]/g, '').slice(0, 3) || 'HKD'
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return Response.json({ error: 'Missing ANTHROPIC_API_KEY' }, { status: 500 })

  const body = await request.json() as { image?: string; targetCurrency?: string }
  if (!body.image) return Response.json({ error: 'Missing receipt image' }, { status: 400 })
  const image = splitDataUrl(body.image)
  const prompt = `分析呢張收據，提取以下資料，以 JSON 格式回應：
{
  "merchant": "商店名稱",
  "date": "YYYY-MM-DD",
  "items": ["item1", "item2"],
  "original_amount": 123.45,
  "original_currency": "HKD",
  "category": "餐飲/交通/器材租借/住宿/道具/廣告費/軟件訂閱/製作費/人工/雜項",
  "notes": "備注"
}
如果唔確定就填 null。只返回 JSON。`

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 900,
      system: '你係一個財務助理，專門分析收據。只返回 JSON。',
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: image.media_type, data: image.data } },
          { type: 'text', text: prompt },
        ],
      }],
    }),
  })

  if (!upstream.ok) return Response.json({ error: await upstream.text() }, { status: upstream.status })
  const data = await upstream.json() as { content?: Array<{ type?: string; text?: string }> }
  const text = data.content?.find((part) => part.type === 'text')?.text ?? '{}'
  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim()
  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>
    const amount = Number(parsed.original_amount ?? 0)
    const conversion = await convertCurrency(amount, String(parsed.original_currency ?? body.targetCurrency ?? 'HKD'), body.targetCurrency ?? 'HK$')
    return Response.json({ ...parsed, ...conversion })
  } catch {
    return Response.json({ error: 'Claude receipt response was not valid JSON', raw_response: text }, { status: 502 })
  }
}
