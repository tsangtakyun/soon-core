import type { ProjectStatus } from '@/lib/types'

export function StatusBadge({ status }: { status: ProjectStatus | string }) {
  const key = status.split('.')[0]
  return <span className={`status-badge status-${key}`}>{status}</span>
}

export function CategoryTag({ category }: { category?: string | null }) {
  const label =
    category === 'ig_reel' ? 'IG Reel' : category === 'ig_drama' ? 'IG Drama' : 'YouTube'
  return <span className="category-tag">{label}</span>
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
