import { notFound } from 'next/navigation'
import { Suspense } from 'react'

import { DashboardShell } from '@/components/DashboardShell'
import { getPipeline, getTool, pipelines } from '@/lib/pipelines'

interface PipelineToolPageProps {
  params: Promise<{
    pipeline: string
    tool: string
  }>
}

export function generateStaticParams() {
  return Object.values(pipelines).flatMap((pipeline) =>
    pipeline.tools.map((tool) => ({
      pipeline: pipeline.id,
      tool: tool.id,
    }))
  )
}

export default async function PipelineToolPage({ params }: PipelineToolPageProps) {
  const resolvedParams = await params
  const pipeline = getPipeline(resolvedParams.pipeline)
  if (!pipeline) notFound()

  const tool = getTool(pipeline.id, resolvedParams.tool)
  if (!tool) notFound()

  return (
    <Suspense>
      <DashboardShell activeSection="pipeline" pipeline={pipeline} tool={tool} />
    </Suspense>
  )
}
