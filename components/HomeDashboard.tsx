'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { DashboardShell } from '@/components/DashboardShell'
import { useWorkspace } from '@/app/context/workspace-context'
import { getPipelinePath, getProjectPipeline } from '@/lib/pipelines'
import { supabase } from '@/lib/supabase'
import type { Project } from '@/lib/types'

type IdeaPreview = {
  id: string
  title: string
  viral_score: number | null
  country?: string | null
  tags?: string[] | null
}

type YoutubeSignalPreview = {
  id: string
  topic_zh: string | null
  max_outlier_ratio: number | null
  signal_count?: number | null
}

function InstagramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="soon-home-instagram" x1="4" x2="20" y1="20" y2="4" gradientUnits="userSpaceOnUse">
          <stop stopColor="#feda75" />
          <stop offset="0.3" stopColor="#fa7e1e" />
          <stop offset="0.55" stopColor="#d62976" />
          <stop offset="0.8" stopColor="#962fbf" />
          <stop offset="1" stopColor="#4f5bd5" />
        </linearGradient>
      </defs>
      <rect x="3" y="3" width="18" height="18" rx="5" fill="url(#soon-home-instagram)" />
      <circle cx="12" cy="12" r="4" fill="none" stroke="white" strokeWidth="1.8" />
      <circle cx="17" cy="7" r="1.2" fill="white" />
    </svg>
  )
}

function YouTubeIcon() {
  return (
    <svg width="22" height="20" viewBox="0 0 28 20" aria-hidden="true" style={{ display: 'block' }}>
      <rect width="28" height="20" rx="5" fill="#ff0033" />
      <path d="M11 6.2v7.6L18 10z" fill="white" />
    </svg>
  )
}

function getStatusColor(status: string) {
  if (!status) return { bg: '#2a2a3a', text: '#9090a8' }
  if (status.includes('未拍攝') || status.includes('1.')) return { bg: '#ef4444', text: 'white' }
  if (status.includes('拍攝中') || status.includes('2.')) return { bg: '#f59e0b', text: 'white' }
  if (status.includes('後製') || status.includes('3.')) return { bg: '#8b5cf6', text: 'white' }
  if (status.includes('完成') || status.includes('4.')) return { bg: '#10b981', text: 'white' }
  return { bg: '#2a2a3a', text: '#9090a8' }
}

