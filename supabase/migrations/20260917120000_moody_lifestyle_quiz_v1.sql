insert into public.content_styles(id,code,format,name,description,status,scope,source_workspace_id)
values (
  'ca000006-0000-4000-8000-000000000001'::uuid,'moody_lifestyle_quiz','instagram_carousel','暮色生活測驗風',
  '暖灰生活照片、白色明體、半透明長文卡與互動測驗；適合人格測驗、生活觀察及高內容量敘事。',
  'active','public_research','a5c7750e-1b3b-495b-8cd3-6e1d47d05ef2'::uuid
) on conflict (code) do update set
  name=excluded.name,
  description=excluded.description,
  status='active';

insert into public.style_versions(id,style_id,version,rules,change_summary,status)
select 'ca100006-0000-4000-8000-000000000001'::uuid,s.id,1,
  '{
    "schema_version":1,"format":"instagram_carousel","display_name":"暮色生活測驗風",
    "intent":"warm, moody lifestyle photography for interactive quizzes and reflective longform content; never copy the source account, logo, wording, animal labels or distinctive brand identity",
    "canvas":{"width":1080,"height":1350,"aspect_ratio":"4:5","full_bleed_photography":true,"safe_margin":64},
    "palette":{"background":"warm_taupe_brown","text":"ivory_white","panel":"translucent_warm_grey","accent":"muted_cream"},
    "photography":{"mood":"quiet_warm_desaturated","subject":"lifestyle_or_nature_detail","overlay":"darken_for_readability","no_stretch":true,"protect_primary_subject":true},
    "typography":{"family":"workspace_brand_serif_preferred","fallback":"Georgia serif","headline":"bold","body":"medium","colour":"white","longform_alignment":"centered"},
    "components":{"section_label":"small_italic_serif_with_thin_rule","profile_panel":"large_translucent_rounded_rectangle","animal_motif":"optional_thin_line_illustration","page_number":"small_low_interference"},
    "page_families":[
      {"position":1,"role":"cover_hook","layout":"full-bleed warm lifestyle image; bold white headline in lower third; compact supporting line"},
      {"position":2,"role":"interactive_quiz","layout":"question and instructions above a rounded visual choice panel; numbered options below"},
      {"position":"3-8","role":"longform_profile","layout":"repeatable profile family with numbered title strip, keywords and one centered translucent longform panel"},
      {"position":9,"role":"engagement_cta","layout":"simplified full-bleed photo with central pale circle and like-save-share actions"}
    ],
    "duplication_policy":{"references_3_to_8":"evidence for one reusable longform family, not six separate templates","preserve_variation":"headline, keywords, line illustration and copy length may change"},
    "suitable_for":["interactive_quiz","personality_content","career_and_lifestyle_reflection","educational_longform","soft_editorial_storytelling"],
    "not_suitable_for":["dense_data_tables","hard_sell_product_catalogue","bright_high_energy_promotion"],
    "generation":{"use_confirmed_story":true,"use_step4_real_or_ai_images":true,"facts_from_confirmed_sources_only":true,"content_not_bound_to_reference_copy":true,"per_slide_editable":true},
    "preview":{"required_count":3,"same_topic_and_assets":true,"status":"creator_generation_required"},
    "compliance":{"copy_source_brand_marks":false,"copy_source_copy":false,"copy_source_personality_labels":false,"claims_require_source":true,"image_rights_required":true}
  }'::jsonb,
  'Initial v1 distilled from nine supplied public lifestyle quiz carousel references.','draft'
from public.content_styles s where s.code='moody_lifestyle_quiz'
on conflict (style_id,version) do update set
  rules=excluded.rules,
  change_summary=excluded.change_summary;

with refs(filename,position,evidence,layout_family,duplicate_variant) as (values
  ('01-cover.jpg',1,'Cover: warm full-bleed lifestyle photograph, compact editorial label and bold white lower-third hook.','cover_hook',false),
  ('02-quiz.jpg',2,'Interactive quiz: headline and instructions lead into a rounded visual choice panel with numbered answers.','interactive_quiz',false),
  ('03-profile-short.jpg',3,'Longform profile: numbered title strip, three keywords and a centered translucent rounded text panel.','longform_profile',false),
  ('04-profile-medium.jpg',4,'Repeated longform profile evidence with the same hierarchy and a taller copy block.','longform_profile',true),
  ('05-profile-team.jpg',5,'Repeated longform profile evidence showing alternate line illustration and copy density.','longform_profile',true),
  ('06-profile-strategy.jpg',6,'Repeated longform profile evidence showing stable title, keywords and glass panel structure.','longform_profile',true),
  ('07-profile-deep.jpg',7,'Repeated longform profile evidence for maximum editorial copy density.','longform_profile',true),
  ('08-profile-explore.jpg',8,'Repeated longform profile evidence showing the same reusable family with new content.','longform_profile',true),
  ('09-cta.jpg',9,'End CTA: simplified full-bleed background and central pale interaction circle for like, save and share.','engagement_cta',false)
)
insert into public.style_references(style_id,style_version_id,workspace_id,reference_type,source_url,source_account,extracted_patterns,evidence_summary,evidence_level,confirmation_status,source_scope,confirmed_at)
select s.id,v.id,s.source_workspace_id,'external','/templates/moody-lifestyle-quiz-v1/'||r.filename,'user_supplied_reference',
  jsonb_build_object(
    'page_position',r.position,
    'layout_family',r.layout_family,
    'duplicate_variant',r.duplicate_variant,
    'reusable_principle',r.evidence,
    'exclude_source_brand_identity',true
  ),
  r.evidence,'observed','confirmed','public_research',now()
from refs r join public.content_styles s on s.code='moody_lifestyle_quiz'
join public.style_versions v on v.style_id=s.id and v.version=1
where not exists (
  select 1 from public.style_references x
  where x.style_version_id=v.id and x.source_url='/templates/moody-lifestyle-quiz-v1/'||r.filename
);

update public.style_versions v set status='review'
from public.content_styles s where v.style_id=s.id and s.code='moody_lifestyle_quiz' and v.version=1 and v.status='draft';
update public.style_versions v set status='published'
from public.content_styles s where v.style_id=s.id and s.code='moody_lifestyle_quiz' and v.version=1 and v.status='review'
  and (select count(*) from public.style_references r where r.style_version_id=v.id and r.confirmation_status='confirmed')=9;

notify pgrst,'reload schema';
