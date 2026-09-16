import { TemplateMasterEditor } from '@/components/TemplateMasterEditor'

export default async function TemplateEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>
  searchParams: Promise<{ draft?: string }>
}) {
  const [{ code }, query] = await Promise.all([params, searchParams])
  return <TemplateMasterEditor draftId={query.draft || ''} styleCode={code} />
}
