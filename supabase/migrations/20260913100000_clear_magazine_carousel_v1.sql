alter table public.intelligence_inbox_items
  add column if not exists media_children jsonb not null default '[]'::jsonb;

alter table public.intelligence_inbox_items
  drop constraint if exists intelligence_inbox_items_media_children_array;
alter table public.intelligence_inbox_items
  add constraint intelligence_inbox_items_media_children_array
  check (jsonb_typeof(media_children) = 'array');

-- Preserve any children already captured in raw_payload. The next normal
-- collector run refreshes older carousel rows that were fetched without them.
update public.intelligence_inbox_items
set media_children = raw_payload->'children'->'data', updated_at = now()
where media_type = 'CAROUSEL_ALBUM'
  and jsonb_typeof(raw_payload->'children'->'data') = 'array'
  and media_children = '[]'::jsonb;

insert into public.content_styles(id,code,format,name,description,status,scope,source_workspace_id)
values (
  'ca000002-0000-4000-8000-000000000001'::uuid,
  'clear_magazine_carousel',
  'instagram_carousel',
  '清晰雜誌風',
  '以克制留白、清楚標題層級與影像主導的三段節奏，將題材整理成易讀、可保存的雜誌式輪播。',
  'active','public_research','a5c7750e-1b3b-495b-8cd3-6e1d47d05ef2'::uuid
)
on conflict (code) do nothing;

insert into public.style_versions(id,style_id,version,rules,change_summary,status)
select 'ca100002-0000-4000-8000-000000000001'::uuid,s.id,1,
  '{
    "schema_version": 1,
    "format": "instagram_carousel",
    "display_name": "清晰雜誌風",
    "intent": "editorial clarity without copying any source brand identity or exact layout",
    "slide_count": {"min": 3, "recommended": 6, "max": 10},
    "canvas": {"aspect_ratio": "4:5", "width": 1080, "height": 1350, "safe_margin_percent": 7},
    "hierarchy": {"eyebrow": "optional short category", "headline_lines_max": 3, "headline_chars_zh_max": 24, "supporting_copy_chars_zh_max": 72, "page_number": true},
    "spacing": {"outer_margin": "generous", "content_density": "low_to_medium", "one_primary_message_per_slide": true},
    "imagery": {"cover_ratio": "full_bleed_or_70_percent", "content_ratio": "45_to_65_percent", "crop": "editorial_subject_led", "overlay": "subtle_gradient_when_required_for_legibility"},
    "sequence": ["cover_hook", "context", "evidence_or_detail", "progression", "takeaway", "soft_cta"],
    "roles": {"cover": "one visual and one decisive headline", "content": "image-led evidence with a concise explanatory block", "end": "standalone takeaway plus save/share CTA"},
    "typography": {"families": "creator_brand_fonts", "headline": "display_or_serif_allowed", "body": "high_legibility_sans_or_serif", "contrast": "clear_size_and_weight_steps", "max_families": 2},
    "colour": {"palette": "creator_brand_palette", "contrast": "wcag_aa_for_body_text", "accent_count_max": 1},
    "cta": {"tone": "soft_editorial", "allowed": ["save", "share", "read_more"], "forced_engagement": false},
    "originality": {"copy_source_brand_marks": false, "copy_exact_composition": false, "copy_distinctive_trade_dress": false, "apply_only_general_visual_principles": true},
    "preview": {
      "aspect_ratio": "4:5",
      "slides": [
        {"role": "cover", "eyebrow": "城市觀察", "headline": "一條街，如何重新長出生活感？", "supporting_text": "從三個細節看見地方正在改變", "image_treatment": "full_bleed_photo_with_bottom_gradient", "layout": "top_eyebrow_bottom_left_headline", "page_label": "01"},
        {"role": "content", "eyebrow": "細節 01", "headline": "先讓人願意停下來", "supporting_text": "座椅、樹蔭與步行尺度，比大型地標更直接地改變日常使用方式。", "image_treatment": "upper_60_percent_editorial_crop", "layout": "image_top_text_bottom_with_rule", "page_label": "02"},
        {"role": "end", "eyebrow": "帶走一句", "headline": "好的地方感，來自被照顧的日常。", "supporting_text": "收藏這份觀察，下次散步時再看看你的城市。", "image_treatment": "quiet_tinted_detail_crop", "layout": "centered_takeaway_with_soft_cta", "page_label": "03"}
      ]
    },
    "compliance": {"claims_require_source": true, "private_client_data_forbidden": true, "image_rights_required": true}
  }'::jsonb,
  'v1 distilled from ten reviewed public carousel references; adds a concrete cover/content/end preview contract.',
  'draft'
