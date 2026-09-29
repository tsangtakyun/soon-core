alter table public.template_draft_validation_tokens
  drop constraint if exists template_draft_validation_tokens_draft_id_check;

alter table public.template_draft_validation_tokens
  add constraint template_draft_validation_tokens_draft_id_check check (draft_id in (
    '2b1422f3-c42e-40d9-b7fe-632abc987797'::uuid,
    '38cd6d9c-274f-4683-943a-b415fbdcd1bb'::uuid,
    '3009c869-d6ac-42f1-b5d7-58cb4213e6cc'::uuid,
    'b0243911-4944-4eb4-9875-83f7ab0e4633'::uuid,
    '4bd2660a-1b13-4689-9780-4be8c3c129b0'::uuid,
    '3788b82e-40ab-46bd-a227-d0f32ea721aa'::uuid,
    '26ace544-0b9f-4047-bc75-ed8751c3d96c'::uuid,
    'a0e92f7d-136d-410c-a287-6d4a456106f5'::uuid,
    '96794188-4e0b-4807-8529-fe88cc062cbb'::uuid,
    '08fcdb25-1de1-4338-b74d-4807b460d74a'::uuid
  ));
