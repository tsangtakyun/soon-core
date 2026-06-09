import { NextResponse } from 'next/server'

import { createSupabaseRouteClient } from '@/lib/supabase-route'

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseRouteClient>>

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

type ScheduleRow = {
  id: string
  notes: string | null
}

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

async function getSession() {
  const supabase = await createSupabaseRouteClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  return { supabase, user: session?.user ?? null }
}

function normalizeTime(value: string | null) {
  if (!value) return null
  const match = value.match(/^(\d{1,2}):(\d{2})/)
  if (!match) return null
  return `${match[1].padStart(2, '0')}:${match[2]}`
}

function calcEndTime(startTime: string | null, duration: string | null) {
  if (!startTime) return null

  const minutesToAdd = (durationMinutes[duration || ''] ?? Number(duration || 0)) || 0
  if (!minutesToAdd) return null

  const [hours, minutes] = startTime.split(':').map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null

  const total = hours * 60 + minutes + minutesToAdd
  const endHours = Math.floor(total / 60) % 24
  const endMinutes = total % 60
  return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`
}

function addDays(dateString: string, offset: number) {
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + offset))
  return date.toISOString().slice(0, 10)
}

function buildNotes(trip: TripRow, shot: ShotRow, marker: string) {
  return [
    `來源：${marker}`,
    `行程：${trip.name || 'Untitled Trip'}`,
    `平台：${shot.platform || '-'}`,
    `時段：${shot.time_of_day || '-'}`,
    `需時：${shot.duration || '-'}`,
  ].join('\n')
}

async function findExistingSchedule(
  supabase: SupabaseClient,
  userId: string,
  marker: string,
  fallback: { date: string; title: string; startTime: string | null }
) {
  const markerResult = await supabase
    .from('schedules')
    .select('id')
    .eq('user_id', userId)
    .ilike('notes', `%${marker}%`)
    .limit(1)
    .maybeSingle()

  if (markerResult.error) throw markerResult.error
  if (markerResult.data?.id) return markerResult.data.id as string

  const fallbackBaseQuery = supabase
    .from('schedules')
    .select('id')
    .eq('user_id', userId)
    .eq('date', fallback.date)
    .eq('title', fallback.title)

  const fallbackQuery = fallback.startTime
    ? fallbackBaseQuery.eq('start_time', fallback.startTime).limit(1)
    : fallbackBaseQuery.limit(1)

  const fallbackResult = await fallbackQuery.maybeSingle()
  if (fallbackResult.error) throw fallbackResult.error

  return fallbackResult.data?.id as string | undefined
}

export async function POST() {
  try {
    const { supabase, user } = await getSession()

    if (!user?.id) {
      return NextResponse.json({ error: '未登入，請重新登入。' }, { status: 401 })
    }

    const { data: trips, error: tripError } = await supabase
      .from('trips')
      .select('id, name, start_date, end_date')
      .order('created_at', { ascending: false })
      .limit(1)

    if (tripError) throw tripError
    if (!trips?.length) {
      return NextResponse.json({ error: '未有行程可同步。' }, { status: 400 })
    }

    const trip = trips[0] as TripRow
    const { data: shots, error: shotsError } = await supabase
      .from('shots')
      .select('id, trip_id, seq, name, day, start_time, time_of_day, duration, platform, location')
      .eq('trip_id', trip.id)
      .order('seq', { ascending: true })

    if (shotsError) throw shotsError
    if (!shots?.length) {
      return NextResponse.json({ error: '未有場景可同步。' }, { status: 400 })
    }

    const markers = new Set<string>()
    let synced = 0

    for (const [index, shot] of (shots as ShotRow[]).entries()) {
      const marker = `prod-mgt:${trip.id}:${shot.id}`
      markers.add(marker)

      const dayOffset = Math.max((shot.day ?? 1) - 1, 0)
      const date = addDays(trip.start_date, dayOffset)
      const startTime = normalizeTime(shot.start_time)
      const title = shot.name?.trim() || `場景 ${shot.seq ?? index + 1}`
      const payload = {
        workspace_id: null,
        user_id: user.id,
        title,
        type: '拍攝',
        date,
        start_time: startTime,
        end_time: calcEndTime(startTime, shot.duration),
        location: shot.location?.trim() || null,
        notes: buildNotes(trip, shot, marker),
        reminder: false,
        status: '即將到來',
      }

      const existingId = await findExistingSchedule(supabase, user.id, marker, {
        date,
        title,
        startTime,
      })

      const result = existingId
        ? await supabase.from('schedules').update(payload).eq('id', existingId).eq('user_id', user.id)
        : await supabase.from('schedules').insert(payload)

      if (result.error) throw result.error
      synced += 1
    }

    const staleResult = await supabase
      .from('schedules')
      .select('id, notes')
      .eq('user_id', user.id)
      .ilike('notes', `%prod-mgt:${trip.id}:%`)

    if (staleResult.error) throw staleResult.error

    const staleIds = ((staleResult.data ?? []) as ScheduleRow[])
      .filter((row) => {
        const noteMarker = row.notes?.match(/prod-mgt:[^\s]+/)?.[0]
        return noteMarker ? !markers.has(noteMarker) : false
      })
      .map((row) => row.id)

    if (staleIds.length > 0) {
      const { error: deleteError } = await supabase.from('schedules').delete().in('id', staleIds).eq('user_id', user.id)
      if (deleteError) throw deleteError
    }

    return NextResponse.json({
      ok: true,
      synced,
      removed: staleIds.length,
      tripName: trip.name || 'Untitled Trip',
      shotCount: shots.length,
    })
  } catch (error) {
    console.error('[schedule sync]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '同步失敗，請稍後再試。' },
      { status: 500 }
    )
  }
}
