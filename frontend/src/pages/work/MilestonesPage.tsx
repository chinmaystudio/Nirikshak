import { useMemo, useState } from 'react'
import { useI18n } from '@/context/I18nContext'
import { Panel } from '@/components/ui/Card'
import { Select, TextField } from '@/components/ui/Fields'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { DataTable } from '@/components/tables/DataTable'
import { Progress } from '@/components/ui/Progress'
import { formatDate } from '@/utils/format'
import { MILESTONE_STATUS } from '@/utils/status'
import type { Milestone } from '@/types'
import { useApiData, useDebounced } from '@/hooks/useApiData'
import { PROJECTS } from '@/data/projects'

/**
 * MilestonesPage — Milestones & Inspections overview across the portfolio:
 * milestone register with delay days and physical progress per milestone.
 */
export function MilestonesPage() {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const debounced = useDebounced(search)
  const [status, setStatus] = useState('')

  // Milestones are embedded in projects; flatten once.
  const all = useMemo(() => PROJECTS.flatMap((p) => p.milestones), [])
  const { data } = useApiData(() => Promise.resolve(all), [all])
  const projectName = (id: string) => PROJECTS.find((p) => p.id === id)?.name ?? id

  const rows = (data ?? all).filter((m) => {
    if (status && m.status !== status) return false
    if (debounced && !`${m.id} ${m.title} ${projectName(m.projectId)}`.toLowerCase().includes(debounced.toLowerCase()))
      return false
    return true
  })

  const delayedCount = rows.filter((m) => m.status === 'delayed' || m.status === 'blocked').length

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-heading-1 text-fg">Milestones & Inspections</h1>
        <p className="mt-1 text-body-small text-fg-muted">
          Portfolio-wide milestone register — {rows.length} milestones, {delayedCount} delayed or blocked (mock data).
        </p>
      </div>

      <Panel title={t('common.filters')} icon="filter_list" bodyClassName="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <TextField label={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} startIcon="search" />
          <Select
            label={t('common.status')}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={[
              { value: '', label: t('common.all') },
              ...Object.entries(MILESTONE_STATUS).map(([k, d]) => ({ value: k, label: t(d.key) })),
            ]}
          />
        </div>
      </Panel>

      <Panel title={`${t('common.milestones')} (${rows.length})`} icon="flag" bodyClassName="p-0">
        <DataTable<Milestone>
          minWidth={1080}
          rows={rows}
          rowKey={(m) => m.id}
          columns={[
            { key: 'id', header: 'Milestone ID', isRowHeader: true, render: (m) => <span className="nk-mono-id text-fg-muted">{m.id}</span> },
            { key: 'title', header: 'Milestone', render: (m) => <span className="block max-w-56 truncate" title={m.title}>{m.title}</span> },
            { key: 'project', header: t('common.project'), render: (m) => <span className="nk-mono-id text-fg-muted">{m.projectId}</span> },
            { key: 'name', header: 'Project Name', render: (m) => <span className="block max-w-52 truncate text-fg-muted" title={projectName(m.projectId)}>{projectName(m.projectId)}</span> },
            { key: 'status', header: t('common.status'), render: (m) => <StatusBadge descriptor={MILESTONE_STATUS[m.status]} size="sm" /> },
            { key: 'plannedEnd', header: 'Planned End', cellClassName: 'tabular-nums', render: (m) => formatDate(m.plannedEnd) },
            { key: 'delay', header: 'Delay', cellClassName: 'tabular-nums', render: (m) => (m.delayDays ? <span className="text-danger-strong">{m.delayDays} {t('common.days')}</span> : '—') },
            { key: 'progress', header: t('common.progress'), render: (m) => <Progress value={m.physicalProgressPct} label={`${m.title} progress`} size="sm" className="min-w-28" /> },
          ]}
        />
      </Panel>
    </div>
  )
}
