import Anthropic from '@anthropic-ai/sdk'

export const INDUSTRY_CODES = [
  'food_beverage', 'travel_experience', 'sports_wellness', 'home_living',
  'medical_aesthetics_wellness', 'beauty_cosmetics', 'trend_culture',
  'technology_information',
] as const

type IndustryCode = typeof INDUSTRY_CODES[number]
type Candidate = { key: string; text?: string | null; sourceAccount?: string | null; sourceCodes?: string[] | null }
export type IndustryClassification = {
  primaryIndustryCode: IndustryCode | null
  secondaryIndustryCodes: IndustryCode[]
  confidence: number
  status: 'classified' | 'needs_review'
}

const validCodes = new Set<string>(INDUSTRY_CODES)

function fallback(candidate: Candidate): IndustryClassification {
  const codes = (candidate.sourceCodes ?? []).filter((code): code is IndustryCode => validCodes.has(code)).slice(0, 3)
  return { primaryIndustryCode: codes[0] ?? null, secondaryIndustryCodes: codes.slice(1), confidence: 0, status: 'needs_review' }
}

export async function classifyIndustryCandidates(candidates: Candidate[]) {
  const defaults = new Map(candidates.map((candidate) => [candidate.key, fallback(candidate)]))
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || !candidates.length) return defaults

  const rows = candidates.map((candidate) => ({
    key: candidate.key,
    sourceAccount: candidate.sourceAccount,
    sourceIndustryHints: candidate.sourceCodes ?? [],
    content: (candidate.text ?? '').slice(0, 1200),
  }))
  try {
    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
      max_tokens: 5000,
      system: '你是 SOON 的逐篇社交內容分類員。來源分類只可作提示，必須按該篇內容本身分類。只輸出有效 JSON。',
      messages: [{ role: 'user', content: `將每項內容分到一個最主要行業，可有最多兩個次分類。可用 code 只有：${INDUSTRY_CODES.join(', ')}。confidence 是 0 至 1；低於 0.65 或內容不足時 status 必須是 needs_review，否則 classified。不要因來源是潮流媒體就一律選 trend_culture；美容產品、護膚及化妝內容應選 beauty_cosmetics，醫療療程及健康聲稱應選 medical_aesthetics_wellness。\n\n輸出：{"items":[{"key":"","primaryIndustryCode":"code或null","secondaryIndustryCodes":[],"confidence":0,"status":"classified|needs_review"}]}\n\n${JSON.stringify(rows)}` }],
    })
    const part = response.content.find((item) => item.type === 'text')
    if (!part || part.type !== 'text') return defaults
    const parsed = JSON.parse(part.text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim()) as { items?: Array<Record<string, unknown>> }
    for (const item of parsed.items ?? []) {
      const key = String(item.key ?? '')
      if (!defaults.has(key)) continue
      const primary = validCodes.has(String(item.primaryIndustryCode)) ? String(item.primaryIndustryCode) as IndustryCode : null
      const secondary = Array.isArray(item.secondaryIndustryCodes)
        ? item.secondaryIndustryCodes.map(String).filter((code): code is IndustryCode => validCodes.has(code) && code !== primary).slice(0, 2)
        : []
      const confidence = Math.max(0, Math.min(1, Number(item.confidence) || 0))
      defaults.set(key, { primaryIndustryCode: primary, secondaryIndustryCodes: secondary, confidence, status: primary && confidence >= 0.65 ? 'classified' : 'needs_review' })
    }
  } catch (error) {
    console.error('[industry classifier] batch failed', error)
  }
  return defaults
}
