import { useMemo, useState } from 'react'
import { useI18n } from '@/context/I18nContext'
import { useProjectWorkspace } from '@/context/ProjectWorkspaceContext'
import { useToast } from '@/context/ToastContext'
import { Panel } from '@/components/ui/Card'
import { DataTable } from '@/components/tables/DataTable'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Drawer, Modal } from '@/components/modals/Modal'
import { TextField } from '@/components/ui/Fields'
import { PageHeader, KpiRow, FilterBar, DetailField, KpiCard } from '@/components/blocks/Page'
import { LoadingBlock } from '@/components/feedback/Feedback'
import { formatCr, formatDate } from '@/utils/format'
import { BILL_STATUS } from '@/utils/status'
import { contractorsApi } from '@/api'
import { useApiData } from '@/hooks/useApiData'
import type { Contractor } from '@/types'

/** Project workspace — Contractor Management: the real contractor
 * register (organizations where type='contractor'), with aggregates from
 * contracts and project_organizations. Contractors linked to this project
 * are marked; fields an organisation record does not carry render "—". */
export function WorkspaceContractorsPage() {
  const { t } = useI18n()
  const { showToast } = useToast()
  const { project, workOrder, bills } = useProjectWorkspace()
  const [search, setSearch] = useState('')
  const [detail, setDetail] = useState<Contractor | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [newC, setNewC] = useState({ name: '', reg: '' })
  const [saving, setSaving] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const { data: contractors, loading, error } = useApiData(() => contractorsApi.all(), [refreshKey])

  const isAssigned = (c: Contractor): boolean =>
    Boolean(
      (project?.dbId && c.projectIds?.includes(project.dbId)) ||
        (project?.contractor && c.name === project.contractor),
    )

  const rows = useMemo(() => {
    const list = [...(contractors ?? [])].sort(
      (a, b) => Number(isAssigned(b)) - Number(isAssigned(a)) || a.name.localeCompare(b.name),
    )
    if (!search) return list
    return list.filter((c) =>
      `${c.name} ${c.registrationNo ?? ''}`.toLowerCase().includes(search.toLowerCase()),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractors, search, project?.dbId, project?.contractor])

  if (!project) return null

  const all = contractors ?? []
  const assignedCount = all.filter(isAssigned).length
  const verifiedCount = all.filter((c) => c.verified).length
  const activeContracts = all.reduce((s, c) => s + (c.activeContracts ?? 0), 0)

  const addContractor = async () => {
    if (!newC.name.trim() || saving) return
    setSaving(true)
    try {
      await contractorsApi.create({ name: newC.name.trim(), registrationNo: newC.reg.trim() || undefined })
      showToast(`${newC.name.trim()} added to the contractor register.`, 'success')
      setNewC({ name: '', reg: '' })
      setAddOpen(false)
      setRefreshKey((k) => k + 1)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'The contractor could not be added.', 'danger')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Contractor Management"
        description="Contractor organisations on record, their contracts and assigned projects. Registration details shown are exactly what the organisation record carries."
        actions={
          <Button variant="primary" size="sm" icon="add" onClick={() => setAddOpen(true)}>
            Add Contractor
          </Button>
        }
      />

      <KpiRow>
        <KpiCard label="Registered Contractors" value={all.length} icon="engineering" />
        <KpiCard label="Assigned to this project" value={assignedCount} icon="assignment_turned_in" iconTone="primary" />
        <KpiCard label="Verified" value={verifiedCount} icon="verified" iconTone="success" />
        <KpiCard label="Active Contracts" value={activeContracts} icon="contract" iconTone="neutral" />
      </KpiRow>

      <FilterBar search={search} onSearch={setSearch} searchPlaceholder="Search contractor, registration no…" onClear={() => setSearch('')} />

      <Panel title={`Contractor Register (${rows.length})`} icon="engineering" bodyClassName="p-0">
        {loading ? (
          <div className="p-4">
            <LoadingBlock />
          </div>
        ) : error ? (
          <p className="p-4 text-body-small text-danger-strong">Failed to load contractors: {error.message}</p>
        ) : (
          <DataTable
            minWidth={1060}
            rows={rows}
            rowKey={(c) => c.id}
            emptyState={
              <div className="p-8 text-center text-body-small text-fg-muted">
                No contractor organisations are recorded yet.
              </div>
            }
            columns={[
              { key: 'name', header: 'Contractor', isRowHeader: true, render: (c) => (
                <span className={isAssigned(c) ? 'font-semibold text-primary-strong' : ''}>
                  {c.name}{isAssigned(c) ? ' (assigned here)' : ''}
                </span>
              ) },
              { key: 'reg', header: 'Registration', render: (c) => <span className="nk-mono-id">{c.registrationNo ?? '—'}</span> },
              { key: 'works', header: 'Works', cellClassName: 'tabular-nums', sortable: true, sortValue: (c) => c.completedProjects, render: (c) => `${c.completedProjects} done • ${c.activeProjects} active` },
              { key: 'value', header: 'Contract Value', cellClassName: 'tabular-nums', sortable: true, sortValue: (c) => c.totalValueCr, render: (c) => formatCr(c.totalValueCr) },
              { key: 'progress', header: 'Avg Progress', cellClassName: 'tabular-nums', sortable: true, sortValue: (c) => c.averageProgressPct ?? -1, render: (c) => (c.averageProgressPct != null ? `${c.averageProgressPct}%` : '—') },
              { key: 'contracts', header: 'Active Contracts', cellClassName: 'tabular-nums', render: (c) => c.activeContracts ?? 0 },
              {
                key: 'verified',
                header: 'Verified',
                render: (c) =>
                  c.verified ? (
                    <Badge tone="success" icon="verified">Yes</Badge>
                  ) : (
                    <Badge tone="neutral" icon="hourglass_top">Not recorded</Badge>
                  ),
              },
            ]}
            rowActions={(c) => (
              <Button variant="outline" size="sm" className="!min-h-7 !px-2.5" onClick={() => setDetail(c)}>
                Profile
              </Button>
            )}
          />
        )}
      </Panel>

      {/* Profile drawer */}
      <Drawer open={detail !== null} onClose={() => setDetail(null)} title={detail?.name ?? ''} titleIcon="engineering" width="max-w-xl">
        {detail && (
          <ContractorProfile
            contractor={detail}
            isAssigned={isAssigned(detail)}
            workOrderNo={workOrder?.id ?? project.workOrderNo ?? null}
            bills={bills.filter((b) => b.contractor === detail.name)}
          />
        )}
      </Drawer>

      {/* Add contractor */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Contractor to Register"
        titleIcon="add"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setAddOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" disabled={!newC.name.trim() || saving} onClick={() => void addContractor()}>
              {t('common.submit')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <TextField label="Firm name" required value={newC.name} onChange={(e) => setNewC((f) => ({ ...f, name: e.target.value }))} />
          <TextField label="Registration no. (if known)" value={newC.reg} onChange={(e) => setNewC((f) => ({ ...f, reg: e.target.value }))} />
          <p className="text-caption text-fg-subtle">
            Saved as a contractor organisation record. Assignment to a project happens through tender award and
            contract creation.
          </p>
        </div>
      </Modal>
    </div>
  )
}

function ContractorProfile({
  contractor,
  isAssigned,
  workOrderNo,
  bills,
}: {
  contractor: Contractor
  isAssigned: boolean
  workOrderNo: string | null
  bills: { id: string; billNo: string; amountCr: number; status: keyof typeof BILL_STATUS }[]
}) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {isAssigned && <Badge tone="secondary" icon="assignment_turned_in">Assigned to this project</Badge>}
        {contractor.verified ? (
          <Badge tone="success" icon="verified">Verified organisation</Badge>
        ) : (
          <Badge tone="neutral" icon="hourglass_top">Verification not recorded</Badge>
        )}
      </div>

      <Panel title="Company Information" icon="apartment">
        <dl className="grid grid-cols-2 gap-3 text-body-small">
          <DetailField label="Registration" value={<span className="nk-mono-id">{contractor.registrationNo ?? '—'}</span>} />
          <DetailField label="Record created" value={formatDate(contractor.empanelledSince)} />
          <DetailField label="District" value={contractor.district ?? '—'} />
          <DetailField label="State" value={contractor.state ?? '—'} />
          <DetailField label="Department" value={contractor.department ?? '—'} />
          <DetailField label="Work order (this project)" value={workOrderNo ?? '—'} />
        </dl>
        <p className="mt-3 text-caption text-fg-subtle">
          GSTIN, turnover, manpower and bank-guarantee details are not stored on the organisation record, so they are
          not shown.
        </p>
      </Panel>

      <Panel title="Performance (from portal records)" icon="speed">
        <dl className="grid grid-cols-2 gap-3 text-body-small">
          <DetailField label="Assigned projects" value={contractor.assignedProjects ?? 0} />
          <DetailField label="Works completed" value={contractor.completedProjects} />
          <DetailField label="Active projects" value={contractor.activeProjects} />
          <DetailField label="Active contracts" value={contractor.activeContracts ?? 0} />
          <DetailField label="Total contract value" value={<span className="tabular-nums">{formatCr(contractor.totalValueCr)}</span>} />
          <DetailField label="Average progress" value={contractor.averageProgressPct != null ? `${contractor.averageProgressPct}%` : '—'} />
        </dl>
      </Panel>

      <Panel title="Payment History" icon="payments" bodyClassName="p-0">
        {bills.length > 0 ? (
          <ul className="divide-y divide-border">
            {bills.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <span className="nk-mono-id text-fg">{b.billNo}</span>
                <span className="flex items-center gap-2">
                  <span className="tabular-nums text-body-small text-fg">{formatCr(b.amountCr)}</span>
                  <StatusBadge descriptor={BILL_STATUS[b.status]} size="sm" />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-4 text-body-small text-fg-muted">No financial records for this contractor on this project.</p>
        )}
      </Panel>
    </div>
  )
}
