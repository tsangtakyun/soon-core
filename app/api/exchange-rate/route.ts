export const runtime = 'nodejs'
export const maxDuration = 20

function normaliseCurrencyCode(value: string | null) {
  const upper = String(value ?? '').toUpperCase()
  if (upper.includes('HK')) return 'HKD'
  if (upper.includes('USD')) return 'USD'
  if (upper.includes('GBP') || upper.includes('£')) return 'GBP'
  if (upper.includes('EUR') || upper.includes('€')) return 'EUR'
  if (upper.includes('SGD')) return 'SGD'
  if (upper.includes('TWD') || upper.includes('NT')) return 'TWD'
  if (upper.includes('CNY') || upper.includes('RMB') || upper.includes('¥')) return 'CNY'
  if (upper.includes('JPY')) return 'JPY'
  return upper.replace(/[^A-Z]/g, '').slice(0, 3) || 'HKD'
}

async function fetchFrankfurterRate(from: string, to: string) {
  const response = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`, { cache: 'no-store' })
  if (!response.ok) throw new Error('Frankfurter request failed')
  const data = await response.json() as { rates?: Record<string, number> }
  const rate = Number(data.rates?.[to])
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('Frankfurter rate missing')
  return rate
}

async function fetchOpenRate(from: string, to: string) {
  const response = await fetch(`https://open.er-api.com/v6/latest/${from}`, { cache: 'no-store' })
  if (!response.ok) throw new Error('Fallback rate request failed')
  const data = await response.json() as { rates?: Record<string, number>; result?: string }
  const rate = Number(data.rates?.[to])
  if (data.result === 'error' || !Number.isFinite(rate) || rate <= 0) throw new Error('Fallback rate missing')
  return rate
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const from = normaliseCurrencyCode(searchParams.get('from'))
  const to = normaliseCurrencyCode(searchParams.get('to'))

  if (from === to) return Response.json({ from, to, rate: 1, source: 'same_currency' })

  try {
    const rate = await fetchFrankfurterRate(from, to)
    return Response.json({ from, to, rate, source: 'frankfurter' })
  } catch {
    try {
      const rate = await fetchOpenRate(from, to)
      return Response.json({ from, to, rate, source: 'open.er-api' })
    } catch {
      return Response.json({ error: `Unable to fetch exchange rate ${from} to ${to}` }, { status: 502 })
    }
  }
}
