# Human-video script pilot contract — 2026-10-01

## Scope

Phase one exposes script contracts for exactly two published `human_short_video` styles:

- `situational_multi_dish_tasting`
- `on_location_fact_sprint`

All published styles remain available through the style registry. Only these two carry the optional `scriptContract` property. A listed or recommended style does not enable generation.

Core provides immutable style/template identity, the canonical `human_video_script.v2` field profile, preparation gaps, narrative structure, shot guidance, voice/subtitle guidance, and fact/rights checks. EGG owns script revisions, workflow, approval, legacy `script_flow` adaptation, workspace authorization, generation gates, and persistence. Creator consumes EGG's shared contract and API rather than creating another script or approval store.

This phase excludes editing timelines, automatic editing, video generation, rendering/export, direct social publishing, and automatic style publication. Core makes zero paid model calls.

## Published identities

| Style | Style version | Style hash | Template version | Template hash |
| --- | --- | --- | --- | --- |
| `situational_multi_dish_tasting` | `a0abba34-edb9-4f02-928a-f4dfba1c3f5b` | `95e45b764715d2a54ad19428ed2ecf5cc34c970367e3cf71c786a3ca62023866` | `1705f130-fbe2-40c7-9291-9b6e127b3ce9` | `c16e7a29f191e0d5cfd358db6cfb4d4022abefae258d3a81ad98513e180c1542` |
| `on_location_fact_sprint` | `a6f2d8a3-8447-482c-bb6e-81ff3885510f` | `bd636192e29c0f3d1be1fb66923780b60698f0fb56d3fe3ecd00f44b94708bbb` | `51f7e30e-62dd-4da0-acdf-727cfcebadea` | `eb70e25784fb5fb77b028e7ecec2076eaf04ab0cec84ce8e59a54a707ce8960a` |

The endpoint rejects the request with `409` if a live published ID or hash differs from the pinned contract.

## Registry response

`GET /api/intelligence/styles?format=human_short_video` remains the complete published list. The two pilots add:

```json
{
  "scriptContract": {
    "contractVersion": "human_video_script.v2",
    "format": "human_short_video",
    "styleCode": "situational_multi_dish_tasting",
    "styleVersionId": "a0abba34-edb9-4f02-928a-f4dfba1c3f5b",
    "styleVersionRef": "style:situational_multi_dish_tasting:v1",
    "styleContentHash": "95e45b...",
    "registryVersion": "styles-...",
    "requiredBeatFields": ["role", "time", "visual.description"],
    "optionalBeatFields": ["spoken.text"],
    "beatCountGuidance": { "minimum": 5, "ideal": 6, "maximum": 9 }
  }
}
```

Other style objects omit `scriptContract`; their existing fields and publication rules are unchanged.

## Deterministic recommendation endpoint

`POST /api/intelligence/styles/production-recommend` uses the existing server-only `x-soon-knowledge-key`. Phase one accepts:

```json
{
  "consumer": "egg",
  "format": "human_short_video",
  "brief": "same topic used for both pilot structures",
  "pilotCodes": ["situational_multi_dish_tasting", "on_location_fact_sprint"],
  "materials": ["footage", "presenter", "research", "licensed_assets"],
  "permissions": {
    "workspace_access_confirmed": true,
    "location_filming_confirmed": true,
    "subject_release_confirmed": true,
    "asset_rights_confirmed": true
  }
}
```

The response returns the exact published registry snapshots, `scriptContract`, richer `pilotProfile`, and missing material/permission notes. `generationEnabled` is always `false`; `preparationComplete` is informational and consumers must still perform their own active-workspace authorization before reading or saving content.

The endpoint is deterministic and does not write recommendation runs to Core. The requesting product owns its workspace-scoped cache or audit record.

## Distinct pilot structures

The tasting style uses the stable roles `situational_hook`, `arrival`, `dish_tasting`, and `close`; `dish_tasting` occurs 2–6 times. It allows `spoken.text`, subtitles, and asset references to remain incomplete before capture; `not_visited` must preserve unknown reactions.

The fact sprint uses the stable roles `question_hook`, `topic_setup`, `fact`, and `close`; `fact` occurs 3–6 times. Spoken text, subtitles, media assets, and evidence source references are required. Every factual beat must keep verification status and checked date before approval.

These machine role codes are an additive contract mapping extracted from the already-published natural-language narrative structures. They do not alter the published style records, version IDs, content hashes, or template hashes. Chinese display names and conditional rules are fixed in `data/human-video-script-pilot-contract.json`. Accelerated Q&A is pacing within repeatable `fact` beats rather than another required structural role.

## Provenance and drift recovery

The published pilot snapshot comes from the canonical 2026-09-21 registry inventory. The source commits are:

- tasting: `281bb73f0093769392743385902c3868c9446099`
- fact sprint: `2dc003ed0e3d48647e73c3073e34e42908dc18e8`

`production-recommend` first entered Core history in `1434d6a`, was repaired in `489a094`, and later received ranking changes in `9c83ea6`. It was absent from the formal production branch, so production returned `405`. The restored phase-one route deliberately removes the old paid ranking call and Core-side run persistence; it validates and returns only the two approved immutable contracts.

Legacy `script_flow` rows remain an EGG read/reopen responsibility and are not migrated by this Core change.