export function HomeDashboard() {
  const router = useRouter()
  const { activeWorkspaceId } = useWorkspace()
  const [projects, setProjects] = useState<Project[]>([])
  const [displayName, setDisplayName] = useState('User')
  const [userId, setUserId] = useState('')
  const [userLogo, setUserLogo] = useState('')
  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    void load()
  }, [activeWorkspaceId])

  async function load() {
    const projectsUrl = activeWorkspaceId ? `/api/projects?workspace_id=${encodeURIComponent(activeWorkspaceId)}` : '/api/projects'
    const [{ data: authData }, projectsResponse] = await Promise.all([
      supabase.auth.getUser(),
      fetch(projectsUrl),
    ])
    const projectsPayload = await projectsResponse.json().catch(() => ({}))
    const projectData = Array.isArray(projectsPayload.projects) ? projectsPayload.projects : []

    console.log('[Recent Projects]', projectData, projectsPayload.error)

    setProjects(projectData as Project[])

    const user = authData?.user
    setUserId(user?.id ?? '')

    const name =
      user?.user_metadata?.display_name ||
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      user?.email?.split('@')[0] ||
      'User'
    setDisplayName(name)

    if (user?.id) {
      const { data: settings, error: settingsError } = await supabase
        .from('settings')
        .select('logo_base64, company_name, user_id')
        .eq('user_id', user.id)
        .single()

      console.log('[Logo Debug] session.user.id:', user.id)
      console.log('[Logo Debug] data:', settings)
      console.log('[Logo Debug] error:', settingsError)

      if (settings?.logo_base64) {
        setUserLogo(settings.logo_base64)
      }
    }
  }

  async function openProject(project: Project) {
    window.localStorage.setItem('current_project_id', project.id)
    await supabase
      .from('projects')
      .update({ last_visited_at: new Date().toISOString() })
      .eq('id', project.id)

    const pipeline = getProjectPipeline(project.type, project.category)
    router.push(getPipelinePath(pipeline, project.pipeline_step))
  }

  const recentProjects = [...projects]
    .sort((a, b) => Date.parse(b.last_visited_at ?? b.created_at) - Date.parse(a.last_visited_at ?? a.created_at))
    .slice(0, 4)

  const inProgressProjects = projects
    .filter((project) => !project.status?.includes('完成') && !project.status?.startsWith('7.'))
    .sort((a, b) => (a.shoot_date ?? '9999-12-31').localeCompare(b.shoot_date ?? '9999-12-31'))
    .slice(0, 4)

  const todayProjects = projects.filter((project) => project.shoot_date === today)

  return (
    <DashboardShell activeSection="home">
      <section
        style={{
          position: 'relative',
          width: '100%',
          height: '220px',
          borderRadius: '16px',
          overflow: 'hidden',
          marginBottom: '24px',
        }}
      >
        <img
          src="/home-hero.png"
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center 60%',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(to right, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.3) 60%, rgba(0,0,0,0.1) 100%)',
          }}
        />
        <div
          style={{
            position: 'relative',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            padding: '0 32px',
            justifyContent: 'space-between',
            gap: '24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {userLogo ? (
              <img
                src={userLogo}
                alt={displayName}
                style={{
                  height: '64px',
                  width: '64px',
                  objectFit: 'contain',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.05)',
                  padding: '4px',
                }}
              />
            ) : (
              <img src="/soon_core_logo.png" alt="SOON CORE" style={{ height: '64px', objectFit: 'contain' }} />
            )}
            <div>
              <p
                style={{
                  fontSize: '12px',
                  color: 'rgba(255,255,255,0.6)',
                  margin: '0 0 2px',
                  letterSpacing: '0.05em',
                }}
              >
                SOON CORE
              </p>
              <p style={{ fontSize: '22px', fontWeight: 700, color: 'white', margin: 0 }}>{displayName}</p>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', margin: '2px 0 0' }}>
                {new Date().toLocaleDateString('zh-HK', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => router.push('/ig/idea')}
              style={{
                background: 'rgba(193,53,132,0.8)',
                backdropFilter: 'blur(8px)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                padding: '12px 20px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <InstagramIcon />
              <span>IG Reel</span>
            </button>
            <button
              type="button"
              onClick={() => router.push('/youtube/idea')}
              style={{
                background: 'rgba(255,0,51,0.82)',
                backdropFilter: 'blur(8px)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                padding: '12px 20px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <YouTubeIcon />
              <span>YouTube</span>
            </button>
            <button
              type="button"
              onClick={() => router.push('/settings')}
              aria-label="設定"
              style={{
                background: 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(8px)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '10px',
                padding: '12px 16px',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              設定
            </button>
          </div>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <section style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <p style={{ fontSize: '14px', fontWeight: 600, color: '#f0f0f5', margin: 0 }}>發掘趨勢</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => router.push('/ig/idea')}
                style={{
                  fontSize: '11px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid #7c5cfc',
                  color: '#7c5cfc',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                IG
              </button>
              <button
                type="button"
                onClick={() => router.push('/youtube/idea')}
                style={{
                  fontSize: '11px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid #0ea5e9',
                  color: '#0ea5e9',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                YouTube
              </button>
            </div>
          </div>

          <p style={{ fontSize: '11px', color: '#5a5a72', margin: '0 0 8px', fontWeight: 500 }}>IG REEL 熱門題材</p>
          <IgTrendPreview userId={userId} />

          <div style={{ height: '1px', background: '#2a2a3a', margin: '16px 0' }} />

          <p style={{ fontSize: '11px', color: '#5a5a72', margin: '0 0 8px', fontWeight: 500 }}>YOUTUBE 話題信號</p>
          <YoutubeTrendPreview />
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <p style={{ fontSize: '14px', fontWeight: 600, color: '#f0f0f5', margin: 0 }}>最近工作</p>
              <button
                type="button"
                onClick={() => router.push('/work')}
                style={{ fontSize: '11px', color: '#9090a8', background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                查看全部
              </button>
            </div>

            {recentProjects.length === 0 ? (
              <p style={{ fontSize: '12px', color: '#5a5a72', textAlign: 'center', padding: '16px 0', margin: 0 }}>
                未有最近項目
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {recentProjects.map((project, index) => {
                  const statusColor = getStatusColor(project.status)
                  return (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => void openProject(project)}
                      style={{
                        padding: '10px 0',
                        border: 'none',
                        borderBottom: index === recentProjects.length - 1 ? 'none' : '1px solid #2a2a3a',
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '16px',
                        background: 'transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <p
                        style={{
                          fontSize: '13px',
                          color: '#f0f0f5',
                          margin: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {project.title}
                      </p>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: statusColor.bg,
                          color: statusColor.text,
                          fontWeight: 500,
                          flexShrink: 0,
                        }}
                      >
                        {project.status || '未有狀態'}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: '12px', padding: '20px' }}>
            <p style={{ fontSize: '14px', fontWeight: 600, color: '#f0f0f5', margin: '0 0 12px' }}>今日拍攝</p>
            {todayProjects.length === 0 ? (
              <p style={{ fontSize: '12px', color: '#5a5a72', textAlign: 'center', padding: '8px 0', margin: 0 }}>
                今日未有拍攝事項
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {todayProjects.map((project, index) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => void openProject(project)}
                    style={{
                      padding: '8px 0',
                      border: 'none',
                      borderBottom: index === todayProjects.length - 1 ? 'none' : '1px solid #2a2a3a',
                      background: 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <p style={{ fontSize: '13px', color: '#f0f0f5', margin: 0 }}>{project.title}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: '12px', padding: '20px' }}>
            <p style={{ fontSize: '14px', fontWeight: 600, color: '#f0f0f5', margin: '0 0 12px' }}>進行中</p>
            {inProgressProjects.length === 0 ? (
              <p style={{ fontSize: '12px', color: '#5a5a72', textAlign: 'center', padding: '8px 0', margin: 0 }}>
                暫時無進行中項目
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {inProgressProjects.map((project, index) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => void openProject(project)}
                    style={{
                      padding: '8px 0',
                      border: 'none',
                      borderBottom: index === inProgressProjects.length - 1 ? 'none' : '1px solid #2a2a3a',
                      background: 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <p style={{ fontSize: '13px', color: '#f0f0f5', margin: 0 }}>{project.title}</p>
                    <span style={{ fontSize: '11px', color: '#5a5a72' }}>{project.shoot_date ?? '未定日期'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </DashboardShell>
  )
}

function IgTrendPreview({ userId }: { userId: string }) {
  const router = useRouter()
  const [ideas, setIdeas] = useState<IdeaPreview[]>([])

  useEffect(() => {
    if (!userId) {
      setIdeas([])
      return
    }

    void supabase
      .from('ideas')
      .select('id, title, viral_score, country, tags')
      .eq('user_id', userId)
      .order('viral_score', { ascending: false })
      .limit(3)
      .then(({ data }) => setIdeas((data ?? []) as IdeaPreview[]))
  }, [userId])

  if (ideas.length === 0) {
    return (
      <p style={{ fontSize: '12px', color: '#5a5a72', textAlign: 'center', padding: '12px 0', margin: 0 }}>
        未有題材，去 IG Idea 收集
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {ideas.map((idea) => (
        <button
          key={idea.id}
          type="button"
          onClick={() => router.push('/ig/idea')}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 12px',
            background: '#111118',
            borderRadius: '8px',
            border: '1px solid #2a2a3a',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <p
            style={{
              fontSize: '13px',
              color: '#f0f0f5',
              margin: 0,
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {idea.title}
          </p>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#7c5cfc', marginLeft: '8px', flexShrink: 0 }}>
            {idea.viral_score ?? 0}
          </span>
        </button>
      ))}
    </div>
  )
}

function YoutubeTrendPreview() {
  const router = useRouter()
  const [signals, setSignals] = useState<YoutubeSignalPreview[]>([])

  useEffect(() => {
    void supabase
      .from('topic_signals')
      .select('id, topic_zh, max_outlier_ratio, signal_count')
      .order('max_outlier_ratio', { ascending: false })
      .limit(3)
      .then(({ data }) => setSignals((data ?? []) as YoutubeSignalPreview[]))
  }, [])

  if (signals.length === 0) {
    return (
      <p style={{ fontSize: '12px', color: '#5a5a72', textAlign: 'center', padding: '12px 0', margin: 0 }}>
        未有信號，去 YouTube Idea 搜掘
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {signals.map((signal) => (
        <button
          key={signal.id}
          type="button"
          onClick={() => router.push('/youtube/idea')}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 12px',
            background: '#111118',
            borderRadius: '8px',
            border: '1px solid #2a2a3a',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <p
            style={{
              fontSize: '13px',
              color: '#f0f0f5',
              margin: 0,
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {signal.topic_zh || '未命名話題'}
          </p>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#0ea5e9', marginLeft: '8px', flexShrink: 0 }}>
            {Number(signal.max_outlier_ratio ?? 0).toFixed(1)}x
          </span>
        </button>
      ))}
    </div>
  )
}
