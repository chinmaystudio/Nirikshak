import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '@/context/I18nContext'
import { Panel, Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Fields'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Badge } from '@/components/ui/Badge'
import { DataTable } from '@/components/tables/DataTable'
import { formatDate, formatCr } from '@/utils/format'
import { LITIGATION_STATUS } from '@/utils/status'
import type { LitigationCase } from '@/types'
import { litigationApi } from '@/api'
import { useApiData } from '@/hooks/useApiData'

/**
 * LitigationPage — Litigation & Legal register: court cases tied to projects
 * or contractors, with hearing schedules and claim exposure.
 */
export function LitigationPage() {
  const { t } = useI18n()
  const { data: cases, loading } = useApiData(() => litigationApi.all(), [])
  const [status, setStatus] = useState('')

  const rows = useMemo(() => (cases ?? []).filter((c) => (status ? c.status === status : true)), [cases, status])

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-heading-1 text-fg">{t('nav.litigation')}</h1>
        <p className="mt-1 text-body-small text-fg-muted">
          Court cases and arbitrations touching departmental projects (mock data).
        </p>
      </div>

      <Panel title={t('common.filters')} icon="filter_list" bodyClassName="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Select
            label={t('common.status')}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={[
              { value: '', label: t('common.all') },
              ...Object.entries(LITIGATION_STATUS).map(([k, d]) => ({ value: k, label: t(d.key) })),
            ]}
          />
        </div>
      </Panel>

      <Panel title={`Cases (${rows.length})`} icon="gavel" bodyClassName="p-0">
        {loading ? <div className="p-8 text-center text-body-small text-fg-muted">{t('common.loading')}</div> : (
          <DataTable<LitigationCase>
            minWidth={1080}
            rows={rows}
            rowKey={(c) => c.id}
            columns={[
              { key: 'caseNo', header: 'Case No.', isRowHeader: true, render: (c) => <span className="nk-mono-id text-fg-muted">{c.caseNo}</span> },
              { key: 'title', header: 'Title', render: (c) => <span className="block max-w-64 truncate" title={c.title}>{c.title}</span> },
              { key: 'court', header: 'Court / Forum', render: (c) => <span className="text-caption">{c.court}</span> },
              { key: 'status', header: t('common.status'), render: (c) => <StatusBadge descriptor={LITIGATION_STATUS[c.status]} size="sm" /> },
              { key: 'project', header: t('common.project'), render: (c) => c.projectId
                ? <Link to={`/projects/${encodeURIComponent(c.projectId)}`} className="nk-mono-id text-primary-strong hover:underline">{c.projectId}</Link>
                : '—' },
              { key: 'hearing', header: 'Next Hearing', cellClassName: 'tabular-nums', render: (c) => (c.nextHearing ? formatDate(c.nextHearing) : '—') },
              { key: 'claim', header: 'Claim', cellClassName: 'tabular-nums', render: (c) => (c.claimAmountCr != null ? formatCr(c.claimAmountCr) : '—') },
            ]}
          />
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {rows.map((c) => (
          <Card key={c.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="nk-mono-id text-fg-muted">{c.caseNo}</p>
                <h3 className="mt-0.5 text-heading-3 text-fg">{c.title}</h3>
              </div>
              <StatusBadge descriptor={LITIGATION_STATUS[c.status]} size="sm" />
            </div>
            <p className="mt-2 text-body-small text-fg-muted">{c.summary}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="neutral" icon="account_balance">{c.court}</Badge>
              {c.contractor && <Badge tone="neutral" icon="engineering">{c.contractor}</Badge>}
              {c.claimAmountCr != null && <Badge tone="warning" icon="payments">{formatCr(c.claimAmountCr)}</Badge>}
              {c.nextHearing && <Badge tone="info" icon="event">Hearing {formatDate(c.nextHearing)}</Badge>}
            </div>
            <p className="mt-2 text-caption text-fg-subtle">Counsel: {c.counsel}</p>
          </Card>
        ))}
      </div>
      <p className="text-caption text-fg-subtle">{t('common.mockDataNote')}</p>
    </div>
  )
}
