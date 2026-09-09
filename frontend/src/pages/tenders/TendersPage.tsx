import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '@/context/I18nContext'
import { Panel } from '@/components/ui/Card'
import { Select } from '@/components/ui/Fields'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Badge } from '@/components/ui/Badge'
import { DataTable } from '@/components/tables/DataTable'
import { formatCr, formatDate } from '@/utils/format'
import { TENDER_STATUS } from '@/utils/status'
import type { Tender } from '@/types'
import { tendersApi } from '@/api'
import { useApiData, useDebounced } from '@/hooks/useApiData'
import { TextField } from '@/components/ui/Fields'

/**
 * TendersPage — Tender & Procurement register.
 */
export function TendersPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { data: tenders, loading } = useApiData(() => tendersApi.all(), [])
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const debounced = useDebounced(search)

  const rows = (tenders ?? []).filter((x) => {
    if (status && x.status !== status) return false
    if (debounced && !(`${x.id} ${x.title}`.toLowerCase().includes(debounced.toLowerCase()))) return false
    return true
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-heading-1 text-fg">{t('nav.tenders')}</h1>
          <p className="mt-1 text-body-small text-fg-muted">e-Tender register — AI-assisted bid evaluation available per tender (mock data).</p>
        </div>
      </div>

      <Panel title={t('common.filters')} icon="filter_list" bodyClassName="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <TextField label={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} startIcon="search" />
          <Select
            label={t('common.status')}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={[{ value: '', label: t('common.all') }, ...Object.entries(TENDER_STATUS).map(([k, d]) => ({ value: k, label: t(d.key) }))]}
          />
        </div>
      </Panel>

      <Panel title={`${t('nav.tenders')} (${rows.length})`} icon="gavel" bodyClassName="p-0">
        {loading ? <div className="p-8 text-center text-body-small text-fg-muted">{t('common.loading')}</div> : (
          <DataTable<Tender>
            minWidth={1000}
            rows={rows}
            rowKey={(x) => x.id}
            columns={[
              { key: 'id', header: 'Tender No.', isRowHeader: true, render: (x) => <span className="nk-mono-id text-fg-muted">{x.id}</span> },
              { key: 'title', header: 'Title', render: (x) => <span className="block max-w-80 truncate" title={x.title}>{x.title}</span> },
              { key: 'status', header: t('common.status'), render: (x) => <StatusBadge descriptor={TENDER_STATUS[x.status]} size="sm" /> },
              { key: 'cost', header: 'Est. Cost', cellClassName: 'tabular-nums', render: (x) => formatCr(x.estimatedCostCr) },
              { key: 'deadline', header: 'Submission', cellClassName: 'tabular-nums', render: (x) => formatDate(x.submissionDeadline) },
              { key: 'bids', header: 'Bids', cellClassName: 'tabular-nums', render: (x) => x.bidsReceived },
              { key: 'mode', header: 'Mode', render: (x) => <Badge tone="neutral">{x.mode}</Badge> },
            ]}
            rowActions={(x) => (
              <Button variant="primary" size="sm" onClick={() => navigate(`/tenders/${encodeURIComponent(x.id)}`)}>
                {x.status === 'under_evaluation' ? 'Evaluate' : t('common.view')}
              </Button>
            )}
          />
        )}
      </Panel>
    </div>
  )
}
