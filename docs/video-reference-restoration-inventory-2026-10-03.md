# 影片原片還原稿覆蓋清單（2026-10-03）

## 正式發布代表片

以下 12 條均已建立 0 秒至片尾的連續時間軸。共 89 段；可用台詞或燒錄字幕段 89 段，待人工音訊核實 89 段，整段無法辨識 0 段，局部仍有缺口 1 段。`audio_fully_manually_verified_count` 仍為 0。

| 內容方向 | Source | 片長 | 段數 | 來源依據及狀態 |
|---|---|---:|---:|---|
| 藝術家第一身情感獨白 | `public/templates/ai-artist-reflective-monologue-v1/reference.mp4` | 151.72s | 8 | ASR、字幕或畫面交叉整理；待人工核聽 |
| 電影感創辦人傳記 | `public/templates/ai-cinematic-founder-biography-v1/reference.mp4` | 98.98s | 7 | 保留原文及繁中翻譯；待人工核聽／翻譯核對 |
| 無需出鏡沉浸式探店 | `public/templates/faceless-sensory-food-discovery-v1/reference.mp4` | 43.33s | 6 | 燒錄字幕 OCR 與 ASR 交叉對照；待人工核聽 |
| 第一身旅程實錄 | `public/templates/first-person-journey-diary-v1/reference.mp4` | 82.69s | 8 | 燒錄字幕 OCR 與 ASR 交叉對照；待人工核聽 |
| 主持試食文化快解 | `public/templates/host-led-food-culture-tasting-v1/reference.mp4` | 81.78s | 7 | 燒錄字幕 OCR 與 ASR 交叉對照；待人工核聽 |
| 真人產品實測導購 | `public/templates/human-product-demo-conversion-v1/reference.mp4` | 54.66s | 6 | 燒錄字幕 OCR 與 ASR 交叉對照；待人工核聽 |
| 實景冷知識快講 | `public/templates/on-location-fact-sprint-v1/reference.mp4` | 58.28s | 6 | 燒錄字幕 OCR 與 ASR 交叉對照；待人工核聽 |
| 生活痛點解法型產品片 | `public/templates/problem-first-lifestyle-product-v1/reference.mp4` | 64.22s | 9 | ASR、字幕或畫面交叉整理；待人工核聽 |
| 城市路線敘事 | `public/templates/route-led-city-portrait-v1/reference.mp4` | 55.73s | 6 | 保留原文及繁中翻譯；待人工核聽／翻譯核對 |
| 坐定主持考據式解說 | `public/templates/seated-host-research-explainer-v1/reference.mp4` | 176.70s | 9 | 燒錄字幕 OCR 與 ASR 交叉對照；待人工核聽 |
| 情境探店逐款試食 | `public/templates/situational-multi-dish-tasting-v1/reference.mp4` | 180.04s | 9 | 燒錄字幕 OCR 與 ASR 交叉對照；待人工核聽 |
| 雙人誤會反轉短劇 | `public/templates/two-person-misunderstanding-twist-v1/reference.mp4` | 147.56s | 8 | 燒錄字幕 OCR 與 ASR 交叉對照；待人工核聽 |

## 逐段恢復方法

- 從原片每秒抽取一格，以 macOS Apple Vision 在本機辨識燒錄字幕，再按時間軸分段。
- 將燒錄字幕與原有 timestamped ASR 交叉對照；字幕可確認的內容放入顯示稿，未聲稱已人工聽音。
- `speech_raw_asr` 及 `speech_raw_asr_segments` 逐字保留原始 ASR，包括重複幻覺；清理稿另存於 `speech_asr_cleaned`／顯示欄。
- 外語片同時保留原文及標示為待核對的繁體中文翻譯。

## 修正樣本

