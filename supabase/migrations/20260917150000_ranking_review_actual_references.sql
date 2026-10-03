-- Publish a new immutable version backed by project-owned, deployable assets.

insert into public.style_versions(id,style_id,version,rules,change_summary,status)
select
  'ca100005-0000-4000-8000-000000000002'::uuid,
  s.id,
  2,
  jsonb_set(
    jsonb_set(v.rules, '{preview,actual_reference_required}', 'true'::jsonb, true),
    '{duplication_policy}',
    '{"six_references":"one cover plus five consistent ranked-entry examples","reference_roles":2}'::jsonb,
    true
  ),
  'Bound six actual ranking-review assets; distilled them into one cover and one reusable ranked-entry family.',
  'draft'
from public.content_styles s
join public.style_versions v on v.style_id=s.id and v.version=1
where s.code='ranking_review'
on conflict (style_id,version) do update set
  rules=excluded.rules,
  change_summary=excluded.change_summary;

with refs(filename,position,evidence,layout_family,duplicate_variant) as (values
  ('01-cover.jpg',1,'Full-bleed food photograph with high-contrast bilingual ranking hook in the lower third.','cover_hook',false),
  ('02-rank-1.jpg',2,'Ranked entry with a large food image, white editorial panel, left rule, bold rank and substantial sourced review copy.','ranked_entry',false),
  ('03-rank-2.jpg',3,'Repeated ranked-entry structure confirms the shared image ratio, title hierarchy and body rhythm.','ranked_entry',true),
  ('04-rank-3.jpg',4,'Repeated ranked-entry structure confirms consistent comparison across products.','ranked_entry',true),
  ('05-rank-4.jpg',5,'Repeated ranked-entry structure confirms consistent comparison across products.','ranked_entry',true),
  ('06-rank-5.jpg',6,'Final ranked entry preserves the same image, rank, title and review hierarchy.','ranked_entry',true)
)
insert into public.style_references(style_id,style_version_id,workspace_id,reference_type,source_url,source_account,extracted_patterns,evidence_summary,evidence_level,confirmation_status,source_scope,confirmed_at)
select s.id,v.id,s.source_workspace_id,'external','/templates/ranking-review-v1/'||r.filename,'user_supplied_reference',
  jsonb_build_object(
    'page_position',r.position,
    'layout_family',r.layout_family,
    'duplicate_variant',r.duplicate_variant,
    'reusable_principle',r.evidence,
    'actual_asset_bound',true,
    'exclude_source_brand_identity',true
  ),
  r.evidence,'observed','confirmed','public_research',now()
from refs r
join public.content_styles s on s.code='ranking_review'
join public.style_versions v on v.style_id=s.id and v.version=2
where not exists (
  select 1 from public.style_references x
  where x.style_version_id=v.id
    and x.source_url='/templates/ranking-review-v1/'||r.filename
);

update public.style_versions v
set status = 'review'
from public.content_styles s
where v.style_id=s.id
  and s.code='ranking_review'
  and v.version=2
  and v.status='draft';

update public.style_versions v
set status = 'published'
from public.content_styles s
where v.style_id=s.id
  and s.code='ranking_review'
  and v.version=2
  and v.status='review'
  and (select count(*) from public.style_references r where r.style_version_id=v.id and r.confirmation_status='confirmed')=6;

notify pgrst,'reload schema';
