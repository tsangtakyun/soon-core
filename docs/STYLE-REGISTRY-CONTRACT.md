# SOON Core Style Registry contract

## Terms

- **Direction**: a strategic content direction stored by the existing Content Direction Lab. It is research input, not a production style.
- **Style**: a stable, named production approach with a machine code and content format (`content_styles`).
- **Style version**: immutable-after-publication production rules for one Style (`style_versions`).
- **Template**: a future render/layout implementation. This registry does not claim that a Style is a visual template.
- **Reference**: a reviewed evidence link from Intelligence Inbox, Content Direction Lab, or an external public source (`style_references`).

## Published API

Authentication for both endpoints is the existing `x-soon-knowledge-key` shared server credential. Call it from a Creator server route; never expose the key to a browser.

### List by format

`GET /api/intelligence/styles?format=instagram_carousel`

Supported format values:

- `instagram_carousel`
- `instagram_single_feed`
- `human_short_video`
- `ai_short_video`

Example response:

```json
{
  "schemaVersion": 1,
  "registryVersion": "styles-0123456789ab",
  "compatibility": {
    "minimumCreatorContract": 1,
    "supportedFormats": ["instagram_carousel", "instagram_single_feed", "human_short_video", "ai_short_video"]
  },
  "format": "instagram_carousel",
  "updatedAt": "2026-09-12T12:00:00.000Z",
  "contentHash": "sha256...",
  "styles": [{
    "styleId": "ca000001-0000-4000-8000-000000000001",
    "code": "editorial_contrast_carousel",
    "format": "instagram_carousel",
    "name": "反差編輯輪播",
    "description": "用清楚反差、逐頁推進及可保存結論，將文化或產品觀察整理成輪播。",
    "version": {
      "id": "ca100001-0000-4000-8000-000000000001",
      "number": 1,
      "ref": "style:editorial_contrast_carousel:v1",
      "contentHash": "sha256...",
      "changeSummary": "Initial carousel production contract...",
      "publishedAt": "2026-09-12T12:00:00.000Z",
      "rules": { "schema_version": 1, "format": "instagram_carousel" }
    },
    "evidence": { "confirmedReferenceCount": 1 }
  }]
}
```

### Get one published Style

`GET /api/intelligence/styles/editorial_contrast_carousel`

The envelope is the same, with a singular `style` property. Unknown/unpublished codes return `404`; unsupported formats return `422`; missing credentials return `401`.

## Creator integration

1. Fetch the list server-side for the selected content format.
2. Store `styleId`, `version.id`, `version.number`, `version.ref`, and `version.contentHash` on the new project.
3. Use `version.rules` for production. Do not silently replace the stored version on an existing project.
4. A new project may read the newest published version. If Core is unavailable, use the project's saved rules snapshot; do not fall back to an arbitrary different Style.

## Core authoring lifecycle

1. `POST /api/styles` creates the stable Style identity.
2. `POST /api/styles/{styleId}/versions` creates the next draft.
3. `POST /api/styles/{styleId}/references` associates reviewed evidence with that draft.
4. `PATCH /api/styles/{styleId}/versions/{version}` moves `draft → review → published`.

Published versions cannot be updated or deleted. Publication requires at least one confirmed reference. Shared Styles cannot be published from confirmed `workspace_private` evidence. Admin endpoints use the current Core session and restrict writes to the admin's workspace.

## First reproducible path

Migration `20260912130000_canonical_style_registry.sql` creates `editorial_contrast_carousel`, attaches the earliest canonical public Content Direction reference, then records draft, review, and published events. Validation:

```sql
select s.code,v.version,v.status,v.content_hash,count(r.id) confirmed_references
from content_styles s
join style_versions v on v.style_id=s.id
left join style_references r on r.style_version_id=v.id and r.confirmation_status='confirmed'
where s.code='editorial_contrast_carousel'
group by s.code,v.version,v.status,v.content_hash;
```

Only published `public_research` and `soon_owned` Styles are returned by the Creator API. Reference source rows and private client data are never returned.
