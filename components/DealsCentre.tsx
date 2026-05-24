'use client'

import { useEffect, useMemo, useState } from 'react'

import { supabase } from '@/lib/supabase'
import { DashboardShell } from '@/components/DashboardShell'
import PageHeader from '@/components/PageHeader'

type DealActivityType = 'kol_accepted' | 'brief_received' | 'kol_onboarded' | string

type DealActivityMeta = {
  creator_username?: string
  creator_display_name?: string
  creator_avatar_url?: string
  creator_ig_handle?: string
  creator_ig_followers?: number
  creator_mediakit_url?: string
  campaign_name?: string
  brand_name?: string
  brand_website?: string
  budget_range?: string
  budget?: string
  collab_formats?: string[]
  deliverables?: string[]
  starts_on?: string
  timeline?: string
  dos?: string
  donts?: string
  brief_title?: string
  cw_workspace_id?: string
  cw_campaign_id?: string
}

type DealActivity = {
  id: string
  type: DealActivityType
  title: string
  body: string | null
  meta: DealActivityMeta | null
  is_read: boolean
  assigned_to: string | null
  created_at: string
}

const icons: Record<string, string> = {
  kol_accepted: '🤝',
  brief_received: '📋',
  kol_onboarded: '🥚',
}

const assignees = ['Tommy', 'Dingding', 'Panda', 'Renee']

function startOfToday() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

function startOfWeek() {
  const date = startOfToday()
  const day = date.getDay() || 7
  date.setDate(date.getDate() - day + 1)
  return date
}

