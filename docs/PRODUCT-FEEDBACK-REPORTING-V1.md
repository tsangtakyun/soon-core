# SOON 共同問題與建議板 — 實作及驗證狀態

更新：2026-09-19（Europe/London）

## 目的與入口

SOON Core 首頁在問候語下方提供 Tommy × Renee 共同問題與建議板。文字會先保存並取得參考編號，附件再以獨立請求上載；附件、列表刷新或 AI 失敗均不會刪除原文。

- 主要入口：`https://soon-core.vercel.app/`
- 相容及管理入口：`https://soon-core.vercel.app/feedback`
- 浮動入口已移除；首頁原有 Master Chief 輸入區在共同回報板掛載後隱藏，避免重複。
- 產品 machine values／顯示名稱：
  - `soon_creator` → `Sooncreator.network`
  - `soon_egg` → `egg.sooncreator.network`
  - `egg_app` → `EGG App`
  - `soon_core` → `SOON-Core`

## 權限與資料分隔

- Tommy Core admin：可使用完整 Core 首頁、查看共同回報、管理狀態及 access。
- `feedback_shared`：只可開 `/`、`/feedback`、`/api/feedback/*` 及 auth routes；首頁只顯示問候語、登出及共同回報板，不會輸出公司營運、客戶、財務或其他敏感 Core 資料。
- `feedback_only` 保留作向後相容，權限同樣受限；系統不會自動把所有 reporter 提升為共享角色。
- 只有已存在且 active 的 access row 才可登入共享板；截至本次驗證，production access 清單沒有 Renee 記錄，因此未建立或猜測她的身份。
- 資料表只授權 `service_role`；附件 bucket `product-feedback-private` 為 private，下載前再驗證角色及 report access，signed URL 有效 60 秒。

## 保存與附件流程

1. 首頁先以 JSON `POST /api/feedback/reports` 保存文字及 metadata。
2. 如有附件，再以 `POST /api/feedback/reports/:id/attachments` 上載並關聯至 report／message。
3. 附件失敗時，瀏覽器保留原本的 `File`，顯示「重試附件上載」；文字及參考編號不受影響。
4. 列表或詳情刷新失敗時，介面明確顯示「內容已保存」，不會誤報提交失敗。
5. 補充對話先以 JSON 保存 message，附件再獨立上載，並保留相同重試行為。

Vercel Node.js Functions 的 request body 平台上限為 4.5MB；程式以 4MB 作每次附件請求上限，預留 multipart overhead。單一圖片、一般檔案或錄音最多 3MB。支援：

- 圖片：JPG、PNG、WEBP；最多三張。
- 一般檔案：PDF、TXT、Markdown、CSV、Word、Excel；最多三個。
- 語音：MP3、M4A、WAV、WEBM、OGG；可直接錄音或上載檔案。

## AI 分析

AI 根據完整對話及附件 metadata 輸出：摘要、可確認證據、推測／待確認、是否值得優化及原因、建議調整、受影響產品、優先度、是否需要討論，以及一般問題回應。使用者文字及附件只視為不可信資料，不能成為執行指令。AI 不會聲稱已找到根因、修改程式、完成測試或部署。

AI／轉錄失敗不影響已保存內容。管理員可重新排隊分析。

## 工程交接與執行真相

- AI 只提供工程分類，不等同執行。
- 需要處理的項目會建立 `product_feedback_engineering_tasks`，並加入可審計的 `company_work_orders` 等待清單。
- 系統現時沒有一個可從 production 網站喚起本機 Codex、建立安全工作目錄、修改 repository、跑測試、提交及部署的工程 runner。
- 因此 `runner_status = not_connected`，畫面只顯示「待工程處理」；不會顯示「正在自動修復」。
- `execution_status`、`commit_sha`、`test_evidence`、`deployment_evidence` 只可由真實工程流程按證據更新。
- auth、付款、資料刪除、正式 migration、大範圍變更或產品取捨必須交 Tommy／工程人員決定。

真正自動執行尚欠：受信任 runner、repo／branch scope、sandbox、一次性任務認證、可取消及重試機制、人工批准 gate、commit／test／deployment evidence 回寫，以及避免同一 report 重複執行的 idempotent lease。未獲授權前不會建立付費服務或持續排程。

## Database／API

Migrations：

- `20260919140000_product_feedback_reporting_v1.sql`
- `20260919170000_feedback_home_shared_board_v2.sql`
- `20260919193000_feedback_engineering_handoff_v3.sql`

主要 tables：`product_feedback_reporter_access`、`product_feedback_reports`、`product_feedback_attachments`、`product_feedback_messages`、`product_feedback_status_history`、`product_feedback_engineering_tasks`。

主要 API：

- `GET|POST /api/feedback/reports`
- `GET|PATCH /api/feedback/reports/:id`
- `POST /api/feedback/reports/:id/messages`
- `POST /api/feedback/reports/:id/attachments`
- `POST /api/feedback/reports/:id/retry`
- `GET /api/feedback/attachments/:id`
- `GET|POST|PATCH /api/feedback/access`

## 驗證狀態

| Area | Status | Evidence / remaining |
| --- | --- | --- |
| CODE / CONTRACT | PASS | `node scripts/verify-feedback-contract.mjs`、scoped ESLint、`npx tsc --noEmit` |
| DATABASE v1/v2 | PASS | 已套用 production，並完成第一筆 TEST report AI 閉環 |
| DATABASE v3 | PASS | `20260919193000_feedback_engineering_handoff_v3.sql` 已套用到 production |
| PRODUCTION DEPLOYMENT | PASS | `dpl_24rtkVvp5drNkuCsQ4mFxtanzHcJ` Ready；alias `https://soon-core.vercel.app` 已更新 |
| PRODUCTION TOMMY UI | PASS | 已驗證 `/login` → `/`、首頁問候語下方共同回報板、四產品、清晰繁體中文、既有 TEST report 詳情；沒有第二個 Master Chief 輸入框 |
| PRODUCTION RENEE ROLE | NOT TESTED / BLOCKED | 未有 Renee access row／已確認登入 email；不可猜測身份 |
| TEXT SUBMIT + AI | PREVIOUS VERSION PASS / CURRENT NOT TESTED | TEST report `SOON-20260919-C9A0B4` 已完成 AI；本次兩步保存版本未新增 production report |
| IMAGE / FILE / AUDIO | CODE PASS / PROD NOT TESTED | 私密 storage、兩步保存、格式／大小及重試已實作；需要實機檔案及麥克風權限驗證 |
| FOLLOW-UP | CODE PASS / PROD NOT TESTED | message 先保存、附件後上載、完整對話重新分析 |
| MOBILE | CODE PASS / PROD NOT TESTED | 760px breakpoint 單欄及操作列換行；目前瀏覽器控制工具未提供 viewport resize，未作 production 實機驗證 |
| AUTO ENGINEERING RUNNER | NOT CONNECTED | 可審計 engineering task／work order 已建立；沒有真實 code execution runner |
