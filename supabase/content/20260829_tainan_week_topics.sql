begin;

insert into public.topic_items (
  slug, title, summary, why_now, hook, suggested_angles, content_formats,
  countries, regions, localities, languages, keywords, cover_url, status
)
values
  ('tainan-6000-beef-soup-queue', '凌晨兩點半攞籌：台南六千牛肉湯排隊體驗', 'Instagram Reel 介紹台南六千牛肉湯。來源稱凌晨二時半可以排隊領取號碼牌，早上五時開始叫號，售完即止。', '', '來台南，可能真係唔應該瞓覺。', '["台南失眠美食路線","凌晨排隊到清晨開餐的體驗","台南牛肉湯早餐文化","第一鍋湯是否真的最值得排隊"]', array['short_video','carousel','story_series'], array['台灣'], array['台南'], array['海安路'], array['zh-HK'], array['台南牛肉湯','六千牛肉湯','台南早餐','凌晨美食','排隊美食','海安路','台南失眠行程','在地美食'], 'https://soon-core.vercel.app/topic-covers/tainan/tainan-6000-beef-soup-queue.jpg', 'draft'),
  ('tainan-tobe-fresh-potato-chips', '赤崁樓旁即叫即炸：一整顆國產馬鈴薯製成的洋芋片', 'ToBe+兔彼炸物台南店位於赤崁樓附近。來源介紹整顆馬鈴薯即刨即炸的洋芋片，以及現點現炸雞翅。', '', '一整顆馬鈴薯，可以即場變成幾多塊洋芋片？', '["行完赤崁樓可以即買即食的小店","整顆馬鈴薯即刨即炸的製作過程","台南平價下午茶","赤崁樓周邊散步美食路線","現炸洋芋片與包裝薯片的口感比較"]', array['short_video','carousel','story_series'], array['台灣'], array['台南'], array['中西區','赤崁樓周邊'], array['zh-HK'], array['台南下午茶','赤崁樓美食','現炸洋芋片','ToBe兔彼炸物','台南中西區','台南小吃','散步美食','現炸雞翅'], 'https://soon-core.vercel.app/topic-covers/tainan/tainan-tobe-fresh-potato-chips.jpg', 'draft'),
  ('tainan-fotolab-peel-apart', '台南仿撕拉片體驗：不只人生四格的自助寫真玩法', '來源介紹 fotolab_tw 台南店的仿撕拉片、人生四格及自助寫真體驗。原帖的新年優惠購買及兌換期限均已過期。', '', '台南除咗食，仲可以同朋友玩一次仿撕拉片。', '["台南室內拍攝體驗","情侶或朋友旅行紀念照","仿撕拉片與真正菲林撕拉片的分別","台南下雨天備用行程","中西區食玩影相半日路線"]', array['short_video','carousel','story_series'], array['台灣'], array['台南'], array['中西區'], array['zh-HK'], array['台南撕拉片','台南拍貼機','自助寫真','台南情侶活動','台南室內景點','台南雨天行程','人生四格','fotolab'], 'https://soon-core.vercel.app/topic-covers/tainan/tainan-fotolab-peel-apart.jpg', 'draft'),
  ('tainan-guanmiao-sweet-potato', '關廟市場假日古早味：百頁蕃薯糖與伯伯的手藝', '來源介紹關廟公有零售市場旁的百頁蕃薯糖檔口，並稱檔主需要用多日處理地瓜，只在假日售賣。', '', '一星期準備五日，只賣兩日，究竟係咩古早味甜點？', '["台南假日限定市場甜點","百頁蕃薯糖的製作過程","關廟不只有鳳梨的地方飲食","沒有正式店名的市場熟客檔口","關廟市場及周邊半日美食路線"]', array['short_video','carousel','story_series'], array['台灣'], array['台南'], array['關廟區','關廟公有零售市場'], array['zh-HK'], array['關廟美食','百頁蕃薯糖','台南古早味','市場小吃','假日限定','台南甜點','傳統手藝','關廟一日遊'], 'https://soon-core.vercel.app/topic-covers/tainan/tainan-guanmiao-sweet-potato.jpg', 'draft'),
  ('tainan-divorce-500-sign', '「離婚500」點解成為台南街頭打卡話題？', 'Instagram Reel 介紹台南司法博物館附近的「離婚500」招牌，並稱該招牌受到日本遊客注意及已有相關周邊商品。', '來源發布於 2026 年 7 月 26 日並錄得約 8,588 個讚好，顯示近期有一定社交媒體關注。', '一塊寫住「離婚500」嘅招牌，點解會變成日本遊客打卡位？', '["街頭招牌如何變成網絡迷因","漢字在台灣與日本的跨文化閱讀","台南意想不到的打卡位置","司法博物館周邊趣味散步路線","街頭招牌紅到出現周邊商品的現象"]', array['short_video','carousel','single_image','story_series'], array['台灣'], array['台南'], array['中西區','司法博物館周邊'], array['zh-HK'], array['離婚500','台南打卡','司法博物館','台南街頭招牌','日本遊客','網絡迷因','台日文化','台南趣味景點'], 'https://soon-core.vercel.app/topic-covers/tainan/tainan-divorce-500-sign.jpg', 'draft'),
  ('tainan-succes-caramel-cheesecake', '敲開鏡面焦糖：台南每日限量炙燒生乳酪塔', 'Succès 希賽斯手感糖食的鏡面焦糖生乳酪塔以逐層炙燒焦糖殼為特色。來源介紹的口味為鏡面提拉米蘇生乳酪塔，並提及附有可可粉工具。', '', '敲開焦糖鏡面嗰一下，可能係成條片最療癒嘅三秒。', '["敲開焦糖鏡面的聲音與畫面","冷藏與冷凍食法的口感比較","逐層炙燒焦糖殼的製作過程","適合拍攝 ASMR 的台南甜點","由客人完成最後撒粉步驟的甜點體驗"]', array['short_video','carousel','story_series'], array['台灣'], array['台南'], array['東區'], array['zh-HK'], array['台南甜點','台南東區','鏡面焦糖','生乳酪塔','提拉米蘇','限量甜點','甜點ASMR','希賽斯手感糖食'], 'https://soon-core.vercel.app/topic-covers/tainan/tainan-succes-caramel-cheesecake.jpg', 'draft'),
  ('tainan-sinaojin-vintage-toys', '玩具迷的台南挖寶點：死腦筋選物所的美式復古世界', '死腦筋選物所販售美式復古玩具、設計服飾及特色選物。來源亦提及巨型 RAT FINK 公仔與 DIY 鎖匙扣體驗。', '', '玩具迷去台南，可能會喺呢間美式復古選物店失控。', '["巨型 RAT FINK 公仔的視覺焦點","台南中西區美式復古文化","DIY 旅行紀念鎖匙扣","台南雨天逛店路線","不以美食為主的台南半日行程"]', array['short_video','carousel','single_image','story_series'], array['台灣'], array['台南'], array['中西區'], array['zh-HK'], array['台南選物店','死腦筋選物所','美式復古','RAT FINK','玩具收藏','DIY鎖匙扣','台南購物','台南特色小店'], 'https://soon-core.vercel.app/topic-covers/tainan/tainan-sinaojin-vintage-toys.jpg', 'draft'),
  ('tainan-mahua-iron-pot-stew', '開鍋會膨脹的「蓋棉被」：台南巷內東北鐵鍋料理', '麻花東北鐵鍋燉位於台南中西區。來源介紹重慶麻辣鐵鍋燉、東北蓋被、鍋邊老麵饅頭及東北大拉皮，並指店內有多張適合多人用餐的大桌。', '', '一開鍋就膨脹，東北料理講嘅「蓋棉被」究竟係乜？', '["東北蓋被開鍋時的膨脹畫面","饅頭貼在鐵鍋邊加熱的做法","台南的東北地方料理","適合朋友聚餐的大鍋體驗","以開鍋瞬間製作高留存短片"]', array['short_video','carousel','story_series'], array['台灣'], array['台南'], array['中西區'], array['zh-HK'], array['台南東北菜','東北鐵鍋燉','東北蓋被','台南聚餐','台南中西區','特色火鍋','老麵饅頭','麻花東北鐵鍋燉'], 'https://soon-core.vercel.app/topic-covers/tainan/tainan-mahua-iron-pot-stew.jpg', 'draft')
