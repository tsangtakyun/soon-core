insert into public.content_styles(id,code,format,name,description,status,scope,source_workspace_id)
values
  (
    'ca000007-0000-4000-8000-000000000001'::uuid,'classical_culture_remix','instagram_carousel','古典文化拼貼',
    '以古典名畫或文化圖像為主視覺，配合幽默二創、粗體資訊層與文化解說；適合藝術、文化與趣味知識內容。',
    'active','public_research','a5c7750e-1b3b-495b-8cd3-6e1d47d05ef2'::uuid
  ),
  (
    'ca000008-0000-4000-8000-000000000001'::uuid,'quiet_research_editorial','instagram_carousel','沉靜研究敘事',
    '低飽和人物與空間攝影、克制明體及留白，交替使用照片、純色證據頁與結論頁；適合身心、研究與深度知識內容。',
    'active','public_research','a5c7750e-1b3b-495b-8cd3-6e1d47d05ef2'::uuid
  )
on conflict (code) do update set
  name=excluded.name,
  description=excluded.description,
  status='active';

insert into public.style_versions(id,style_id,version,rules,change_summary,status)
select 'ca100007-0000-4000-8000-000000000001'::uuid,s.id,1,
  '{
    "schema_version":1,"format":"instagram_carousel","display_name":"古典文化拼貼",
    "intent":"classical-art-led cultural storytelling with an unexpected contemporary subject; derive composition only and never copy the source logo, account name, exact artwork remix, wording or brand identity",
    "canvas":{"width":1080,"height":1350,"aspect_ratio":"4:5","safe_margin":64,"full_bleed_artwork":true},
    "palette":{"source_image_led":true,"text":"high_contrast_white","overlay":"warm_translucent_or_dark_gradient"},
    "typography":{"headline":"bold_grotesk_or_brand_font","body":"bold_readable_sans","editorial_mark":"contrasting_serif"},
    "page_families":[
      {"role":"cover_hook","layout":"full-bleed classical artwork with contemporary visual interruption and large lower-third headline"},
      {"role":"editorial_explanation","layout":"full-bleed artwork with dark readability gradient, compact title and substantial body copy"},
      {"role":"visual_interlude","layout":"artwork-led breathing page with minimal or no body copy"}
    ],
    "duplication_policy":{"four_references":"evidence for one coherent style, not four independent templates","reference_roles":3},
    "generation":{"use_confirmed_story":true,"facts_from_confirmed_sources_only":true,"use_step4_real_or_ai_images":true,"content_not_bound_to_reference_copy":true,"per_slide_editable":true},
    "preview":{"required_count":3,"same_topic_and_assets":true,"actual_reference_required":true},
    "compliance":{"copy_source_brand_marks":false,"copy_source_copy":false,"copy_source_artwork_remix":false,"image_rights_required":true}
  }'::jsonb,
  'Initial v1 distilled from four supplied classical-art remix references; four evidence files map to three reusable page families.','draft'
from public.content_styles s where s.code='classical_culture_remix'
on conflict (style_id,version) do update set rules=excluded.rules,change_summary=excluded.change_summary;

insert into public.style_versions(id,style_id,version,rules,change_summary,status)
select 'ca100008-0000-4000-8000-000000000001'::uuid,s.id,1,
  '{
    "schema_version":1,"format":"instagram_carousel","display_name":"沉靜研究敘事",
    "intent":"quiet research-led editorial storytelling using low-saturation photography, measured typography and alternating evidence layouts; derive composition only and never copy source branding or claims",
    "canvas":{"width":1080,"height":1350,"aspect_ratio":"4:5","safe_margin":72},
    "palette":{"background":"warm_taupe_cream_or_desaturated_photo","text":"ivory_or_dark_brown","accent":"muted_sand"},
    "typography":{"headline":"workspace_brand_serif_preferred","body":"readable_serif_or_brand_font","emphasis":"selective_bold_not_all_bold"},
    "page_families":[
      {"position":1,"role":"cover_hook","layout":"cinematic full-bleed image with lower-third research hook"},
      {"position":2,"role":"full_image_body","layout":"soft darkened lifestyle image with short evidence-led paragraphs"},
      {"position":3,"role":"solid_evidence","layout":"plain warm field with research label, key statement and bullets"},
      {"position":4,"role":"atmospheric_body","layout":"architectural or atmospheric photo with modular text blocks"},
      {"position":5,"role":"symptom_or_keypoint_list","layout":"muted photo with spaced list and controlled icon accents"},
      {"position":6,"role":"text_transition","layout":"plain warm field with one short transition statement"},
      {"position":7,"role":"conclusion","layout":"quiet landscape image with closing synthesis"},
      {"position":8,"role":"engagement_cta","layout":"minimal cream CTA page"}
    ],
    "duplication_policy":{"eight_references":"retain all because each confirms a distinct sequence role","reference_roles":8},
    "generation":{"use_confirmed_story":true,"facts_from_confirmed_sources_only":true,"claims_require_source":true,"use_step4_real_or_ai_images":true,"content_not_bound_to_reference_copy":true,"per_slide_editable":true},
    "preview":{"required_count":3,"same_topic_and_assets":true,"actual_reference_required":true},
    "compliance":{"copy_source_brand_marks":false,"copy_source_copy":false,"medical_or_scientific_claims_require_source":true,"image_rights_required":true}
  }'::jsonb,
  'Initial v1 distilled from eight supplied quiet research editorial references; all eight retain distinct sequence roles.','draft'
