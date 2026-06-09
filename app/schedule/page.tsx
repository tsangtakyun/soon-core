'use client'

import { Suspense, useState, type MouseEvent } from 'react'
import { createClient } from '@supabase/supabase-js'

import { DashboardShell } from '@/components/DashboardShell'
import PageHeader from '@/components/PageHeader'

console.log('[schedule page] loaded, version 8fc25d3')

const iframeHeight = 'calc(100vh - 48px - 73px - 184px)'
const tommyUserId = 'bb3e47cc-90c8-4eac-a5ff-cabfcefb89ae'

const durationMinutes: Record<string, number> = {
  '30': 30,
  '60': 60,
  '120': 120,
  '180': 180,
  '240': 240,
  '360': 360,
  '30分': 30,
  '1小時': 60,
  '2小時': 120,
  '3小時': 180,
  '4小時': 240,
  '半日': 360,
}

type TripRow = {
  id: string
  name: string | null
  start_date: string
  end_date: string | null
}

type ShotRow = {
  id: string
  trip_id: string
  seq: number | null
  name: string | null
  day: number | null
  start_time: string | null
  time_of_day: string | null
  duration: string | null
  platform: string | null
  location: string | null
}

function calcEndTime(startTime: string, duration: string | null) {
  const minutesToAdd = (durationMinutes[duration || ''] ?? Number(duration || 0)) || 0
  const [hours, minutes] = startTime.split(':').map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return startTime

  const total = hours * 60 + minutes + minutesToAdd
  const endHours = Math.floor(total / 60) % 24
  const endMinutes = total % 60
  return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`
}

function buildRundownContent(trip: TripRow, shots: ShotRow[]) {
  return {
    type: 'rundown',
    trip: {
      name: trip.name || 'Untitled Trip',
      date: trip.start_date,
      total_shots: shots.length,
    },
    shots: shots.map((shot, index) => ({
      seq: shot.seq ?? index + 1,
      name: shot.name || '',
      day: shot.day ?? 0,
      time: shot.start_time ? `${shot.start_time} - ${calcEndTime(shot.start_time, shot.duration)}` : '-',
      time_of_day: shot.time_of_day || '',
      duration: shot.duration || '',
      platform: shot.platform || '',
      location: shot.location || '',
    })),
  }
}

export default function SchedulePage() {
  const [iframeError, setIframeError] = useState(false)
  const [savingRundown, setSavingRundown] = useState(false)
  const [syncingSchedule, setSyncingSchedule] = useState(false)

  function openRundownPrint() {
    const params = new URLSearchParams()
    const tripId = new URLSearchParams(window.location.search).get('tripId')

    if (tripId) params.set('tripId', tripId)
    params.set('print', 'true')

    window.open(`https://prod-mgt.vercel.app?${params.toString()}`, '_blank', 'noopener,noreferrer')
  }

  async function handleSaveRundown(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    console.log('[saveRundown] clicked')

    if (savingRundown) {
      console.log('[saveRundown] ignored: already saving')
      return
    }

    setSavingRundown(true)
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const { data: trips, error: tripErr } = await supabase
        .from('trips')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)

      if (tripErr || !trips?.length) {
        if (tripErr) console.error('[saveRundown] trip error:', tripErr)
        window.alert('未有行程可儲存')
        return
      }

      const trip = trips[0] as TripRow
      console.log('[saveRundown] trip:', trip.name)

      const { data: shots, error: shotsErr } = await supabase
        .from('shots')
        .select('*')
        .eq('trip_id', trip.id)
        .order('seq', { ascending: true })

      if (shotsErr) {
        console.error('[saveRundown] shots error:', shotsErr)
        window.alert(`讀取場景失敗：${shotsErr.message}`)
        return
      }

      console.log('[saveRundown] shots:', shots?.length)

      const { error } = await supabase.from('docs').insert({
        workspace_id: null,
        title: `${trip.name || 'Untitled Trip'} - Rundown`,
        template_type: 'rundown',
        content: JSON.stringify({ trip, shots: shots || [] }),
      })

      if (error) {
        console.error('[saveRundown] insert error:', error)
        window.alert(`儲存失敗：${error.message}`)
        return
      }

      window.dispatchEvent(new Event('soon-data-updated'))
      window.alert('✅ Rundown 已儲存至文件中心')
    } catch (error) {
      console.error('[saveRundown]', error)
      window.alert(error instanceof Error ? `儲存失敗：${error.message}` : '儲存失敗：請重試。')
    } finally {
      setSavingRundown(false)
    }
  }

  async function handleSyncSchedule(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()

    if (syncingSchedule) return

    setSyncingSchedule(true)
    try {
      const response = await fetch('/api/schedule/sync', { method: 'POST' })
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string
        synced?: number
        removed?: number
        tripName?: string
      }

      if (!response.ok) {
        window.alert(payload.error || '同步失敗，請稍後再試。')
        return
      }

      window.dispatchEvent(new Event('soon-data-updated'))
      const removedText = payload.removed ? `，並移除 ${payload.removed} 個舊日程` : ''
      window.alert(`✅ 已同步 ${payload.synced ?? 0} 個日程到 App${removedText}`)
    } catch (error) {
      console.error('[syncSchedule]', error)
      window.alert(error instanceof Error ? `同步失敗：${error.message}` : '同步失敗，請稍後再試。')
    } finally {
      setSyncingSchedule(false)
    }
  }

  return (
    <Suspense>
      <DashboardShell activeSection="schedule">
        <section className="schedule-frame-page">
          <PageHeader
            icon="✈️"
            title="行程中心"
            subtitle="管理拍攝行程同場景安排"
            actions={(
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={openRundownPrint}
                  style={{
                    background: 'transparent',
                    color: '#0ea5e9',
                    border: '1px solid #0ea5e9',
                    borderRadius: 'var(--soon-radius)',
                    fontSize: '13px',
                    padding: '8px 16px',
                    cursor: 'pointer',
                    fontFamily: 'system-ui',
                  }}
                >
                  🖨️ 列印 PDF
                </button>
                <button
                  type="button"
                  disabled={savingRundown}
                  onClick={(event) => void handleSaveRundown(event)}
                  style={{
                    background: 'var(--soon-purple)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 'var(--soon-radius)',
                    fontSize: '13px',
                    padding: '8px 16px',
                    cursor: savingRundown ? 'not-allowed' : 'pointer',
                    fontFamily: 'system-ui',
                    opacity: savingRundown ? 0.65 : 1,
                  }}
                >
                  {savingRundown ? '儲存中...' : '💾 儲存至文件中心'}
                </button>
                <button
                  type="button"
                  disabled={syncingSchedule}
                  onClick={(event) => void handleSyncSchedule(event)}
                  style={{
                    background: syncingSchedule ? 'rgba(245, 158, 11, 0.35)' : '#f59e0b',
                    color: '#111827',
                    border: 'none',
                    borderRadius: 'var(--soon-radius)',
                    fontSize: '13px',
                    padding: '8px 16px',
                    cursor: syncingSchedule ? 'not-allowed' : 'pointer',
                    fontFamily: 'system-ui',
                    fontWeight: 700,
                  }}
                >
                  {syncingSchedule ? '同步中...' : '🔄 同步到 App 日程'}
                </button>
              </div>
            )}
          />

          <div style={{ padding: '0 28px', marginBottom: '24px' }}>
            <img
              src="/schedule-banner.jpg"
              alt="行程中心"
              style={{
                width: '100%',
                height: '160px',
                objectFit: 'cover',
                objectPosition: 'center',
                borderRadius: '12px',
                display: 'block',
              }}
            />
          </div>

          {iframeError ? (
            <div
              style={{
                height: iframeHeight,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: '12px',
                border: '1px solid var(--soon-border)',
                borderRadius: '12px',
                background: 'var(--soon-surface)',
                color: 'var(--soon-text)',
                padding: '24px',
                margin: '0 28px',
                textAlign: 'center',
              }}
            >
              <p style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>行程中心載入失敗</p>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--soon-text-secondary)' }}>
                請直接開啟 prod-mgt.vercel.app，或者稍後再試。
              </p>
              <a
                href="https://prod-mgt.vercel.app"
                target="_blank"
                rel="noreferrer"
                style={{
                  marginTop: '4px',
                  color: '#fff',
                  background: 'var(--soon-purple)',
                  borderRadius: '8px',
                  padding: '9px 16px',
                  fontSize: '13px',
                  textDecoration: 'none',
                }}
              >
                開啟行程中心
              </a>
            </div>
          ) : (
            <iframe
              src="https://prod-mgt.vercel.app?embedded=true"
              title="行程中心"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              referrerPolicy="no-referrer-when-downgrade"
              allow="clipboard-read; clipboard-write; fullscreen"
              onError={() => setIframeError(true)}
              style={{ width: '100%', height: iframeHeight, border: 'none' }}
            />
          )}
        </section>
      </DashboardShell>
    </Suspense>
  )
}