| 內容方向 | 修正前 | 修正後 | 依據 |
|---|---|---|---|
| 無需出鏡沉浸式探店 | 整片 6/6 段顯示「語音未能可靠辨識」 | 6/6 段恢復，例如「從中目黑車站走路八分鐘」、「招牌黑蒜油水餃」 | 原片燒錄字幕逐秒 OCR，與中文 ASR 交叉對照 |
| 真人產品實測導購 | 整片 6/6 段只顯示待核聽 | 6/6 段恢復，例如「垃圾快滿的時候往下一壓，體積直接縮小」 | 原片繁中燒錄字幕逐秒 OCR |
| 電影感創辦人傳記 | 最後一段誤收上一段 `Every empire...`，raw 重複曾被刪 | 按 21.10／33.12／44.82／64.36／80.66／91.12 秒重新切段；最後段由 `What was yours...` 開始；raw 保留 `From time to time...` 幻覺 | 原始 timestamped ASR word/segment 時間 |
| 雙人誤會反轉短劇 | 整片 8/8 段只顯示待核聽 | 7 段恢復可辨識對話；第 8 段保留可確認片尾字卡，並標示其餘短句待核聽 | 原片中英燒錄字幕逐秒 OCR，與 ASR 交叉對照 |

## 新增 review 入選方向及補充片

此區沿用已確認入選篩選：完整代表片保留全片；補充片只保留有用片段；`excluded_unchanged` 不建立重複稿。原有 Renee package 的音訊仍標示待人工逐句聆聽。

