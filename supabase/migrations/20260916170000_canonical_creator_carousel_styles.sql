-- Promote the two Creator-only carousel styles into the canonical Core registry.
-- The older editorial_contrast experiment was never exposed in Content Studio;
-- deprecating it keeps the active registry aligned with the four user-facing styles.

update public.content_styles
set status = 'deprecated', updated_at = now()
where code = 'editorial_contrast_carousel' and status = 'active';

insert into public.content_styles(id,code,format,name,description,status,scope,source_workspace_id)
values
  (
    'ca000004-0000-4000-8000-000000000001'::uuid,
    'product_focus',
    'instagram_carousel',
    '產品主角',
    '米白產品舞台，突出產品、功能及一個主要賣點。',
    'active','soon_owned','a5c7750e-1b3b-495b-8cd3-6e1d47d05ef2'::uuid
  ),
  (
    'ca000005-0000-4000-8000-000000000001'::uuid,
    'ranking_review',
    'instagram_carousel',
    '排行榜評測',
    '大圖主導、清晰排名及具內容感的編輯式評測。',
    'active','public_research','a5c7750e-1b3b-495b-8cd3-6e1d47d05ef2'::uuid
  )
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  status = 'active',
  updated_at = now();

insert into public.style_versions(id,style_id,version,rules,change_summary,status)
select 'ca100004-0000-4000-8000-000000000001'::uuid,s.id,1,
  '{
    "schema_version":1,
    "format":"instagram_carousel",
    "display_name":"產品主角",
    "intent":"give one product and one supported promise the clearest visual priority",
    "tone":"直接・商業",
    "palette":["#f8f6f0","#202126","#d9bbb5"],
    "structure":["產品與核心賣點必須在開首出現","由功能連接到具體使用情境","由賣點、證據、情境到 CTA"],
    "copy":["只突出一個主要承諾","所有產品聲稱必須有資料支持"],
    "visual":["使用米白背景、清晰資訊層次及大幅產品主視覺","產品保持清晰、比例可信及包裝一致","背景只支援產品，不搶去焦點"],
    "preview":{"required_count":3,"same_topic_and_assets":true,"status":"creator_generation_required"},
    "compliance":{"claims_require_source":true,"image_rights_required":true}
  }'::jsonb,
  'Canonical v1 promoted from the approved Creator product-focus style.','draft'
from public.content_styles s where s.code='product_focus'
on conflict (style_id,version) do nothing;

insert into public.style_versions(id,style_id,version,rules,change_summary,status)
select 'ca100005-0000-4000-8000-000000000001'::uuid,s.id,1,
  '{
    "schema_version":1,
    "format":"instagram_carousel",
    "display_name":"排行榜評測",
    "intent":"image-led ranked editorial review grounded only in supplied source material",
    "tone":"編輯式・具體",
    "palette":["#ffffff","#111111","#777777"],
    "structure":["封面先交代排行榜主題，其後每頁只介紹一個項目","各項目沿用一致的圖片、排名、名稱及評語次序"],
    "copy":["排名與產品名稱必須清晰，不補寫素材沒有提供的聲稱","正文只整理 Brief 及來源素材已有的特點、口感、用途或證據"],
    "visual":["封面使用全版主圖及黑底白字標題條","內容頁上半部為大圖，下半部為白底排名、標題及正文","固定左側直線、文字邊界、圖片比例與頁碼位置"],
    "preview":{"required_count":3,"same_topic_and_assets":true,"status":"creator_generation_required"},
    "compliance":{"claims_require_source":true,"image_rights_required":true}
  }'::jsonb,
  'Canonical v1 distilled from the six supplied ranked-review references.','draft'
from public.content_styles s where s.code='ranking_review'
on conflict (style_id,version) do nothing;

insert into public.style_references(style_id,style_version_id,workspace_id,reference_type,source_url,source_account,extracted_patterns,evidence_summary,evidence_level,confirmation_status,source_scope,confirmed_at)
select s.id,v.id,s.source_workspace_id,'external','local-reference://approved-product-focus-editor.png','user_supplied_reference',
  '{"reusable_principle":"warm off-white product stage with one dominant product and one supported promise","exclude_source_brand_identity":true}'::jsonb,
  'User-approved product-focus layout established through the Content Studio iteration.','observed','confirmed','soon_owned',now()
from public.content_styles s
join public.style_versions v on v.style_id=s.id and v.version=1
where s.code='product_focus'
  and not exists (select 1 from public.style_references r where r.style_version_id=v.id and r.source_url='local-reference://approved-product-focus-editor.png');

with refs(filename,position,evidence) as (values
  ('IMG_3813.jpg',1,'Full-bleed cover photograph with a high-contrast topic headline.'),
  ('IMG_3814.jpg',2,'Ranked entry with a large image, bold item name and substantial sourced review copy.'),
  ('IMG_3815.jpg',3,'Consistent image-first ranked entry composition.'),
  ('IMG_3816.jpg',4,'Consistent ranking hierarchy and readable editorial description.'),
  ('IMG_3817.jpg',5,'Repeated entry template supports fast comparison across items.'),
  ('IMG_3818.jpg',6,'Final ranked entry maintains image ratio, title and body rhythm.')
)
insert into public.style_references(style_id,style_version_id,workspace_id,reference_type,source_url,source_account,extracted_patterns,evidence_summary,evidence_level,confirmation_status,source_scope,confirmed_at)
select s.id,v.id,s.source_workspace_id,'external','local-reference://'||r.filename,'user_supplied_reference',
  jsonb_build_object('page_position',r.position,'reusable_principle',r.evidence,'exclude_source_brand_identity',true),
  r.evidence,'observed','confirmed','public_research',now()
from refs r
join public.content_styles s on s.code='ranking_review'
join public.style_versions v on v.style_id=s.id and v.version=1
where not exists (select 1 from public.style_references x where x.style_version_id=v.id and x.source_url='local-reference://'||r.filename);

update public.style_versions v set status='review'
from public.content_styles s
where v.style_id=s.id and s.code in ('product_focus','ranking_review') and v.version=1 and v.status='draft';

update public.style_versions v set status='published'
from public.content_styles s
where v.style_id=s.id and s.code in ('product_focus','ranking_review') and v.version=1 and v.status='review'
  and exists (select 1 from public.style_references r where r.style_version_id=v.id and r.confirmation_status='confirmed');

notify pgrst,'reload schema';