on conflict (slug) do update set
  title = excluded.title,
  summary = excluded.summary,
  why_now = excluded.why_now,
  hook = excluded.hook,
  suggested_angles = excluded.suggested_angles,
  content_formats = excluded.content_formats,
  countries = excluded.countries,
  regions = excluded.regions,
  localities = excluded.localities,
  languages = excluded.languages,
  keywords = excluded.keywords,
  cover_url = excluded.cover_url,
  updated_at = now();

insert into public.topic_item_directions (topic_id, direction_id, is_primary, confidence)
select topic.id, mapping.direction_id, mapping.is_primary, mapping.confidence
from (values
  ('tainan-6000-beef-soup-queue','food',true,0.95), ('tainan-6000-beef-soup-queue','travel-city',false,0.85), ('tainan-6000-beef-soup-queue','travel-culture',false,0.75),
  ('tainan-tobe-fresh-potato-chips','food',true,0.95), ('tainan-tobe-fresh-potato-chips','travel-city',false,0.80),
  ('tainan-fotolab-peel-apart','lifestyle',true,0.90), ('tainan-fotolab-peel-apart','travel-city',false,0.85),
  ('tainan-guanmiao-sweet-potato','food',true,0.90), ('tainan-guanmiao-sweet-potato','travel-culture',false,0.90), ('tainan-guanmiao-sweet-potato','entertainment-people',false,0.70),
  ('tainan-divorce-500-sign','news-culture',true,0.95), ('tainan-divorce-500-sign','travel-city',false,0.85), ('tainan-divorce-500-sign','business-social',false,0.75),
  ('tainan-succes-caramel-cheesecake','food',true,0.95), ('tainan-succes-caramel-cheesecake','food-dining',false,0.85),
  ('tainan-sinaojin-vintage-toys','lifestyle',true,0.90), ('tainan-sinaojin-vintage-toys','travel-city',false,0.85), ('tainan-sinaojin-vintage-toys','travel-culture',false,0.70),
  ('tainan-mahua-iron-pot-stew','food',true,0.95), ('tainan-mahua-iron-pot-stew','food-dining',false,0.85), ('tainan-mahua-iron-pot-stew','travel-culture',false,0.65)
) as mapping(slug,direction_id,is_primary,confidence)
join public.topic_items topic on topic.slug = mapping.slug
on conflict (topic_id,direction_id) do update set
  is_primary = excluded.is_primary,
  confidence = excluded.confidence;

