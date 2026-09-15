insert into public.content_styles(id,code,format,name,description,status,scope,source_workspace_id)
values (
  'ca000003-0000-4000-8000-000000000001'::uuid,'editorial_office_flash','instagram_carousel','冷調閃光編輯風',
  '時裝雜誌式直接閃光攝影結合辦公室情境與資訊層級；適合用人物及負空間承載科普、品牌觀點與分享型內容。',
  'active','public_research','a5c7750e-1b3b-495b-8cd3-6e1d47d05ef2'::uuid
) on conflict (code) do nothing;

insert into public.style_versions(id,style_id,version,rules,change_summary,status)
select 'ca100003-0000-4000-8000-000000000001'::uuid,s.id,1,
  '{
    "schema_version":1,"format":"instagram_carousel","display_name":"冷調閃光編輯風",
    "intent":"fashion editorial office scenario for factual information; never copy source brand names, logos, copy or distinctive trade dress",
    "canvas":{"width":1080,"height":1350,"aspect_ratio":"4:5","full_bleed_photography":true,"negative_space":"large_off_white_or_grey_walls"},
    "photography":{"lighting":"direct_flash","exposure":"high","saturation":"low","shadow":"hard","palette":"cool_grey_white","accent":"cobalt_blue","no_stretch":true,"protect_face_from_overlays":true},
    "continuity":{"same_character":true,"same_location":true,"consistent_styling":true,"ai_generation_lock":["character","wardrobe","space","camera","colour_grade"]},
    "typography":{"family":"workspace_brand_font_sans","headline":"bold","body":"regular","brand_microcopy":"workspace_logo_or_tagline_only","page_number":"small_low_interference"},
    "information_ui":{"highlight":"single_translucent_light_blue_rectangle","text":"cobalt_blue","decoration":"thin_lines_with_round_endpoints","max_primary_highlights_per_slide":1},
    "sequence":[
      {"position":1,"role":"cover_hook","layout":"full_bleed_scenario_portrait; large white headline bottom-left; small swipe pill"},
      {"position":2,"role":"evidence_authority","layout":"subject right_or_center; blue highlight across mid-lower area; 2-3 body lines"},
      {"position":3,"role":"key_result_mechanism","layout":"same scene new pose; highlight bar plus concise explanation"},
      {"position":4,"role":"share_cta","layout":"large negative space; smaller centered subject; tag interaction line at top with blue frame"},
      {"position":5,"role":"transition_commentary","layout":"closer emotional portrait; 2-3 white transition lines only"},
      {"position":6,"role":"summary_lookbook","layout":"clipboard or moodboard 2x3 image grid; brand-colour headline at top"}
    ],
    "suitable_for":["fashion","lifestyle","brand_point_of_view","science_and_health_information","myth_busting","research_summary","social_sharing"],
    "not_suitable_for":["dense_data_tables","long_step_by_step_tutorials","multi_image_product_detail_comparisons"],
    "generation":{"use_confirmed_story":true,"use_step4_real_or_ai_images":true,"placeholder_preview_forbidden":true,"facts_from_confirmed_sources_only":true,"content_not_bound_to_reference_copy":true,"per_slide_editable":true},
    "preview":{"required_count":3,"same_topic_and_assets":true,"status":"creator_generation_required"},
    "compliance":{"copy_source_brand_marks":false,"copy_source_copy":false,"claims_require_source":true,"image_rights_required":true}
  }'::jsonb,
  'Initial v1 distilled from six supplied public editorial carousel references.','draft'
from public.content_styles s where s.code='editorial_office_flash'
on conflict (style_id,version) do nothing;

with refs(filename,position,evidence) as (values
  ('IMG_3819.jpg',1,'Cover hook: full-bleed office portrait, large lower-left white headline and small swipe pill.'),
  ('IMG_3820.jpg',2,'Evidence page: direct-flash portrait, one translucent blue authority highlight and concise body copy.'),
  ('IMG_3821.jpg',3,'Mechanism page: consistent character and office world with blue result highlight.'),
  ('IMG_3822.jpg',4,'Share CTA: strong negative space, reduced subject scale and a single framed interaction line.'),
  ('IMG_3823.jpg',5,'Commentary transition: closer emotional image with restrained white copy and breathing room.'),
  ('IMG_3824.jpg',6,'Summary lookbook: clipboard metaphor and 2x3 image grid for recap or collection.')
)
insert into public.style_references(style_id,style_version_id,workspace_id,reference_type,source_url,source_account,extracted_patterns,evidence_summary,evidence_level,confirmation_status,source_scope,confirmed_at)
select s.id,v.id,s.source_workspace_id,'external','local-reference://'||r.filename,'user_supplied_reference',
  jsonb_build_object('page_position',r.position,'reusable_principle',r.evidence,'exclude_source_brand_identity',true),
  r.evidence,'observed','confirmed','public_research',now()
from refs r join public.content_styles s on s.code='editorial_office_flash'
join public.style_versions v on v.style_id=s.id and v.version=1
where not exists (select 1 from public.style_references x where x.style_version_id=v.id and x.source_url='local-reference://'||r.filename);

update public.style_versions v set status='review'
from public.content_styles s where v.style_id=s.id and s.code='editorial_office_flash' and v.version=1 and v.status='draft';
update public.style_versions v set status='published'
from public.content_styles s where v.style_id=s.id and s.code='editorial_office_flash' and v.version=1 and v.status='review'
  and (select count(*) from public.style_references r where r.style_version_id=v.id and r.confirmation_status='confirmed')=6;

notify pgrst,'reload schema';
