'use client'

import Link from 'next/link'

import { pipelines, type PipelineConfig, type PipelineTool } from '@/lib/pipelines'

interface PipelineDashboardProps {
  pipeline: PipelineConfig
  tool: PipelineTool
}

function PipelineToggle({ activeId }: { activeId: PipelineConfig['id'] }) {
  return (
    <div className="pipeline-toggle" aria-label="Pipeline selector">
      {Object.values(pipelines).map((pipeline) => {
        const firstTool = pipeline.tools[0]
        return (
          <Link
            key={pipeline.id}
            href={`/${pipeline.id}/${firstTool.id}`}
            className={pipeline.id === activeId ? 'active' : ''}
          >
            {pipeline.label}
          </Link>
        )
      })}
    </div>
  )
}

function ToolNav({
  pipeline,
  activeToolId,
}: {
  pipeline: PipelineConfig
  activeToolId: string
}) {
  return (
    <nav className="tool-nav" aria-label={`${pipeline.label} pipeline tools`}>
      {pipeline.tools.map((item) => (
        <Link
          key={item.id}
          href={`/${pipeline.id}/${item.id}`}
          className={item.id === activeToolId ? 'active' : ''}
        >
          <span className="tool-icon" aria-hidden="true">
            {item.icon}
          </span>
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  )
}

export function PipelineDashboard({ pipeline, tool }: PipelineDashboardProps) {
  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <div className="brand">SOON CORE</div>
        <PipelineToggle activeId={pipeline.id} />
        <ToolNav pipeline={pipeline} activeToolId={tool.id} />
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">Active Tool</p>
            <h1>{tool.label}</h1>
          </div>
          <span className="pipeline-badge">{pipeline.badge}</span>
        </header>

        <div className="iframe-wrap">
          <iframe
            key={tool.url}
            src={tool.url}
            title={`${pipeline.label} ${tool.label}`}
            referrerPolicy="no-referrer-when-downgrade"
            allow="camera; microphone; clipboard-read; clipboard-write; fullscreen"
          />
        </div>
      </section>

      <nav className="mobile-nav" aria-label="Mobile pipeline navigation">
        <PipelineToggle activeId={pipeline.id} />
        <ToolNav pipeline={pipeline} activeToolId={tool.id} />
      </nav>
    </div>
  )
}
