import coverManifest from '@/data/content-direction-video-covers.json'

type VideoStyleCover = {
  asset: string | null
  objectPosition: string
  status: 'published_reference' | 'pending_rights_clearance'
  selectionReason: string
  rightsLabel: string
}

const published = new Map(coverManifest.published_assets.map((entry) => [entry.style_code, entry]))
const pending = new Map(coverManifest.review_new_pending.map((entry) => [entry.style_code, entry]))

export function videoStyleCover(code: string): VideoStyleCover {
  const approved = published.get(code)
  if (approved) {
    return {
      asset: approved.asset,
      objectPosition: approved.object_position_desktop,
      status: 'published_reference',
      selectionReason: approved.selection_reason,
      rightsLabel: '可展示封面',
    }
  }
  const waiting = pending.get(code)
  return {
    asset: null,
    objectPosition: '50% 50%',
    status: 'pending_rights_clearance',
    selectionReason: waiting?.note ?? '尚未有已確認可展示的代表影格。',
    rightsLabel: '權利待確認 · 封面待補',
  }
}

export const VIDEO_STYLE_COVER_COUNTS = coverManifest.summary
