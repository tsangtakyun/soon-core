# Core-only真人短片規格入庫 — 2026-09-29

## 範圍

本次只把 Renee 真人短片方法保存到 SOON Core 的內部審閱層。Creator／Content Studio 的風格清單、推薦、生成、剪接及 template binding 均不啟用。

## 新方向

- `multi_stop_city_curation` — 多站清單式城市精選
- `spectacle_first_experience_micro` — 超短奇觀體驗快拍
- `immersive_experience_reflection` — 沉浸式體驗反思敘事

三款均保存為 `style_versions.status = review`，並帶有：

- `creator_eligible = false`
- `content_studio_enabled = false`
- `generation_enabled = false`
- `template_binding_allowed = false`

沒有建立 `content_templates`、`template_versions` 或 `style_template_bindings`。

## 既有方向最小增補

- `first_person_journey_diary`：新增 `bucket_list_experience`（reference 05）及 `caption_led_teaser`（reference 09）。
- `on_location_fact_sprint`：新增 `voiceover_micro_tour`（reference 08）。
- `human_product_demo_conversion`：新增 `personalised_novelty_result` 筆記（reference 06），不新增獨立方向。

增補均另存為下一個 `review` 版本；原有 `published` 版本保持不變，因此 Creator 仍只讀取原有版本。

## Reference 邊界

- 02 只分類為「一鏡等結果」補充，不獨立成款。
- 03、04 只保存結構分析，權利未明，不建立可播放 reference。
- 06 只補充真人產品實測導購。
- 10 不收錄。
- 未核實的原片說法不得成為模板事實；必須標為「原片說法」或「待核實」，並保存來源及核對日期。

## 發布隔離

Core 正式 UI 會另設「真人短片規格審閱層」，清楚標示 Core only、Creator 未啟用及不可生成。公開／Creator registry 仍只回傳 `published` style version，所以原有 10 款維持不變。

## 正式入庫結果

| 方向 | Style ID | Version ID | 版本／狀態 |
| --- | --- | --- | --- |
| `multi_stop_city_curation` | `0d60ed22-efbc-43f7-b86d-8d2a9fe6d7e3` | `669372ac-8d10-4063-9652-272cc25051af` | v1 `review` |
| `spectacle_first_experience_micro` | `40d9abb0-4029-4015-9789-52beebcb54ea` | `8496133c-629e-440f-b9d8-e91c595973cb` | v1 `review` |
| `immersive_experience_reflection` | `efde0b7e-fd72-4341-851b-bd808c137403` | `273e62b4-258a-4b6c-9410-5bf4ceb20e14` | v1 `review` |

既有方向增補保存為 `on_location_fact_sprint` v2、`first_person_journey_diary` v2、`human_product_demo_conversion` v2，三者均為 `review`；各自原有 v1 `published` 保持不變。

## 部署及驗證

- Production deployment：`dpl_o7K4GZ2YxEKqmjog5VHS7kD2kprT`
- Deployment URL：`https://soon-core-a5i09a5ik-tsangtakyun-4639s-projects.vercel.app`
- Production alias：`https://soon-core.vercel.app`
- Vercel production build：72／72 pages，TypeScript 通過，狀態 `READY`。
- Core 正式 UI 儲存後重開：真人短片顯示 10 款 `published`，另有 6 份 Core-only `review` 規格。
- Creator 邊界：Creator `content-styles` 只讀 Core `/api/intelligence/styles` 的 `published` registry；6 份 `review` 規格沒有 template binding，亦沒有 Creator／Content Studio 啟用旗標。
- 回歸修正：Core 管理 UI 的 styles route 現在會驗證及採用 `format` 查詢參數；真人短片不再誤用輪播 registry。
