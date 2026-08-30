begin;

insert into public.topic_items (
  slug, title, summary, why_now, hook, suggested_angles, content_formats,
  countries, regions, localities, languages, keywords, cover_url, cover_alt,
  status, published_at
)
values
  ('kaohsiung-neiwei-flea-market', '走入高雄時光隧道：週末限定的內惟古物跳蚤市集', '來源介紹高雄鼓山區內惟跳蚤市集，內容包括老派古物、手作創意及多個市集攤位。', '來源稱市集於星期六及星期日營業，具備週末行程潛力；實際開放安排及天氣影響請出發前再核實。', '行入呢個高雄週末市集，就好似突然返到幾十年前。', '["在古物市集用指定預算挖寶","高雄週末限定復古行程","由老派古物到手作商品的市集探索","最有年代感的市集物件","內惟周邊半日遊"]', array['short_video','carousel','story_series'], array['台灣'], array['高雄'], array['鼓山區','內惟'], array['zh-HK'], array['內惟跳蚤市集','高雄跳蚤市場','高雄週末市集','高雄古物','鼓山景點','復古文化','挖寶','手作市集'], 'https://soon-core.vercel.app/topic-covers/kaohsiung/kaohsiung-neiwei-flea-market.jpg', '高雄內惟古物跳蚤市集的復古攤位', 'published', now()),
  ('kaohsiung-retro-date-route', '換個復古造型再打保齡：高雄老派約會一日路線', '來源提出一條高雄復古約會路線，包括嫦娥理髮院、阿美陽春麵、北高雄保齡球及福生冰果室四個地點。', '原來源發布於 2024 年；四個地點的營業、預約及收費安排請出發前逐一核實。', '如果約會可以返到舊時代，你會先整復古髮型定去打保齡？', '["以復古造型完成一日高雄約會","由鹽埕到左營的懷舊體驗","朋友挑戰老派造型及娛樂","復古理髮、傳統小食、保齡球及冰果室路線","I人挑戰一日E人約會玩法"]', array['short_video','carousel','story_series'], array['台灣'], array['高雄'], array['鹽埕區','三民區','鼓山區','左營區'], array['zh-HK'], array['高雄約會','高雄復古行程','嫦娥理髮院','阿美陽春麵','北高雄保齡球','福生冰果室','高雄一日遊','老派約會'], 'https://soon-core.vercel.app/topic-covers/kaohsiung/kaohsiung-retro-date-route.jpg', '高雄復古造型老派約會路線', 'published', now()),
  ('kaohsiung-cactus-bunker-sunset', '碉堡、仙人掌與海上夕陽：高雄柴山隱蔽觀景點', '來源介紹位於高雄鼓山柴山一帶的仙人掌碉堡，主打碉堡、仙人掌及海上夕陽形成的景觀。', '前往前必須核實合法公共通道、進入限制、步行難度、天氣及生態注意事項；不建議為拍攝冒險闖入受限制位置。', '高雄城市旁邊，竟然藏住一個可以望海上日落嘅仙人掌碉堡。', '["仙人掌、碉堡與夕陽的攝影構圖","柴山半日戶外路線","高雄海景及日落拍攝","情侶夕陽行程","歷史空間與自然景觀的結合"]', array['short_video','carousel','single_image','story_series'], array['台灣'], array['高雄'], array['鼓山區','柴山','仙人掌碉堡'], array['zh-HK'], array['仙人掌碉堡','柴山','高雄夕陽','鼓山景點','高雄秘境','海景','碉堡','攝影地點'], 'https://soon-core.vercel.app/topic-covers/kaohsiung/kaohsiung-cactus-bunker-sunset.jpg', '高雄柴山仙人掌碉堡與海景', 'published', now()),
  ('kaohsiung-santaoshan-amusement-park', '走入老派遊樂園：旗山三桃山的迷宮、滾筒與空中腳踏車', '來源介紹高雄旗山三桃山遊樂園，提及九重葛花海、水濂洞迷宮、360 度大滾筒、三層樓滑梯、空中腳踏車、烤肉區及展演舞台等設施。', '原來源發布於 2023 年；目前營運、票價、營業時間、設施開放與安全限制均須出發前向場地方核實。', '呢個高雄老派遊樂園，仲保留住迷宮、大滾筒同空中腳踏車。', '["台灣懷舊遊樂園探索","親子挑戰園內老派遊樂設施","三層樓滑梯及空中腳踏車體驗","旗山親子一日遊","老派遊樂園與現代樂園的分別"]', array['short_video','carousel','story_series'], array['台灣'], array['高雄'], array['旗山區','三桃山遊樂園'], array['zh-HK'], array['三桃山遊樂園','旗山景點','高雄親子','懷舊遊樂園','空中腳踏車','水濂洞迷宮','高雄一日遊','戶外活動'], 'https://soon-core.vercel.app/topic-covers/kaohsiung/kaohsiung-santaoshan-amusement-park.jpg', '高雄旗山三桃山懷舊遊樂園', 'published', now()),
  ('kaohsiung-brown-sugar-buns', '一人限買三袋：高雄前鎮人氣黑糖小饅頭', '來源介紹高雄前鎮吉連手工包子的黑糖小饅頭，並稱每人限購三袋，每袋價格為新台幣 60 元。', '來源發布於 2026 年 8 月 12 日，屬近期內容；實際供應、價格、限購及營業時間仍請出發前核實。', '一袋 60 元，點解仲要限制每人只可以買三袋？', '["黑糖小饅頭限購原因","高雄前鎮平日限定小食","新台幣100元以下高雄手信","黑糖小饅頭製作及口感","實測來源所稱是否真的難買"]', array['short_video','carousel','story_series'], array['台灣'], array['高雄'], array['前鎮區'], array['zh-HK'], array['吉連手工包子','黑糖小饅頭','高雄前鎮','高雄小吃','銅板美食','限購美食','高雄手信','外帶美食'], 'https://soon-core.vercel.app/topic-covers/kaohsiung/kaohsiung-brown-sugar-buns.jpg', '高雄前鎮人氣黑糖小饅頭', 'published', now())
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
  cover_alt = excluded.cover_alt,
  status = 'published',
  published_at = coalesce(topic_items.published_at, now()),
  updated_at = now();