| Reference | 內容方向 | Source | 範圍 | 狀態 |
|---|---|---|---|---|
| human-01 | 多站清單式城市精選 | `5間在巴黎探到的寶藏小店～၄၃၄၃話雖如此精品也沒少逛哈哈(๑•́ ₃ •̀๑)@sabreparis @brigittetanaka @fotoautomat_france @athanas.mp4` | 0–70.24s | 完整代表片；待人工核聽 |
| human-07 | 超短奇觀體驗快拍 | `在這裏看維也納的夜景真的很美 .ᐟ.ᐟ🌌🌃The highest slide in Europe🛝165米高空，40米的滑道只要7-10秒，時速可達18km-h!推薦晚上去整個氣氛完全不.mp4` | 0–26.28s | 完整代表片；待人工核聽 |
| human-11 | 沉浸式體驗反思敘事 | `這是我第一次躺進棺材裡📍Kid Mai Death Awareness Cafe (Bangkok)@kid_mai_death_awareness_cafe 死亡覺知的畫面來源為東京 @y.mp4` | 0–110.50s | 完整代表片；待人工核聽 |
| human-05 | 第一身旅程實錄 | `Plan呢個trip嘅第一日，我已經決定好一定要去呢度！(๑ơ ₃ ơ)♥又完成咗個心願list其中一項！✅📍Musée des Arts Forains.mp4` | 0–56.38s | 完整代表片；待人工核聽 |
| human-08 | 實景冷知識快講 | `我在世界上第一間麥當勞🍟🇺🇸86年前麥當勞兄弟在這裡創立了 McDonald’s Bar-B-Q餐廳後來被買下拆除 改建成了全世界唯一一間麥當勞博物館裡面收集了各種穿越時空的兒童餐玩具幾.mp4` | 0–30.42s | 完整代表片；待人工核聽 |
| human-09 | 第一身旅程實錄 | `我認真覺得這裡可能是巴黎最快樂的博物館它沒有名畫
卻比不少博物館更讓人難忘如果來過巴黎很多次
我真的很推薦留半天給它EN) This might just be the happiest museum.mp4` | 0–20.73s | 完整代表片；待人工核聽 |
| ai-01 | AI 荒誕反轉微劇 | `浑身都凉快🤣 #baby #ai.mp4` | 0–10.17s | 完整代表片；待人工核聽 |
| ai-03 | AI 多角色連續情境短劇 | `如果00後成為父母#短劇 #短視頻 #劇情 #ai #hongkong.mp4` | 0–169.57s | 完整代表片；待人工核聽 |
| ai-07 | AI 實景主持穿越導覽 | `如果你真的穿越到 1912 年，敢登上鐵達尼號嗎？🚢我真的把自己「送回」了 1912 年。從港口排隊登船開始，一路走進鐵達尼號的甲板、三等艙公共區、擁擠的樓梯和客房走廊……最.mp4` | 0–145.81s | 完整代表片；待人工核聽 |
| human-02 | spectacle_first_experience_micro | `Flamingo Land火烈鳥樂園位於英國北約克郡，是英國擁有最多過山車的樂園之一。其最刺激過山車「Sik」於2022年7月2日開放，由Intamin製造耗資約1800萬英鎊。這款多重倒轉過.mp4` | 0.00–11.72s | 有用補充片段；待人工核聽 |
| human-03 | spectacle_first_experience_micro | `I need someone to build that cocktail tube delivery system at my home 😆 📮.Cahoots Postal Offic.mp4` | 0.00–6.00s | 有用補充片段；待人工核聽 |
| human-03 | spectacle_first_experience_micro | `I need someone to build that cocktail tube delivery system at my home 😆 📮.Cahoots Postal Offic.mp4` | 14.00–23.10s | 有用補充片段；待人工核聽 |
| human-04 | spectacle_first_experience_micro | `London’s newest immersive experience 🤯✅ Follow @shweta.wanders for the best London experiences,.mp4` | 0.00–10.93s | 有用補充片段；待人工核聽 |
| human-06 | human_product_demo_conversion | `可以印自己的臉！真的有人想收到嗎😆？最荒謬的日本伴手禮 #🇯🇵哈哈哈現在看還是覺得很荒謬但又捨不得吃完（？快Tag要去日本的朋朋幫你買🫵🏻🙋你們想做做看這個銅鑼燒.mp4` | 0.00–30.00s | 有用補充片段；待人工核聽 |
| ai-02 | ai_absurd_twist_microdrama | `Tanto esforço pra nada…😂 @syntx_global @syntx_creators Crie videos virais como esse com a plata.mp4` | 0.00–15.16s | 有用補充片段；待人工核聽 |
| ai-04 | ai_absurd_twist_microdrama | `POV- When you and your friends start discussing art...#art #funny #kitten #ai #plating.mp4` | 0.00–10.17s | 有用補充片段；待人工核聽 |
| ai-10 | ai_absurd_twist_microdrama | `Oscar unlocked tiger mode 🐯 Created in @higgsfield.ai #higgsfield #catvideo #persiancat #funnyc.mp4` | 0.00–10.14s | 有用補充片段；待人工核聽 |
| ai-11 | ai_absurd_twist_microdrama | `Angel is smart 🤭#aicat #siamese #siamesecat#siamesecatsofinstagram #siamesecorner.mp4` | 0.00–8.52s | 有用補充片段；待人工核聽 |
| ai-09 | ai_continuity_ensemble_skit | `好有創意嘅AI影片天津市消防救援總隊近來用AI打造的消防宣導影片，靠著黑白無常從「接人」變「救人」的創意，成功讓網友們願意認真觀看，甚至被台灣網民轉貼到其他網上平台.mp4` | 0.00–20.00s | 有用補充片段；待人工核聽 |
| ai-05 | ai_artist_reflective_monologue | `The art walk#art #ai #monalisa #vangogh #davinci.mp4` | 0.00–20.18s | 有用補充片段；待人工核聽 |
| ai-06 | research_only | `What an incredible effect, totally shocked!This video is made by Dreamina Seedance 2.0. Both 2.0.mp4` | 0.00–15.16s | 有用補充片段；待人工核聽 |

## 未解決缺口

- 所有 published 代表片及 Renee review 片的音訊人工逐句核聽數仍為 0。
- 外語片的繁體中文翻譯已提供，但仍標示待人工核對。
- 品牌、人物、歷史、地點、數字、價格、認證及功效只記錄原片說法，尚未完成外部事實核實。
- Published 12 目前沒有整段完全無法辨識；雙人短劇最後一段仍有局部短句待人工核聽，已在顯示稿內清楚標示。
- 排除片維持排除，不建立原稿；補充片不擴寫成全片。