insert into public.topic_sources (topic_id, url, source_name, source_title, published_at, notes)
select topic.id, source.url, source.source_name, source.source_title, source.published_at::timestamptz, source.notes
from (values
  ('tainan-6000-beef-soup-queue','https://www.instagram.com/reels/DNDsjK6v3wT/','oxygen0301','台南美食📍大口吃，大口玩台南：六千牛肉湯','2025-08-07','待核實：完整地址、目前營業時間、休息日及領籌安排。'),
  ('tainan-tobe-fresh-potato-chips','https://www.instagram.com/reels/DWV5bzSkUtK/','weieatainan','赤崁樓旁的 ToBe+兔彼炸物現炸洋芋片','2026-03-26','待核實：營運狀態、目前價格、營業時間及休息日。'),
  ('tainan-fotolab-peel-apart','https://www.instagram.com/reels/DTC-uLWk-YY/','grace_tainan','台南也可以玩撕拉片了','2026-01-03','原帖優惠已過期。待核實目前營業、體驗、價格及預約方法。'),
  ('tainan-guanmiao-sweet-potato','https://www.instagram.com/reels/DB1ZjC2STHY/','maysun_boy','台南關廟百頁蕃薯糖','2024-11-01','待核實：正式名稱、營業日時間、歷史、製作需時及價格。'),
  ('tainan-divorce-500-sign','https://www.instagram.com/reels/DbQPV4ePPOm/','thebz1','台南的日本人打卡聖地：離婚500招牌','2026-07-26','待核實：確實地址、與司法博物館位置關係、日本旅客關注原因及周邊資料。'),
  ('tainan-succes-caramel-cheesecake','https://www.instagram.com/reels/DTxKI54D4J5/','foodiefoodiego','台南鏡面焦糖生乳酪塔','2026-01-21','待核實：營運狀態、產品供應、營業時間及預約方法。'),
  ('tainan-sinaojin-vintage-toys','https://www.instagram.com/reels/DCElT6WMSyU/','wu___foodie','台南美式復古選物店死腦筋選物所','2024-11-07','待核實：營業狀態、地址時間、公休日及 DIY 體驗。'),
  ('tainan-mahua-iron-pot-stew','https://www.instagram.com/reels/DBoRukphEae/','eattttin____eat','台南麻花東北鐵鍋燉與東北蓋被','2024-10-27','待核實：營業狀態、菜單價格、營業時間、訂位及店主背景。')
) as source(slug,url,source_name,source_title,published_at,notes)
join public.topic_items topic on topic.slug = source.slug
on conflict (topic_id,url) do update set
  source_name = excluded.source_name,
  source_title = excluded.source_title,
  published_at = excluded.published_at,
  notes = excluded.notes;

commit;