insert into public.topic_item_directions (topic_id, direction_id, is_primary, confidence)
select topic.id, mapping.direction_id, mapping.is_primary, mapping.confidence
from (values
  ('kaohsiung-neiwei-flea-market','travel-city',true,0.95), ('kaohsiung-neiwei-flea-market','travel-culture',false,0.90), ('kaohsiung-neiwei-flea-market','lifestyle',false,0.70),
  ('kaohsiung-retro-date-route','travel-city',true,0.95), ('kaohsiung-retro-date-route','travel-culture',false,0.90), ('kaohsiung-retro-date-route','lifestyle-relationship',false,0.85), ('kaohsiung-retro-date-route','food',false,0.70),
  ('kaohsiung-cactus-bunker-sunset','travel-city',true,0.90), ('kaohsiung-cactus-bunker-sunset','travel-culture',false,0.70), ('kaohsiung-cactus-bunker-sunset','lifestyle-health',false,0.65),
  ('kaohsiung-santaoshan-amusement-park','travel-city',true,0.90), ('kaohsiung-santaoshan-amusement-park','travel-culture',false,0.85), ('kaohsiung-santaoshan-amusement-park','lifestyle',false,0.70),
  ('kaohsiung-brown-sugar-buns','food',true,0.95), ('kaohsiung-brown-sugar-buns','travel-city',false,0.75)
) as mapping(slug,direction_id,is_primary,confidence)
join public.topic_items topic on topic.slug = mapping.slug
on conflict (topic_id,direction_id) do update set
  is_primary = excluded.is_primary,
  confidence = excluded.confidence;

insert into public.topic_sources (topic_id, url, source_name, source_title, published_at, notes)
select topic.id, source.url, source.source_name, source.source_title, source.published_at::timestamptz, source.notes
from (values
  ('kaohsiung-neiwei-flea-market','https://www.instagram.com/reels/DIp2m3eTmJn/','ygt1016','高雄神秘的古物跳蚤市集','2025-04-19','待核實：目前營運、週末開放安排、攤位數量及天氣休市安排。'),
  ('kaohsiung-retro-date-route','https://www.instagram.com/reels/C_A1sxyyJ5n/','nini_food0822','跟另一半在高雄來場復古約會','2024-08-23','待核實：四個地點目前營運、營業時間、預約、收費及交通次序。'),
  ('kaohsiung-cactus-bunker-sunset','https://www.instagram.com/reels/DPtPsrkE03Q/','skywei.tw','仙人掌碉堡｜高雄鼓山秘境','2025-10-12','待核實：合法公共通道、進入限制、路線難度、安全風險及生態注意事項。'),
  ('kaohsiung-santaoshan-amusement-park','https://www.instagram.com/reels/C1BafoDy7L3/','alex_a.ni__','高雄三桃山遊樂園','2023-12-18','待核實：目前營運、票價、營業時間、設施開放、安全限制及歷史資料。'),
  ('kaohsiung-brown-sugar-buns','https://www.instagram.com/reels/Db9-3TWTmwM/','master_food_diary','高雄最難買的黑糖小饅頭','2026-08-12','待核實：目前供應、價格、限購數量、營業時間及是否需要提早到場。')
) as source(slug,url,source_name,source_title,published_at,notes)
join public.topic_items topic on topic.slug = source.slug
on conflict (topic_id,url) do update set
  source_name = excluded.source_name,
  source_title = excluded.source_title,
  published_at = excluded.published_at,
  notes = excluded.notes;

commit;
