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

