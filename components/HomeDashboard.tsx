'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { DashboardShell } from '@/components/DashboardShell'

type Value = number | null
type Data = {
  generatedAt: string
  metrics: {
    core: { topicsPublished: Value; contentDirections: Value; contentMethods: Value; campaignLearnings: Value }
    brand: { brands: Value; campaigns: Value; connectedAccounts: Value }
    egg: { creators: Value; connectedCreators: Value }
  }
}

function Metric({ label, value, href, color = '#a78bfa' }: { label: string; value: Value; href?: string; color?: string }) {
  const body = <><span>{label}</span><strong style={{ color: value == null ? '#666' : color }}>{value == null ? '—' : value}</strong></>
  return href ? <Link className="eco-metric" href={href}>{body}</Link> : <article className="eco-metric">{body}</article>
}

export function HomeDashboard() {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/dashboard', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || '未能載入 Dashboard')
        setData(payload)
      })
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        setError(reason instanceof Error ? reason.message : '未能載入 Dashboard')
      })
    return () => controller.abort()
  }, [])

  return <DashboardShell activeSection="home">
    <main className="eco-dashboard">
      <header className="eco-header"><div><small>SOON INTELLIGENCE</small><h1>SOON Core 大腦</h1><p>將題材、內容方向、方法同 Campaign 經驗集中成可重用知識。</p></div><span>{data ? `更新於 ${new Date(data.generatedAt).toLocaleString('zh-HK')}` : '同步資料中…'}</span></header>
      {error ? <div className="eco-error" role="alert">{error}</div> : null}

      <Section title="知識資產" kicker="KNOWLEDGE BRAIN"><Metric label="已發布題材" value={data?.metrics.core.topicsPublished ?? null} href="/topic-library"/><Metric label="Content Directions" value={data?.metrics.core.contentDirections ?? null} href="/content-directions" color="#f472b6"/><Metric label="Content Methods" value={data?.metrics.core.contentMethods ?? null} href="/content-methods" color="#22d3ee"/><Metric label="Campaign Intelligence" value={data?.metrics.core.campaignLearnings ?? null} href="/campaign-experiences" color="#f59e0b"/></Section>
      <Section title="平台概況" kicker="ECOSYSTEM"><Metric label="品牌" value={data?.metrics.brand.brands ?? null}/><Metric label="Campaigns" value={data?.metrics.brand.campaigns ?? null}/><Metric label="Creators" value={data?.metrics.egg.creators ?? null}/><Metric label="已連接帳戶" value={data?.metrics.brand.connectedAccounts ?? null}/></Section>
    </main>
    <style jsx global>{`
      .eco-dashboard{display:grid;gap:20px;padding:8px 0 36px}.eco-header{display:flex;align-items:end;justify-content:space-between;gap:24px;padding:28px;border:1px solid #2a2a3a;border-radius:16px;background:linear-gradient(135deg,#181822,#101014)}.eco-header small,.eco-section small{color:#a78bfa;font-size:11px;font-weight:700;letter-spacing:.14em}.eco-header h1{margin:6px 0;font-size:32px;color:#fff}.eco-header p{margin:0;color:#9090a8}.eco-header>span{color:#666;font-size:12px}.eco-error{padding:12px;border:1px solid #7f3030;border-radius:10px;color:#fca5a5}.eco-section{padding:20px;border:1px solid #2a2a3a;border-radius:14px;background:#16161f}.eco-section>header{margin-bottom:15px}.eco-section h2{margin:4px 0 0;color:#f5f5f5;font-size:17px}.eco-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.eco-metric{display:flex;min-height:108px;flex-direction:column;justify-content:space-between;padding:16px;border:1px solid #2a2a3a;border-radius:12px;background:#111118;color:#9090a8;text-decoration:none}.eco-metric strong{font-size:32px}.eco-metric[href]:hover{border-color:#5b4bb7}@media(max-width:900px){.eco-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.eco-header{align-items:start;flex-direction:column}}@media(max-width:560px){.eco-grid{grid-template-columns:1fr}}
    `}</style>
  </DashboardShell>
}

function Section({ title, kicker, children }: { title: string; kicker: string; children: React.ReactNode }) {
  return <section className="eco-section"><header><small>{kicker}</small><h2>{title}</h2></header><div className="eco-grid">{children}</div></section>
}
