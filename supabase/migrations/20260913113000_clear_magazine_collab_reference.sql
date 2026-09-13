-- One supplied post is authored by the_femin with a_day_mag as collaborator,
-- so business_discovery for a_day_mag correctly does not return it. Preserve
-- the real attribution and the API capture limitation instead of fabricating
-- an a_day_mag inbox row.
insert into public.style_references(
  id,style_id,style_version_id,workspace_id,reference_type,source_url,source_account,
  extracted_patterns,evidence_summary,evidence_level,confirmation_status,source_scope,confirmed_at
)
select
  'ca200002-0000-4000-8000-000000000010'::uuid,s.id,v.id,
  'a5c7750e-1b3b-495b-8cd3-6e1d47d05ef2'::uuid,'external',
  'https://www.instagram.com/p/DdEgLjaj_lH/',
  'the_femin + a_day_mag (collaboration)',
  '{"format":"carousel","collaboration":true,"child_capture_status":"meta_business_discovery_not_returned_for_collaborator"}'::jsonb,
  'Public Instagram carousel verified on 2026-09-13. It is authored by the_femin with a_day_mag as collaborator; Meta business discovery for a_day_mag does not expose this item or its children.',
  'observed','confirmed','public_research',now()
from public.content_styles s
join public.style_versions v on v.style_id=s.id and v.version=1
where s.code='clear_magazine_carousel'
on conflict (id) do nothing;

-- Publish only if the references cover all ten exact supplied URLs. This is
-- stricter than a raw reference count and remains safe if unrelated evidence
-- is added to the version later.
with supplied(source_url) as (
  values
    ('https://www.instagram.com/p/DdJOcLTCRuU/'),
    ('https://www.instagram.com/p/DdI4nM7iaI-/'),
    ('https://www.instagram.com/p/DdIY5GriTUC/'),
    ('https://www.instagram.com/p/DdGCxJ7CS0J/'),
    ('https://www.instagram.com/p/DdEgLjaj_lH/'),
    ('https://www.instagram.com/p/DdEHOM5CcaC/'),
    ('https://www.instagram.com/p/DdDlvMqCWnx/'),
    ('https://www.instagram.com/p/DdBp21ukSlh/'),
    ('https://www.instagram.com/p/DdBh2W0Cbmo/'),
    ('https://www.instagram.com/p/Dc8ajISAXUC/')
), complete as (
  select v.id
  from public.style_versions v
  join public.content_styles s on s.id=v.style_id
  where s.code='clear_magazine_carousel' and v.version=1 and v.status='review'
    and not exists (
      select 1 from supplied x
      where not exists (
        select 1 from public.style_references r
        where r.style_version_id=v.id
          and r.confirmation_status='confirmed'
          and r.source_scope='public_research'
          and r.source_url=x.source_url
      )
    )
)
update public.style_versions v
set status='published',published_by=null
from complete c where v.id=c.id;

notify pgrst, 'reload schema';