from public.content_styles s where s.code='clear_magazine_carousel'
on conflict (style_id,version) do nothing;

with supplied(shortcode,source_url) as (
  values
    ('DdJOcLTCRuU','https://www.instagram.com/p/DdJOcLTCRuU/'),
    ('DdI4nM7iaI-','https://www.instagram.com/p/DdI4nM7iaI-/'),
    ('DdIY5GriTUC','https://www.instagram.com/p/DdIY5GriTUC/'),
    ('DdGCxJ7CS0J','https://www.instagram.com/p/DdGCxJ7CS0J/'),
    ('DdEgLjaj_lH','https://www.instagram.com/p/DdEgLjaj_lH/'),
    ('DdEHOM5CcaC','https://www.instagram.com/p/DdEHOM5CcaC/'),
    ('DdDlvMqCWnx','https://www.instagram.com/p/DdDlvMqCWnx/'),
    ('DdBp21ukSlh','https://www.instagram.com/p/DdBp21ukSlh/'),
    ('DdBh2W0Cbmo','https://www.instagram.com/p/DdBh2W0Cbmo/'),
    ('Dc8ajISAXUC','https://www.instagram.com/p/Dc8ajISAXUC/')
), matched as (
  select distinct on (x.shortcode) x.*,i.id inbox_id,i.workspace_id,i.source_account
  from supplied x join public.intelligence_inbox_items i on i.source_url like '%'||x.shortcode||'%'
  where i.platform='instagram' and lower(trim(leading '@' from coalesce(i.source_account,'')))='a_day_mag'
  order by x.shortcode,i.captured_at desc
)
insert into public.style_references(style_id,style_version_id,workspace_id,reference_type,intelligence_inbox_item_id,source_url,source_account,extracted_patterns,evidence_summary,evidence_level,confirmation_status,source_scope,confirmed_at)
select s.id,v.id,m.workspace_id,'intelligence_inbox',m.inbox_id,m.source_url,m.source_account,
  '{"headline_hierarchy":"short prominent headline over or beside editorial imagery","whitespace":"generous margins and restrained information density","image_ratio":"portrait 4:5 canvas with image-led crops","cover_rhythm":"single hook plus one dominant visual","content_rhythm":"one idea and one evidence image per page","cta_rhythm":"quiet takeaway and save/share prompt","originality_boundary":"general principles only; exclude logos, exact layouts, fonts, and brand identifiers"}'::jsonb,
  'Observed as one item in the supplied ten-post public research set; supports general hierarchy, spacing, imagery and carousel pacing rules only.',
  'observed','confirmed','public_research',now()
from matched m
join public.content_styles s on s.code='clear_magazine_carousel'
join public.style_versions v on v.style_id=s.id and v.version=1
where not exists (select 1 from public.style_references r where r.style_version_id=v.id and r.intelligence_inbox_item_id=m.inbox_id);

update public.style_versions v set status='review',reviewed_by=null
from public.content_styles s where v.style_id=s.id and s.code='clear_magazine_carousel' and v.version=1 and v.status='draft';

-- Fail closed: publish only when every supplied reference was captured and linked.
update public.style_versions v set status='published',published_by=null
from public.content_styles s
where v.style_id=s.id and s.code='clear_magazine_carousel' and v.version=1 and v.status='review'
  and (select count(*) from public.style_references r where r.style_version_id=v.id and r.confirmation_status='confirmed') = 10;

notify pgrst, 'reload schema';
