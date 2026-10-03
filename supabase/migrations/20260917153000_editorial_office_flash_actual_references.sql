-- Publish an immutable editorial-office version backed by project-owned assets.

insert into public.style_versions(id,style_id,version,rules,change_summary,status)
select
  'ca100003-0000-4000-8000-000000000002'::uuid,
  s.id,
  2,
  jsonb_set(
    jsonb_set(v.rules, '{preview,actual_reference_required}', 'true'::jsonb, true),
    '{duplication_policy}',
    '{"six_references":"six distinct page roles from one consistent editorial campaign","reference_roles":6}'::jsonb,
    true
  ),
  'Bound six actual cold-flash editorial assets covering the complete carousel sequence.',
  'draft'
from public.content_styles s
join public.style_versions v on v.style_id=s.id and v.version=1
where s.code='editorial_office_flash'
on conflict (style_id,version) do update set
  rules=excluded.rules,
  change_summary=excluded.change_summary;

with refs(filename,position,evidence,layout_family) as (values
  ('01-cover.jpg',1,'Full-bleed direct-flash office portrait with large lower-left white hook and restrained swipe cue.','cover_hook'),
  ('02-research-highlight.jpg',2,'Authority page with consistent character, cool office setting and one translucent cobalt research highlight.','evidence_authority'),
  ('03-key-finding.jpg',3,'Key finding page with a new pose, anchored blue result bar and concise supporting explanation.','key_result'),
  ('04-engagement-cta.jpg',4,'High-negative-space interaction page using a framed cobalt tag prompt above a smaller full-body subject.','share_cta'),
  ('05-photo-caption.jpg',5,'Emotional transition portrait with restrained white commentary and strong photographic breathing room.','transition_commentary'),
  ('06-lookbook-grid.jpg',6,'Clipboard lookbook summary using a 2x3 image grid and cobalt editorial heading.','summary_lookbook')
)
insert into public.style_references(style_id,style_version_id,workspace_id,reference_type,source_url,source_account,extracted_patterns,evidence_summary,evidence_level,confirmation_status,source_scope,confirmed_at)
select s.id,v.id,s.source_workspace_id,'external','/templates/editorial-office-flash-v1/'||r.filename,'user_supplied_reference',
  jsonb_build_object(
    'page_position',r.position,
    'layout_family',r.layout_family,
    'duplicate_variant',false,
    'reusable_principle',r.evidence,
    'actual_asset_bound',true,
    'exclude_source_brand_identity',true
  ),
  r.evidence,'observed','confirmed','public_research',now()
from refs r
join public.content_styles s on s.code='editorial_office_flash'
join public.style_versions v on v.style_id=s.id and v.version=2
where not exists (
  select 1 from public.style_references x
  where x.style_version_id=v.id
    and x.source_url='/templates/editorial-office-flash-v1/'||r.filename
);

update public.style_versions v
set status = 'review'
from public.content_styles s
where v.style_id=s.id
  and s.code='editorial_office_flash'
  and v.version=2
  and v.status='draft';

update public.style_versions v
set status = 'published'
from public.content_styles s
where v.style_id=s.id
  and s.code='editorial_office_flash'
  and v.version=2
  and v.status='review'
  and (select count(*) from public.style_references r where r.style_version_id=v.id and r.confirmation_status='confirmed')=6;

notify pgrst,'reload schema';
