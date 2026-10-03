insert into public.industry_taxonomy_nodes
  (code,parent_code,label_zh,label_en,description,monitor_profile,compliance_level,status,taxonomy_version,sort_order)
values
  (
    'technology_information',
    null,
    '科技資訊',
    'Technology & Digital Information',
    '人工智能、消費科技、數碼產品、軟件、平台及科技產業資訊。',
    '{"topics":["人工智能","消費科技","數碼產品","軟件工具","平台趨勢","科技產業"],"signals":["product_launch","platform_update","ai_release","technology_explainer","industry_shift"],"preferred_formats":["carousel","reels","threads","explainer"]}'::jsonb,
    'standard',
    'active',
    1,
    80
  )
on conflict (code) do update set
  parent_code=excluded.parent_code,
  label_zh=excluded.label_zh,
  label_en=excluded.label_en,
  description=excluded.description,
  monitor_profile=excluded.monitor_profile,
  compliance_level=excluded.compliance_level,
  status='active',
  sort_order=excluded.sort_order,
  updated_at=now();

insert into public.industry_taxonomy_aliases(alias,code,language) values
  ('科技','technology_information','zh-HK'),
  ('科技資訊','technology_information','zh-HK'),
  ('人工智能','technology_information','zh-HK'),
  ('AI','technology_information','en'),
  ('數碼產品','technology_information','zh-HK'),
  ('消費科技','technology_information','zh-HK')
on conflict (alias) do update set code=excluded.code,language=excluded.language;

notify pgrst, 'reload schema';
