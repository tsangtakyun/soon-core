import type { ProjectStage, ProjectStatus } from '@/lib/types'

const stageStyles: Record<string, { background: string; color?: string; border?: string }> = {
  未寫稿: { background: '#ef4444' },
  未約主持: { background: '#ef4444' },
  TYK改稿: { background: '#6b7280' },
  已約期: { background: '#22c55e' },
  拍攝準備: { background: '#ec4899' },
  未開會: { background: '#6b7280' },
  Seg_Selected中: { background: '#a855f7' },
  剪片中: { background: '#a855f7' },
  '等Tommy Comment': { background: '#f97316' },
  '等客人Comment': { background: '#1a1a2e', color: '#f97316', border: '1px solid #f97316' },
  處理字幕中: { background: '#14b8a6' },
  已完成: { background: '#22c55e' },
}

export function StatusBadge({ status }: { status: ProjectStatus | string }) {
  const key = status.split('.')[0]
  return <span className={`status-badge status-${key}`}>{status}</span>
}

export function StageBadge({ stage }: { stage?: ProjectStage | string | null }) {
  const label = stage ?? '未寫稿'
  const style = stageStyles[label] ?? { background: '#6b7280' }
  return (
    <span className="stage-badge" style={{ color: '#fff', ...style }}>
      {label}
    </span>
  )
}

export function CategoryTag({ category }: { category?: string | null }) {
  const label =
    category === 'ig_reel' ? 'IG Reel' : category === 'ig_drama' ? 'IG Drama' : 'YouTube'
  const className =
    category === 'ig_reel'
      ? 'category-tag category-ig-reel'
      : category === 'ig_drama'
        ? 'category-tag category-ig-drama'
        : 'category-tag category-youtube'

  return <span className={className}>{label}</span>
}

export function AvatarChip({ name }: { name?: string | null }) {
  const label = name?.trim() ? [...name.trim()].slice(0, 2).join('') : '--'
  return <span className="avatar-chip" title={name ?? '未設定'}>{label}</span>
}

export function PipelineProgress({ step }: { step?: string | null }) {
  const steps = ['idea', 'script', 'storyboard', 'production', 'subtitle', 'done']
  const currentIndex = Math.max(0, steps.indexOf(step ?? 'idea'))

  return (
    <div className="pipeline-progress" title={step ?? 'idea'}>
      {steps.map((item, index) => (
        <span key={item} className={index <= currentIndex ? 'filled' : ''} />
      ))}
    </div>
  )
}
