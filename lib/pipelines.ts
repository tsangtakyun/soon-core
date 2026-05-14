export type PipelineId = 'ig' | 'youtube'
export type ToolId = 'idea' | 'script' | 'storyboard' | 'production' | 'subtitle'

export interface PipelineTool {
  id: ToolId
  label: string
  icon: string
  url: string
}

export interface PipelineConfig {
  id: PipelineId
  label: string
  badge: string
  tools: PipelineTool[]
}

export const pipelineSteps = ['idea', 'script', 'storyboard', 'production', 'subtitle', 'done'] as const

export const pipelines: Record<PipelineId, PipelineConfig> = {
  ig: {
    id: 'ig',
    label: 'IG',
    badge: 'IG',
    tools: [
      {
        id: 'idea',
        label: 'Idea',
        icon: '💡',
        url: 'https://idea-brainstorm.vercel.app?embedded=true',
      },
      {
        id: 'script',
        label: 'Script',
        icon: '📝',
        url: 'https://script-generator-xi.vercel.app?embedded=true',
      },
      {
        id: 'storyboard',
        label: 'Storyboard',
        icon: '🎬',
        url: 'https://soon-storyboard.vercel.app?embedded=true',
      },
      {
        id: 'subtitle',
        label: 'Subtitle',
        icon: '🎞️',
        url: 'https://soon-subtitle.vercel.app?embedded=true',
      },
    ],
  },
  youtube: {
    id: 'youtube',
    label: 'YouTube',
    badge: 'YouTube',
    tools: [
      {
        id: 'idea',
        label: 'Idea',
        icon: '💡',
        url: 'https://soon-youtube-idea.vercel.app?embedded=true',
      },
      {
        id: 'script',
        label: 'Script',
        icon: '📝',
        url: 'https://script-generator-youtube.vercel.app?embedded=true',
      },
      {
        id: 'storyboard',
        label: 'Storyboard',
        icon: '🎬',
        url: 'https://soon-storyboard-youtube.vercel.app?embedded=true',
      },
      {
        id: 'production',
        label: 'Production',
        icon: '🎥',
        url: 'https://soon-production-tool.vercel.app?embedded=true',
      },
      {
        id: 'subtitle',
        label: 'Subtitle',
        icon: '🎞️',
        url: 'https://soon-subtitle.vercel.app?embedded=true',
      },
    ],
  },
}

export function getPipeline(id: string) {
  return pipelines[id as PipelineId] ?? null
}

export function getTool(pipelineId: PipelineId, toolId: string) {
  return pipelines[pipelineId].tools.find((tool) => tool.id === toolId) ?? null
}

export function getProjectPipeline(type?: string | null, category?: string | null): PipelineId {
  if (type === 'ig' || category?.startsWith('ig_') || category === 'threads' || category === 'facebook_feed') return 'ig'
  return 'youtube'
}

export function getPipelinePath(type: PipelineId, step?: string | null) {
  const fallback = 'idea'
  const normalized = pipelineSteps.includes(step as (typeof pipelineSteps)[number])
    ? step
    : fallback
  const tool = normalized === 'done' ? 'subtitle' : normalized

  if (type === 'ig' && tool === 'production') {
    return '/ig/storyboard'
  }

  return `/${type}/${tool}`
}
