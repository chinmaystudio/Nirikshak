import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '@/context/I18nContext'
import { Panel, Card } from '@/components/ui/Card'
import { Select, TextField } from '@/components/ui/Fields'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Badge } from '@/components/ui/Badge'
import { DataTable } from '@/components/tables/DataTable'
import { Modal } from '@/components/modals/Modal'
import { formatCr, formatDate, formatSlaCountdown } from '@/utils/format'
import { APPROVAL_STATUS, PRIORITY } from '@/utils/status'
import type { ApprovalItem } from '@/types'
import { approvalsApi } from '@/api'
import { useApiData, useDebounced } from '@/hooks/useApiData'

/**
 * ApprovalsPage — Approvals & Workflows queue. Every item exposes its full
 * audit trail (spec: audit trail on every action).
 */
export function ApprovalsPage() {
  const { t } = useI18n()
  const { data: approvals, loading } = useApiData(() => approvalsApi.all(), [])
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [search, setSearch] = useState('')
  const debounced = useDebounced(search)
  const [selected, setSelected] = useState<ApprovalItem | null>(null)

  const rows = useMemo(
    () =>
      (approvals ?? []).filter((a) => {
        if (status && a.status !== status) return false
        if (priority && a.priority !== priority) return false
        if (
          debounced &&
          !`${a.id} ${a.type} ${a.projectId} ${a.projectName}`.toLowerCase().includes(debounced.toLowerCase())
        )
          return false
        return true
      }),
    [approvals, status, priority, debounced],
  )

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-heading-1 text-fg">{t('nav.approvals')}</h1>
        <p className="mt-1 text-body-small text-fg-muted">
          Pending approvals with SLA due dates and a full audit trail on every action (mock data).
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
              ...Object.entries(APPROVAL_STATUS).map(([k, d]) => ({ value: k, label: t(d.key) })),
            ]}
          />
          <Select
            label={t('common.priority')}
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            options={[
              { value: '', label: t('common.all') },
              ...Object.entries(PRIORITY).map(([k, d]) => ({ value: k, label: t(d.key) })),
            ]}
          />
        </div>
      </Panel>

      <Panel title={`Approval Queue (${rows.length})`} icon="approval" bodyClassName="p-0">
        {loading ? <div className="p-8 text-center text-body-small text-fg-muted">{t('common.loading')}</div> : (
          <DataTable<ApprovalItem>
            minWidth={1100}
            rows={rows}
            rowKey={(a) => a.id}
            columns={[
              { key: 'id', header: 'Approval ID', isRowHeader: true, render: (a) => <span className="nk-mono-id text-fg-muted">{a.id}</span> },
              { key: 'type', header: 'Type', render: (a) => <span className="block max-w-44 truncate" title={a.type}>{a.type}</span> },
              { key: 'project', header: t('common.project'), render: (a) => (
                <Link to={`/projects/${encodeURIComponent(a.projectId)}`} className="text-primary-strong hover:underline">
                  <span className="nk-mono-id">{a.projectId}</span>
                </Link>
              ) },
              { key: 'status', header: t('common.status'), render: (a) => <StatusBadge descriptor={APPROVAL_STATUS[a.status]} size="sm" /> },
              { key: 'amount', header: t('common.amount'), cellClassName: 'tabular-nums', render: (a) => (a.amountCr != null ? formatCr(a.amountCr) : '—') },
              { key: 'sla', header: 'SLA', render: (a) => <span className="text-caption tabular-nums">{formatSlaCountdown(a.slaDueDate)}</span> },
              { key: 'priority', header: t('common.priority'), render: (a) => <StatusBadge descriptor={PRIORITY[a.priority]} size="sm" /> },
              { key: 'assigned', header: t('common.assignedTo'), render: (a) => <span className="text-caption">{a.assignedTo}</span> },
            ]}
            rowActions={(a) => (
              <Button variant="outline" size="sm" onClick={() => setSelected(a)}>
                {t('common.details')}
              </Button>
            )}
          />
        )}
      </Panel>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={`Approval ${selected?.id ?? ''}`}
        titleIcon="approval"
        size="lg"
        footer={
          <Button variant="primary" onClick={() => setSelected(null)}>
            {t('common.close')}
          </Button>
        }
      >
        {selected && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge descriptor={APPROVAL_STATUS[selected.status]} />
              <StatusBadge descriptor={PRIORITY[selected.priority]} size="sm" />
              <Badge tone="neutral" icon="payments">{selected.amountCr != null ? formatCr(selected.amountCr) : 'No financial implication'}</Badge>
              <Badge tone="neutral" icon="schedule">{formatSlaCountdown(selected.slaDueDate)}</Badge>
            </div>
            <dl className="grid grid-cols-1 gap-2 text-body-small sm:grid-cols-2">
              <div><dt className="text-fg-subtle">Type</dt><dd className="text-fg">{selected.type}</dd></div>
              <div><dt className="text-fg-subtle">{t('common.project')}</dt><dd className="text-fg">{selected.projectName}</dd></div>
              <div><dt className="text-fg-subtle">Submitted by</dt><dd className="text-fg">{selected.submittedBy}</dd></div>
              <div><dt className="text-fg-subtle">Submitted on</dt><dd className="tabular-nums text-fg">{formatDate(selected.submittedOn)}</dd></div>
              <div><dt className="text-fg-subtle">{t('common.assignedTo')}</dt><dd className="text-fg">{selected.assignedTo}</dd></div>
              <div><dt className="text-fg-subtle">SLA due</dt><dd className="tabular-nums text-fg">{formatDate(selected.slaDueDate)}</dd></div>
            </dl>
            <div>
              <p className="nk-label">Audit Trail</p>
              <ol className="mt-2 flex flex-col gap-2 border-l border-border pl-4">
                {selected.auditTrail.map((e, i) => (
                  <li key={i} className="relative text-body-small">
                    <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                    <p className="text-fg">
                      {e.action} — <span className="text-fg-muted">{e.actor}</span>{' '}
                      <span className="text-fg-subtle">({e.role})</span>
                    </p>
                    <p className="text-caption text-fg-subtle">
                      {formatDate(e.timestamp)} • {e.remarks}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
