export type ProjectStatus =
  | '1. 未拍攝'
  | '2. 已拍未剪'
  | '3. 已剪未Lock'
  | '4. 已剪未Final'
  | '5. 已剪好'
  | '6. 已上載未出'
  | '7. 已出片'

export type ProjectStage =
  | '未寫稿'
  | '未約主持'
  | 'TYK改稿'
  | '已約期'
  | '拍攝準備'
  | '未開會'
  | 'Seg_Selected中'
  | '剪片中'
  | '等Tommy Comment'
  | '等客人Comment'
  | '處理字幕中'
  | '已完成'

export type ProjectCategory = 'youtube' | 'ig_story' | 'ig_feed' | 'ig_reel' | 'threads' | 'facebook_feed' | 'ig_drama'
export type ProjectType = 'youtube' | 'ig'
export type WorkspaceType = ProjectType | 'mixed'
export type PipelineStep = 'idea' | 'script' | 'storyboard' | 'production' | 'subtitle' | 'done'

export interface Workspace {
  id: string
  name: string
  type: WorkspaceType
  owner: string | null
  description: string | null
  created_at: string
}

export interface Project {
  id: string
  workspace_id: string | null
  title: string
  type: ProjectType
  host: string | null
  owner: string | null
  shoot_date: string | null
  publish_date: string | null
  status: ProjectStatus
  current_stage: ProjectStage
  pipeline_step: PipelineStep
  languages: number
  category: ProjectCategory
  output_url: string | null
  last_visited_at: string | null
  created_at: string
}

export interface CoreDoc {
  id: string
  workspace_id: string | null
  folder_id?: string | null
  title: string
  template_type: string | null
  content: string | null
  created_at: string
}

export const statusOptions: ProjectStatus[] = [
  '1. 未拍攝',
  '2. 已拍未剪',
  '3. 已剪未Lock',
  '4. 已剪未Final',
  '5. 已剪好',
  '6. 已上載未出',
  '7. 已出片',
]

export const stageOptions: ProjectStage[] = [
  '未寫稿',
  '未約主持',
  'TYK改稿',
  '已約期',
  '拍攝準備',
  '未開會',
  'Seg_Selected中',
  '剪片中',
  '等Tommy Comment',
  '等客人Comment',
  '處理字幕中',
  '已完成',
]

export const categoryOptions: Array<{ value: ProjectCategory; label: string; type: ProjectType }> = [
  { value: 'youtube', label: 'YouTube', type: 'youtube' },
  { value: 'ig_story', label: 'IG Story', type: 'ig' },
  { value: 'ig_feed', label: 'IG Feed', type: 'ig' },
  { value: 'ig_reel', label: 'IG Reel', type: 'ig' },
  { value: 'threads', label: 'Threads', type: 'ig' },
  { value: 'facebook_feed', label: 'Facebook Feed', type: 'ig' },
]

export const workspaceTypeOptions: Array<{ value: WorkspaceType; label: string }> = [
  { value: 'youtube', label: 'YouTube' },
  { value: 'ig', label: 'IG' },
  { value: 'mixed', label: '混合' },
]
