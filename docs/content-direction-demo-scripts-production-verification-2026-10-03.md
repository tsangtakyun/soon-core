# 內容方向示範稿 Production 正式驗證記錄（2026-10-03）

## 部署識別

- Production URL：`https://soon-core.vercel.app/content-directions`
- Git commit：`9458bf9b2696f1f739fe8e7fb7f18e71014f6ae5`
- Vercel deployment ID：`dpl_HxsEPRa2sWZuzWnwCi5ffN4UxkNJ`
- Vercel build ID：`bld_keev56ruo`
- Deployment URL：`https://soon-core-55bo9o4g5-tsangtakyun-4639s-projects.vercel.app`
- Vercel target／狀態：`production`／`READY`
- GitHub deployment status：`Vercel – soon-core`／`success`／`Deployment has completed`
- 驗證環境：已登入 Chrome production session；沒有使用本地 mock 或 preview build。

## 固定驗證結果

| 格式 | 內容方向 | Production 顯示題目 | 完整時間軸 | 無成片填空占位 | 獨立製作備註 | 結果 |
|---|---|---|---:|---:|---:|---:|
| 真人 | 實景冷知識快講 | 同一個街角，地面可以差幾多度？ | 是 | 是 | 是 | 通過 |
| 真人 | 雙人誤會反轉短劇 | 雪櫃入面嗰盒蛋糕係邊個？ | 是 | 是 | 是 | 通過 |
| 真人 | 情境探店逐款試食 | 收工後四十分鐘：暖燈小館三款熱食 | 是 | 是 | 是 | 通過 |
| 真人 | 城市路線敘事 | 由潮汐碼頭行到風塔山腰 | 是 | 是 | 是 | 通過 |
| 真人 | 無需出鏡沉浸式探店 | 清晨第一籠：霧窗包房醒來 | 是 | 是 | 是 | 通過 |
| 真人 | 生活痛點解法型產品片 | 充電線每晚都跌落床底，點樣一次解決？ | 是 | 是 | 是 | 通過 |
| 真人 | 主持試食文化快解 | 一碗白粥點解可以有三種口感？ | 是 | 是 | 是 | 通過 |
| 真人 | 真人產品實測導購 | 細單位收納盒：摺起來真係省位嗎？ | 是 | 是 | 是 | 通過 |
| 真人 | 坐定主持考據式解說 | 一張 1987 年戲票，可以證明甚麼？ | 是 | 是 | 是 | 通過 |
| 真人 | 第一身旅程實錄 | 第一次在月牙灣過夜：由出發到日出 | 是 | 是 | 是 | 通過 |
| 真人 | 多站清單式城市精選 | 雨天半日：三個虛構室內停靠點 | 是 | 是 | 是 | 通過 |
| 真人 | 超短奇觀體驗快拍 | 門一開，整個房間開始下雪 | 是 | 是 | 是 | 通過 |
| 真人 | 沉浸式體驗反思敘事 | 兩小時無通知：無聲房間實驗 | 是 | 是 | 是 | 通過 |
| AI | 藝術家第一身情感獨白 | 我把裂痕留在每一隻杯上 | 是 | 是 | 是 | 通過 |
| AI | 電影感創辦人傳記 | 一把修了四十年的傘：木生傘房 | 是 | 是 | 是 | 通過 |
| AI | AI 多角色連續情境短劇 | 三個室友，只有一個人記得交電費 | 是 | 是 | 是 | 通過 |
| AI | AI 實景主持穿越導覽 | 如果我去到 2099 年的海上街市 | 是 | 是 | 是 | 通過 |
| AI | AI 荒誕反轉微劇 | 隻貓偷咗廚師帽，然後開始點餐 | 是 | 是 | 是 | 通過 |

「無成片填空占位」檢查範圍為示範劇本 section，確認沒有 `［拍攝後填寫］`、名稱待填、核實名稱或實際時間 placeholder。Production 的 18 款詳情均讀到「獨立原創示範劇本」、「完整連續時間軸」及「製作備註（不屬於成片對白）」。AI 五款另確認逐段可見 `AI 鏡頭 Prompt`。

## 刷新及重開

1. 在 production URL 執行完整頁面 reload，等待已發布風格資料重新載入。
2. 重新切換至「真人短片」，打開「情境探店逐款試食」。確認新題目「收工後四十分鐘：暖燈小館三款熱食」、完整三款食物對白、沒有舊填空文字，並讀到獨立製作備註。
3. 關閉詳情後切換至「AI 短片」，逐一重新打開五款 AI 方向。全部讀到新版完整示範、獨立製作備註及 AI 鏡頭 Prompt。
4. 結果證明 production reload 後載入的是 commit `9458bf9b2696f1f739fe8e7fb7f18e71014f6ae5` 的新版前端內容。

## 響應式版面

- 桌面：`1512 × 746` CSS pixels；production URL、標題與詳情抽屜正常，document `scrollWidth = 1512`。
- 手機：viewport override `390 × 844`；打開「情境探店逐款試食」新版示範，詳情 dialog 寬度 `390`，document `scrollWidth = 390`，沒有橫向溢出。
- 手機測試完成後已 reset viewport，production tab 保留為 deliverable。

## 資料分離及研究狀態

- 原片還原稿：獨立 section 及獨立資料檔；保留來源、畫面、對白、raw ASR 與核實標記。
- 風格規格：獨立 section；不會被示範稿覆寫。
- 獨立原創示範劇本：獨立 section 及 `data/content-direction-demo-scripts.json`；所有虛構人物、商戶、地點、數據、體驗或品牌史均有披露。
- 製作備註：明確標示「不屬於成片對白」，與完整示範台詞分開。
- 原稿核聽狀態：正式片可用台詞／字幕 `89/89` 段；待人工音訊核實 `89` 段；整段無法辨識 `0` 段；局部缺口 `1` 段；人工逐句音訊核實仍為 `0`。
- 生成狀態：18 款全部未拍攝／未生成；付費 API `0`；credits `0`；沒有改動 Studio bridge、發布或 review flags。

## 自動檢查

- `npm run verify:content-direction-demo-scripts`：18 款、13 真人、5 AI、109 段連續時間軸通過。
- `npm run prebuild`：所有既有及新增 verifier 通過。
- `npx tsc --noEmit`：通過。
- ESLint：0 errors；保留 1 個既有 `<img>` performance warning。