from public.content_styles s where s.code='quiet_research_editorial'
on conflict (style_id,version) do update set rules=excluded.rules,change_summary=excluded.change_summary;

with refs(filename,position,evidence,layout_family,duplicate_variant) as (values
  ('01-cover.jpg',1,'Cover evidence: classical artwork plus an unexpected contemporary subject and a large lower-third hook.','cover_hook',false),
  ('02-editorial.jpg',2,'Text-led evidence: full-bleed artwork, high-contrast title and substantial explanatory copy.','editorial_explanation',false),
  ('03-editorial.jpg',3,'Second editorial evidence confirms the reusable artwork, gradient and body-copy hierarchy.','editorial_explanation',true),
  ('04-visual-interlude.jpg',4,'Visual interlude evidence: artwork carries the page with minimal text.','visual_interlude',false)
)
insert into public.style_references(style_id,style_version_id,workspace_id,reference_type,source_url,source_account,extracted_patterns,evidence_summary,evidence_level,confirmation_status,source_scope,confirmed_at)
select s.id,v.id,s.source_workspace_id,'external','/templates/classical-culture-remix-v1/'||r.filename,'user_supplied_reference',
  jsonb_build_object('page_position',r.position,'layout_family',r.layout_family,'duplicate_variant',r.duplicate_variant,'reusable_principle',r.evidence,'actual_asset_bound',true,'exclude_source_brand_identity',true),
  r.evidence,'observed','confirmed','public_research',now()
from refs r join public.content_styles s on s.code='classical_culture_remix'
join public.style_versions v on v.style_id=s.id and v.version=1
where not exists (select 1 from public.style_references x where x.style_version_id=v.id and x.source_url='/templates/classical-culture-remix-v1/'||r.filename);

with refs(filename,position,evidence,layout_family) as (values
  ('01-cover.jpg',1,'Cinematic cover with a research-led question over a low-key red silhouette.','cover_hook'),
  ('02-full-image-body.jpg',2,'Full-image body page with restrained serif paragraphs and selected bold emphasis.','full_image_body'),
  ('03-evidence-card.jpg',3,'Solid warm evidence card with research label, key statement and concise bullets.','solid_evidence'),
  ('04-atmospheric-body.jpg',4,'Atmospheric architecture supports modular explanatory text.','atmospheric_body'),
  ('05-list.jpg',5,'Muted lifestyle image supports a spaced symptom or key-point list.','symptom_or_keypoint_list'),
  ('06-text-transition.jpg',6,'Plain warm transition page uses a short statement and generous negative space.','text_transition'),
  ('07-conclusion.jpg',7,'Quiet landscape conclusion synthesises the story without crowding the image.','conclusion'),
  ('08-cta.jpg',8,'Minimal cream CTA page closes the sequence.','engagement_cta')
)
insert into public.style_references(style_id,style_version_id,workspace_id,reference_type,source_url,source_account,extracted_patterns,evidence_summary,evidence_level,confirmation_status,source_scope,confirmed_at)
select s.id,v.id,s.source_workspace_id,'external','/templates/quiet-research-editorial-v1/'||r.filename,'user_supplied_reference',
  jsonb_build_object('page_position',r.position,'layout_family',r.layout_family,'duplicate_variant',false,'reusable_principle',r.evidence,'actual_asset_bound',true,'exclude_source_brand_identity',true),
  r.evidence,'observed','confirmed','public_research',now()
from refs r join public.content_styles s on s.code='quiet_research_editorial'
join public.style_versions v on v.style_id=s.id and v.version=1
where not exists (select 1 from public.style_references x where x.style_version_id=v.id and x.source_url='/templates/quiet-research-editorial-v1/'||r.filename);

update public.style_versions v set status='review'
from public.content_styles s where v.style_id=s.id and s.code in ('classical_culture_remix','quiet_research_editorial') and v.version=1 and v.status='draft';

update public.style_versions v set status='published'
from public.content_styles s where v.style_id=s.id and s.code='classical_culture_remix' and v.version=1 and v.status='review'
  and (select count(*) from public.style_references r where r.style_version_id=v.id and r.confirmation_status='confirmed')=4;

update public.style_versions v set status='published'
from public.content_styles s where v.style_id=s.id and s.code='quiet_research_editorial' and v.version=1 and v.status='review'
  and (select count(*) from public.style_references r where r.style_version_id=v.id and r.confirmation_status='confirmed')=8;

notify pgrst,'reload schema';
