export const runtime = 'nodejs'
export const maxDuration = 60

type ReceiptResult = {
  merchant?: string | null
  date?: string | null
  items?: string[] | null
  original_amount?: number | null
  original_currency?: string | null
  category?: string | null
  notes?: string | null
}

function splitDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return { media_type: 'image/jpeg', data: dataUrl }
  return { media_type: match[1], data: match[2] }
}

async function convertCurrency(amount: number, from: string, to: string) {
  const fromCode = normaliseCurrencyCode(from)
  const toCode = normaliseCurrencyCode(to)
  if (!amount || fromCode === toCode) return { converted_amount: amount, exchange_rate: 1, converted_currency: toCode }
  try {
    const rate = await fetchExchangeRate(fromCode, toCode)
    return { converted_amount: amount * rate, exchange_rate: rate, converted_currency: toCode }
  } catch {
    return { converted_amount: amount, exchange_rate: null, converted_currency: toCode }
  }
}

async function fetchExchangeRate(from: string, to: string) {
  try {
    const response = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`, { cache: 'no-store' })
    if (!response.ok) throw new Error('Frankfurter request failed')
    const data = await response.json() as { rates?: Record<string, number> }
    const rate = Number(data.rates?.[to])
    if (!Number.isFinite(rate) || rate <= 0) throw new Error('Frankfurter rate missing')
    return rate
  } catch {
    const response = await fetch(`https://open.er-api.com/v6/latest/${from}`, { cache: 'no-store' })
    if (!response.ok) throw new Error('Fallback rate request failed')
    const data = await response.json() as { rates?: Record<string, number>; result?: string }
    const rate = Number(data.rates?.[to])
    if (data.result === 'error' || !Number.isFinite(rate) || rate <= 0) throw new Error('Fallback rate missing')
    return rate
  }
}

function normaliseCurrencyCode(value: string) {
  const upper = value.toUpperCase()
  if (upper.includes('HK')) return 'HKD'
  if (upper.includes('USD')) return 'USD'
  if (upper.includes('GBP') || upper.includes('£')) return 'GBP'
  if (upper.includes('EUR') || upper.includes('€')) return 'EUR'
  if (upper.includes('SGD')) return 'SGD'
  if (upper.includes('TWD')) return 'TWD'
  if (upper.includes('CNY') || upper.includes('RMB') || upper.includes('¥')) return 'CNY'
  if (upper.includes('JPY')) return 'JPY'
  return upper.replace(/[^A-Z]/g, '').slice(0, 3) || 'HKD'
}

function stripJsonFence(text: string) {
  return text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim()
}

function toReceiptArray(value: unknown): ReceiptResult[] {
  if (Array.isArray(value)) return value as ReceiptResult[]
  if (value && typeof value === 'object') return [value as ReceiptResult]
  return []
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return Response.json({ error: 'Missing ANTHROPIC_API_KEY' }, { status: 500 })

  const body = await request.json() as { file?: string; image?: string; targetCurrency?: string }
  const inputFile = body.file ?? body.image
  if (!inputFile) return Response.json({ error: 'Missing receipt file' }, { status: 400 })

  const file = splitDataUrl(inputFile)
  const isPdf = file.media_type === 'application/pdf'
  const filePart = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: file.data } }
    : { type: 'image', source: { type: 'base64', media_type: file.media_type, data: file.data } }

  const prompt = `分析呢份收據/文件，可能包含多張單據。
請提取所有單據，以 JSON array 格式回應：
[
  {
    "merchant": "商店名稱",
    "date": "YYYY-MM-DD",
    "items": ["item1", "item2"],
    "original_amount": 123.45,
    "original_currency": "HKD",
    "category": "餐飲/交通/器材租借/住宿/道具/廣告費/軟件訂閱/製作費/人工/雜項",
    "notes": "備注"
  }
]
如果只有一張單，都要返回 array（只有一個 element）。
如果唔確定就填 null。
只返回 JSON array，不要其他文字。`

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1800,
      system: '你係一個財務助理，專門分析收據。你必須只返回 JSON array，不要任何其他文字。',
      messages: [{
        role: 'user',
        content: [
          filePart,
          { type: 'text', text: prompt },
        ],
      }],
    }),
  })

  if (!upstream.ok) return Response.json({ error: await upstream.text() }, { status: upstream.status })
  const data = await upstream.json() as { content?: Array<{ type?: string; text?: string }> }
  const text = data.content?.find((part) => part.type === 'text')?.text ?? '[]'
  const cleaned = stripJsonFence(text)
  try {
    const parsed = toReceiptArray(JSON.parse(cleaned))
    const receipts = await Promise.all(parsed.map(async (receipt) => {
      const amount = Number(receipt.original_amount ?? 0)
      const conversion = await convertCurrency(amount, String(receipt.original_currency ?? body.targetCurrency ?? 'HKD'), body.targetCurrency ?? 'HK$')
      return { ...receipt, ...conversion }
    }))
    return Response.json({ receipts })
  } catch {
    return Response.json({ error: 'Claude receipt response was not valid JSON array', raw_response: text }, { status: 502 })
  }
}