export function DealsCentre() {
  const [activities, setActivities] = useState<DealActivity[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    void loadActivities()

    const channel = supabase
      .channel('deals_centre_activities')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'deals_activities' }, (payload) => {
        setActivities((current) => [payload.new as DealActivity, ...current])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'deals_activities' }, (payload) => {
        const nextActivity = payload.new as DealActivity
        setActivities((current) => current.map((activity) => activity.id === nextActivity.id ? nextActivity : activity))
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])

  async function loadActivities() {
    setLoading(true)
    setError('')

    const { data, error: loadError } = await supabase
      .from('deals_activities')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (loadError) {
      setError(loadError.message)
      setActivities([])
    } else {
      setActivities((data ?? []) as DealActivity[])
    }

    setLoading(false)
  }

  const metrics = useMemo(() => {
    const today = startOfToday().getTime()
    const week = startOfWeek().getTime()

    return {
      unread: activities.filter((activity) => !activity.is_read).length,
      today: activities.filter((activity) => new Date(activity.created_at).getTime() >= today).length,
      weeklyDeals: activities.filter((activity) => activity.type === 'kol_accepted' && new Date(activity.created_at).getTime() >= week).length,
    }
  }, [activities])

  async function handleRead(id: string) {
    setActivities((current) => current.map((activity) => activity.id === id ? { ...activity, is_read: true } : activity))

    const { error: updateError } = await supabase
      .from('deals_activities')
      .update({ is_read: true })
      .eq('id', id)

    if (updateError) {
      window.alert('標記已讀失敗：' + updateError.message)
      void loadActivities()
    }
  }

  async function handleAssign(id: string, assignee: string) {
    const nextAssignee = assignee || null
    setActivities((current) => current.map((activity) => activity.id === id ? { ...activity, assigned_to: nextAssignee } : activity))

    const { error: updateError } = await supabase
      .from('deals_activities')
      .update({ assigned_to: nextAssignee })
      .eq('id', id)

    if (updateError) {
      window.alert('分配負責人失敗：' + updateError.message)
      void loadActivities()
    }
  }

  return (
    <DashboardShell activeSection="deals">
      <PageHeader
        icon="💼"
        title="交易中心"
        subtitle="監測 SOON-EGG 合作活動，分配跟進人員"
      />

      <main style={{ padding: '0 28px 32px' }}>
        <section style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: '14px',
          marginBottom: '18px',
        }}>
          <KpiCard label="未處理" value={metrics.unread} accent="#7c3aed" />
          <KpiCard label="今日新增" value={metrics.today} accent="#0ea5e9" />
          <KpiCard label="本週合作" value={metrics.weeklyDeals} accent="#10b981" />
        </section>

        <section style={{
          background: '#141414',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '14px',
          padding: '18px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h2 style={{ color: '#f5f5f5', fontSize: '16px', margin: 0 }}>合作活動</h2>
              <p style={{ color: '#888888', fontSize: '12px', margin: '4px 0 0' }}>最新 SOON-EGG 事件會即時出現在這裡。</p>
            </div>
            <button
              type="button"
              onClick={() => void loadActivities()}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '8px',
                color: '#a78bfa',
                cursor: 'pointer',
                fontSize: '12px',
                padding: '8px 12px',
              }}
            >
              重新整理
            </button>
          </div>

          {loading && <EmptyState text="載入交易活動中..." />}
          {!loading && error && <EmptyState text={`載入失敗：${error}`} />}
          {!loading && !error && activities.length === 0 && <EmptyState text="暫時未有合作活動" />}

          {!loading && !error && activities.length > 0 && (
            <div style={{ display: 'grid', gap: '10px' }}>
              {activities.map((activity) => (
                <ActivityRow
                  key={activity.id}
                  activity={activity}
                  isExpanded={expandedId === activity.id}
                  onToggle={() => setExpandedId((current) => current === activity.id ? null : activity.id)}
                  onRead={handleRead}
                  onAssign={handleAssign}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </DashboardShell>
  )
}

function KpiCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <article style={{
      background: '#141414',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '14px',
      padding: '18px',
    }}>
      <p style={{ color: '#888888', fontSize: '12px', margin: '0 0 8px' }}>{label}</p>
      <strong style={{ color: accent, display: 'block', fontSize: '30px', lineHeight: 1 }}>{value}</strong>
    </article>
  )
}

function ActivityRow({
  activity,
  isExpanded,
  onToggle,
  onRead,
  onAssign,
}: {
  activity: DealActivity
  isExpanded: boolean
  onToggle: () => void
  onRead: (id: string) => void
  onAssign: (id: string, assignee: string) => void
}) {
  const meta = activity.meta ?? {}

  return (
    <article style={{
      background: activity.is_read ? 'transparent' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${activity.is_read ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.10)'}`,
      borderRadius: '14px',
      opacity: activity.is_read ? 0.6 : 1,
      overflow: 'hidden',
      transition: '0.15s ease',
    }}>
      <div
        onClick={onToggle}
        style={{
          alignItems: 'flex-start',
          cursor: 'pointer',
          display: 'flex',
          gap: '14px',
          padding: '14px',
        }}
      >
        <span style={{ fontSize: '24px', marginTop: '2px', flexShrink: 0 }}>{icons[activity.type] ?? '📌'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: '#ffffff', fontSize: '14px', fontWeight: 600, margin: 0 }}>{activity.title}</p>
          {activity.body && (
            <p style={{ color: '#888888', fontSize: '12px', margin: '4px 0 0' }}>{activity.body}</p>
          )}
          <p style={{ color: '#555555', fontSize: '11px', margin: '6px 0 0' }}>
            {new Date(activity.created_at).toLocaleString('zh-HK')}
          </p>
        </div>
        <div onClick={(event) => event.stopPropagation()} style={{ display: 'flex', alignItems: 'center', flexShrink: 0, gap: '8px' }}>
          <select
            value={activity.assigned_to ?? ''}
            onChange={(event) => onAssign(activity.id, event.target.value)}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: '8px',
              color: '#d1d5db',
              fontSize: '12px',
              padding: '7px 8px',
            }}
          >
            <option value="">未分配</option>
            {assignees.map((assignee) => (
              <option key={assignee} value={assignee}>{assignee}</option>
            ))}
          </select>
          {!activity.is_read && (
            <button
              type="button"
              onClick={() => onRead(activity.id)}
              style={{
                background: 'transparent',
                border: '1px solid rgba(167,139,250,0.3)',
                borderRadius: '8px',
                color: '#a78bfa',
                cursor: 'pointer',
                fontSize: '12px',
                padding: '7px 10px',
              }}
            >
              ✓
            </button>
          )}
          <span style={{ color: '#555555', fontSize: '11px' }}>{isExpanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {isExpanded && (
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.05)',
          display: 'grid',
          gap: '12px',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          padding: '12px 14px 14px',
        }}>
          {meta.creator_username && (
            <div style={{
              alignItems: 'center',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '10px',
              display: 'flex',
              gap: '12px',
              gridColumn: '1 / -1',
              padding: '12px',
            }}>
              {meta.creator_avatar_url && <img src={meta.creator_avatar_url} alt="" style={{ width: '40px', height: '40px', borderRadius: '999px', objectFit: 'cover' }} />}
              <div style={{ flex: 1 }}>
                <p style={{ color: '#ffffff', fontSize: '13px', fontWeight: 600, margin: 0 }}>{meta.creator_display_name || meta.creator_username}</p>
                <p style={{ color: '#9ca3af', fontSize: '12px', margin: '3px 0 0' }}>
                  @{meta.creator_ig_handle || meta.creator_username}
                  {meta.creator_ig_followers ? ` · ${meta.creator_ig_followers.toLocaleString()} followers` : ''}
                </p>
              </div>
              {meta.creator_mediakit_url && (
                <a href={meta.creator_mediakit_url} target="_blank" rel="noopener noreferrer" style={{
                  border: '1px solid rgba(167,139,250,0.3)',
                  borderRadius: '8px',
                  color: '#a78bfa',
                  fontSize: '12px',
                  padding: '7px 10px',
                  textDecoration: 'none',
                }}>
                  Media Kit ↗
                </a>
              )}
            </div>
          )}

          {meta.campaign_name && <DetailCard label="Campaign" value={meta.campaign_name} />}
          {meta.brand_name && <DetailCard label="品牌" value={meta.brand_name} link={meta.brand_website} />}
          {meta.budget_range && <DetailCard label="預算" value={meta.budget_range} />}
          {meta.budget && <DetailCard label="預算" value={meta.budget} />}
          {meta.starts_on && <DetailCard label="開始日期" value={meta.starts_on} />}
          {meta.timeline && <DetailCard label="時間表" value={meta.timeline} />}
          {meta.collab_formats && meta.collab_formats.length > 0 && <ListCard label="合作形式" values={meta.collab_formats} />}
          {meta.deliverables && meta.deliverables.length > 0 && <ListCard label="交付物" values={meta.deliverables} />}
          {meta.dos && <DetailCard label="✅ 要做" value={meta.dos} />}
          {meta.donts && <DetailCard label="❌ 唔做" value={meta.donts} />}
        </div>
      )}
    </article>
  )
}

function DetailCard({ label, value, link }: { label: string; value: string; link?: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '10px', padding: '12px' }}>
      <p style={{ color: '#6b7280', fontSize: '11px', margin: '0 0 5px' }}>{label}</p>
      <p style={{ color: '#ffffff', fontSize: '12px', margin: 0 }}>{value}</p>
      {link && <a href={link} target="_blank" rel="noopener noreferrer" style={{ color: '#a78bfa', display: 'block', fontSize: '12px', marginTop: '4px' }}>{link}</a>}
    </div>
  )
}

function ListCard({ label, values }: { label: string; values: string[] }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '10px', padding: '12px' }}>
      <p style={{ color: '#6b7280', fontSize: '11px', margin: '0 0 7px' }}>{label}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
        {values.map((value) => (
          <span key={value} style={{ background: 'rgba(255,255,255,0.10)', borderRadius: '999px', color: '#d1d5db', fontSize: '11px', padding: '3px 8px' }}>{value}</span>
        ))}
      </div>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{
      border: '1px dashed rgba(255,255,255,0.10)',
      borderRadius: '12px',
      color: '#888888',
      fontSize: '13px',
      padding: '28px',
      textAlign: 'center',
    }}>
      {text}
    </div>
  )
}
