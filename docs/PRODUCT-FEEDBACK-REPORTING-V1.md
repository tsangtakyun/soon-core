# SOON 問題與建議 v1 — 實作及驗證狀態

更新：2026-09-19（Europe/London）

Implementation commits：`07a7d4a`、`909ae57`、`e4654a2`（如本文件其後更新，最新 commit 以 `git log` 為準）

## 目的

SOON Core 提供統一、邀請制的產品回報入口，支援 SOON Creator、SOON EGG 及 EGG App。回報先保存並立即取得參考編號，AI 整理及語音轉錄在回應後執行，失敗不會令原始回報遺失。

## 使用入口

- Core／管理員：`https://soon-core.vercel.app/feedback`
- Core 全站入口：`components/FeedbackEntry.tsx` 由 `app/layout.tsx` 掛載；除登入、註冊、auth callback 及回報頁本身外，右下角固定顯示「◇ 問題與建議」，連到 `/feedback`。
- 外部產品預填：`/feedback?product=soon_creator&problem_url=<encoded-url>&app_version=<encoded-version>`
- `product` 可用值：`soon_creator`、`soon_egg`、`egg_app`

外部產品只應傳入實際問題頁及自身版本。Core 只記錄 intake host 及 browser user-agent，不會把 Core 當成問題產品版本或問題頁。

## 權限

- Tommy Core admin：可以看全部回報、狀態、附件、跟進、負責人及受邀回報者。
- `feedback_only`：只可開 `/feedback` 及 `/api/feedback/*`；middleware 會封鎖其他 Core 頁面及 API。
- Reporter API 只回傳本人 `reporter_user_id` 的回報。
- 資料表除 access 自查以外只授權 `service_role`；附件 bucket 為 private，下載前會再次驗證 admin／ownership，signed URL 有效 60 秒。
- 受邀回報者不需要 ChatGPT 帳戶，只使用現有 SOON／Supabase 登入。

## 狀態

| Machine value | 顯示 |
| --- | --- |
| `pending_review` | 待查看 |
| `in_progress` | 處理中 |
| `pending_verification` | 待驗證 |
| `resolved` | 已解決 |

每次狀態改變寫入 `product_feedback_status_history`。Reporter 及 admin 都可用 message 補充資料；原始 description 不會被 AI 覆蓋。

## 附件限制

- 截圖：JPG、PNG、WEBP；每張 8MB；最多三張。
- 語音：MP3、M4A、WAV、WEBM、OGG；最多 20MB；可在 browser 直接錄音。
- API request 總大小上限 36MB。
- 每個附件保存 SHA-256，路徑以 reporter／report 分隔。

## AI 行為

1. Report insert 完成並回傳 reference number。
2. Next.js `after()` 執行 `triageFeedbackReport`。
3. 如有語音及 `OPENAI_API_KEY`，呼叫 `/v1/audio/transcriptions`；model 預設 `gpt-4o-mini-transcribe`，可用 `OPENAI_TRANSCRIPTION_MODEL` 覆寫。
4. 使用現有 `ANTHROPIC_API_KEY` 整理 title、summary、reproduction steps、impact、missing information、possible duplicates 及 inference notes。
5. User content／transcript 在 system prompt 明確定義為不可信資料，不能當指令。
6. AI 不會聲稱 root cause；推測只放 `ai_inference_notes`。
7. 缺 provider 時狀態為 `not_configured`；其他錯誤為 `failed`。兩者均不影響已保存回報。

## Database

Migration：`supabase/migrations/20260919140000_product_feedback_reporting_v1.sql`

- `product_feedback_reporter_access`
- `product_feedback_reports`
- `product_feedback_attachments`
- `product_feedback_messages`
- `product_feedback_status_history`
- private storage bucket：`product-feedback-private`

## API contract

- `GET /api/feedback/reports`：admin 全部；reporter 本人。
- `POST /api/feedback/reports`：multipart form；先保存，201 回 reference。
- `GET /api/feedback/reports/:id`：詳情、附件 metadata、messages、history。
- `PATCH /api/feedback/reports/:id`：admin 更新 status／assignee。
- `POST /api/feedback/reports/:id/messages`：本人或 admin 補充。
- `GET /api/feedback/attachments/:id`：授權後 302 到 60 秒 private signed URL。
- `GET|POST|PATCH /api/feedback/access`：admin 管理邀請制 access。

成功提交範例：

```json
{
  "ok": true,
  "reportId": "uuid",
  "referenceNumber": "SOON-20260919-A1B2C3",
  "aiStatus": "queued",
  "uploadWarnings": []
}
```

## 驗證證據

| Area | Status | Evidence / remaining |
| --- | --- | --- |
| CODE | PASS | `npx tsc --noEmit`; scoped ESLint；contract regression；完整 Next production build（以 non-secret placeholder Supabase env 驗證 build-time contract） |
| DATABASE | PASS | `20260919140000_product_feedback_reporting_v1.sql` 已於 2026-09-19 套用到 `SOON - core` production，remote migration list 已核對一致 |
| DEPLOYMENT | PASS | Production deployment `dpl_FgPEsSiPYBdkPnPNKeyYitTwEC4Q` Ready；alias `https://soon-core.vercel.app` 已指向由 Vercel remote build 產生、包含正確 production environment 的 artifact |
| PRODUCTION ADMIN | PASS | Tommy 已完成 Google OAuth；`/login` 會自動導向 dashboard；production 首頁右下角已顯示「問題與建議」入口；`/feedback` 顯示管理員模式、queue 及 access 管理 |
| PRODUCTION REPORTER | NOT TESTED | 等 migration + deploy，並需 admin 加入一個 reporter email |
| AUDIO / SCREENSHOT | CODE PASS / PROD NOT TESTED | MIME、size、count、private storage、signed URL 已實作；待 production upload |
| AI TRIAGE | PASS | Production TEST report `SOON-20260919-C9A0B4` 已保存及顯示 TEST 標記；AI 已完成 title、summary、reproduction steps、impact、missing information 及 inference notes |

本機最初因只有 `.env.local.example`，在 `/ig/idea` prerender 報缺 Supabase env。以 `vercel pull` 取得的本機 production env 對 secret 只提供 `[SENSITIVE]` placeholder，因此 prebuilt artifact 曾令 OAuth callback 出現 `Invalid API key`。其後改用 Vercel remote production build，92 個 static pages、全部 feedback routes、TypeScript 及 production build 已完整通過；Google OAuth、dashboard redirect 及 feedback 管理員介面亦已在 production 驗證。首次 smoke test 另發現既有 auth-helper session 無法通過 `getUser()`；`e4654a2` 加入以 access token 向 Supabase Auth 再驗證的安全 fallback。

## 安全及操作注意

- 回報只係問題資料，永遠不會自動執行附件／文字指令，亦不會自動授權 code change 或 deploy。
- 不應將 `product-feedback-private` 改成 public。
- 不應將 feedback-only 使用者加入一般 workspace member，除非確實需要 Core 權限。
- 測試回報由 admin 用 `isTest=true` 標記；production 驗證後應保留作 audit 或由 Tommy 明確批准清理。
