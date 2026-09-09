import { useState } from 'react'
import { useI18n } from '@/context/I18nContext'
import { Panel } from '@/components/ui/Card'
import { Select, TextField } from '@/components/ui/Fields'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Badge } from '@/components/ui/Badge'
import { DataTable } from '@/components/tables/DataTable'
import { formatCr, formatDate } from '@/utils/format'
import { WORK_ORDER_STATUS, PRIORITY } from '@/utils/status'
import type { WorkOrder } from '@/types'
import { workApi } from '@/api'
import { useApiData, useDebounced } from '@/hooks/useApiData'
import { PROJECTS } from '@/data/projects'

/**
 * WorkOrdersPage — Work & Execution register: work orders with e-MB numbers,
 * defect liability and contractor linkage (spec section: Work & Execution).
 */
export function WorkOrdersPage() {
  const { t } = useI18n()
  const { data: orders, loading } = useApiData(() => workApi.workOrders(), [])
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const debounced = useDebounced(search)

  const projectName = (id: string) => PROJECTS.find((p) => p.id === id)?.name ?? id

  const rows = (orders ?? []).filter((w) => {
    if (status && w.status !== status) return false
    if (
      debounced &&
      !`${w.id} ${w.contractor} ${projectName(w.projectId)}`.toLowerCase().includes(debounced.toLowerCase())
    )
      return false
    return true
  })

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-heading-1 text-fg">Work Orders</h1>
        <p className="mt-1 text-body-small text-fg-muted">
          Issued work orders with measurement book (e-MB) references and defect liability (mock data).
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
              ...Object.entries(WORK_ORDER_STATUS).map(([k, d]) => ({ value: k, label: t(d.key) })),
            ]}
          />
        </div>
      </Panel>

      <Panel title={`Work Orders (${rows.length})`} icon="assignment" bodyClassName="p-0">
        {loading ? <div className="p-8 text-center text-body-small text-fg-muted">{t('common.loading')}</div> : (
          <DataTable<WorkOrder>
            minWidth={1050}
            rows={rows}
            rowKey={(w) => w.id}
            columns={[
              { key: 'id', header: 'Work Order No.', isRowHeader: true, render: (w) => <span className="nk-mono-id text-fg-muted">{w.id}</span> },
              { key: 'project', header: t('common.project'), render: (w) => <span className="block max-w-56 truncate" title={projectName(w.projectId)}>{projectName(w.projectId)}</span> },
              { key: 'contractor', header: t('common.contractor'), render: (w) => w.contractor },
              { key: 'status', header: t('common.status'), render: (w) => <StatusBadge descriptor={WORK_ORDER_STATUS[w.status]} size="sm" /> },
              { key: 'value', header: 'Value', cellClassName: 'tabular-nums', render: (w) => formatCr(w.valueCr) },
              { key: 'issued', header: 'Issued On', cellClassName: 'tabular-nums', render: (w) => formatDate(w.issuedOn) },
              { key: 'period', header: 'Period', cellClassName: 'tabular-nums', render: (w) => `${w.completionPeriodDays} ${t('common.days')}` },
              { key: 'mb', header: 'e-MB', render: (w) => <span className="nk-mono-id text-fg-muted">{w.measurementBookNo}</span> },
              { key: 'dl', header: 'Defect Liability', cellClassName: 'tabular-nums', render: (w) => <Badge tone="neutral" icon="verified_user">{w.defectLiabilityMonths} mo</Badge> },
            ]}
          />
        )}
      </Panel>

      <Panel title="Execution Discipline" icon="rule" subtitle="Standing checks applied to every running work order.">
        <ul className="flex flex-col gap-2 text-body-small text-fg">
          <li className="flex items-start gap-2">
            <StatusBadge descriptor={PRIORITY.high} size="sm" />
            Monthly e-MB entries must be recorded within 7 days of measurement.
          </li>
          <li className="flex items-start gap-2">
            <StatusBadge descriptor={PRIORITY.medium} size="sm" />
            Third-party quality tests are mandatory at every structural milestone.
          </li>
          <li className="flex items-start gap-2">
            <StatusBadge descriptor={PRIORITY.low} size="sm" />
            Suspension orders require a recorded reason and a review within 15 days.
          </li>
        </ul>
        <p className="mt-3 text-caption text-fg-subtle">{t('common.mockDataNote')}</p>
      </Panel>
    </div>
  )
}
