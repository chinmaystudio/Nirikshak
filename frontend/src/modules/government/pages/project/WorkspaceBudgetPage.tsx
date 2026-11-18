import { useMemo, useState } from 'react'
import { useI18n } from '@/context/I18nContext'
import { useProjectWorkspace } from '@/context/ProjectWorkspaceContext'
import { useToast } from '@/context/ToastContext'
import { financeApi } from '@/api'
import type { ContractorInvoiceItem } from '@/api'
import { useApiData } from '@/hooks/useApiData'
import { Panel, Card } from '@/components/ui/Card'
import { DataTable } from '@/components/tables/DataTable'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import { Button } from '@/components/ui/Button'
import { Drawer, Modal } from '@/components/modals/Modal'
import { TextField, Select, TextArea } from '@/components/ui/Fields'
import { PageHeader, KpiRow, FilterBar, DetailField, KpiCard } from '@/components/blocks/Page'
import { SegmentBar, BarChart } from '@/components/charts/Charts'
import { formatCr, formatDate, formatIndianNumber } from '@/utils/format'
import { APPROVAL_STATUS, BILL_STATUS } from '@/utils/status'
import type { BillItem, BudgetHead } from '@/types'
import { FUNDING_SOURCES } from '@/constants'

/** Presentation for the raw contractor_invoices statuses (migration 037). */
const CONTRACTOR_INVOICE_STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
  SUBMITTED: { label: 'Submitted', tone: 'info' },
  UNDER_VERIFICATION: { label: 'Under Verification', tone: 'warning' },
  APPROVED: { label: 'Approved', tone: 'success' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
  PAID: { label: 'Paid', tone: 'success' },
}

/** Download rows as a real CSV file generated from the loaded data. */
function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Project workspace — Budget & Finance: full financial control center with
 * allocation control, expenditure analytics, fund-release tracking and the
 * complete Payment & Bill Management workflow (scoped to the open project). */
export function WorkspaceBudgetPage() {
  const { t } = useI18n()
  const { showToast } = useToast()
  const { project, approvals, bills } = useProjectWorkspace()
  const billState = bills
  const [headsRefresh, setHeadsRefresh] = useState(0)
  const projectDbId = project?.dbId ?? ''
  // Budget heads and the monthly series come from the project's real
  // financial_updates rows (financeApi) — never from a fixture register.
  const { data: loadedHeads } = useApiData(() => financeApi.budgetHeads(projectDbId), [projectDbId, headsRefresh])
  const { data: loadedSpend } = useApiData(() => financeApi.monthlySpend(projectDbId), [projectDbId, headsRefresh])
  // Contractor-raised invoices (contractor_invoices) sit alongside the
  // financial-update bills below — a separate register with its own
  // recorded statuses, loaded read-only.
  const { data: loadedContractorInvoices } = useApiData(() => financeApi.contractorInvoices(projectDbId), [projectDbId])
  const contractorInvoices: ContractorInvoiceItem[] = loadedContractorInvoices ?? []
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [billDrawer, setBillDrawer] = useState<BillItem | null>(null)
  const [headDrawer, setHeadDrawer] = useState<BudgetHead | null>(null)
  const [addHeadOpen, setAddHeadOpen] = useState(false)
  const [allocating, setAllocating] = useState(false)
  const [newHead, setNewHead] = useState({ head: '', amountCr: '', source: '' })
  const [exportOpen, setExportOpen] = useState(false)

  const fin = project?.financials
  const utilization = fin && fin.sanctionedAmountCr > 0 ? (fin.amountUtilizedCr / fin.sanctionedAmountCr) * 100 : 0
  const revised = fin?.revisedAmountCr
  const overrunCr = revised != null && fin ? revised - fin.sanctionedAmountCr : 0
  const remaining = fin ? fin.sanctionedAmountCr - fin.amountUtilizedCr : 0
  const releaseApprovals = approvals.filter((a) => a.type.includes('Fund Release'))
  const spend = loadedSpend ?? []
  const heads = loadedHeads ?? []

  const filteredHeads = heads.filter(
    (h) => !search || h.head.toLowerCase().includes(search.toLowerCase()),
  )

  const billTypes = useMemo(() => [...new Set(billState.map((b) => b.type))], [billState])

  const filteredBills = useMemo(
    () =>
      billState.filter((b) => {
        if (statusFilter && b.status !== statusFilter) return false
        if (typeFilter && b.type !== typeFilter) return false
        return !search || `${b.id} ${b.billNo} ${b.contractor} ${b.mbEntry}`.toLowerCase().includes(search.toLowerCase())
      }),
    [billState, statusFilter, typeFilter, search],
  )

  const pendingAmount = billState.filter((b) => ['submitted', 'verified'].includes(b.status)).reduce((s, b) => s + b.amountCr, 0)
  const paidAmount = billState.filter((b) => b.status === 'paid').reduce((s, b) => s + b.amountCr, 0)
  const totalRecorded = billState.reduce((s, b) => s + b.amountCr, 0)

  if (!project || !fin) return null

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Budget & Finance"
        description="Financial control center — allocation, expenditure, fund releases and the complete bill-payment workflow for this project."
        actions={
          <>
            <Button variant="outline" size="sm" icon="download" onClick={() => setExportOpen(true)}>
              {t('common.export')}
            </Button>
            <Button variant="primary" size="sm" icon="add" onClick={() => setAddHeadOpen(true)}>
              Add Budget Allocation
            </Button>
          </>
        }
      />

      <KpiRow>
        <KpiCard label="Sanctioned" value={formatCr(fin.sanctionedAmountCr)} icon="account_balance" />
        <KpiCard label="Utilized" value={formatCr(fin.amountUtilizedCr)} icon="payments" iconTone="success" delta={`${utilization.toFixed(1)}% of sanction`} deltaTone="neutral" />
        <KpiCard label="Remaining Budget" value={formatCr(Math.max(0, remaining))} icon="savings" iconTone="neutral" delta={fin.amountCommittedCr ? `${formatCr(fin.amountCommittedCr)} committed` : undefined} />
        <KpiCard
          label="Cost Variance"
          value={revised != null && overrunCr !== 0 ? `${overrunCr > 0 ? '+' : ''}${formatCr(overrunCr)}` : 'Nil'}
          icon="trending_up"
          iconTone={revised != null && overrunCr > 0 ? 'danger' : 'neutral'}
          delta={revised != null ? 'Revised cost on record' : 'Sanctioned cost holds'}
          deltaTone={revised != null && overrunCr > 0 ? 'danger' : 'success'}
        />
      </KpiRow>

      {/* Allocation + analytics */}
      <section id="allocation" className="scroll-mt-24 flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel title="Budget vs Expenditure" icon="donut_small">
            <SegmentBar
              ariaLabel="Budget split"
              segments={[
                { label: `Utilized ${formatCr(fin.amountUtilizedCr)}`, value: fin.amountUtilizedCr, className: 'bg-success' },
                { label: `Committed ${formatCr(fin.amountCommittedCr)}`, value: fin.amountCommittedCr, className: 'bg-warning' },
                { label: `Unspent ${formatCr(Math.max(0, remaining - fin.amountCommittedCr))}`, value: Math.max(0, remaining - fin.amountCommittedCr), className: 'bg-surface-3' },
              ]}
            />
            <ul className="mt-4 flex flex-col gap-3">
              {fin.fundingSources.map((f) => (
                <li key={f.source}>
                  <div className="mb-1 flex items-center justify-between text-body-small">
                    <span className="text-fg">{f.source}</span>
                    <span className="tabular-nums text-fg-muted">{formatCr(f.amountCr)} • {f.sharePct}%</span>
                  </div>
                  <Progress value={f.sharePct} label={`${f.source} share`} size="sm" showValue={false} />
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Monthly Expenditure — Cumulative Spent" icon="bar_chart">
            {spend.length > 0 ? (
              <>
                <BarChart
                  ariaLabel="Cumulative amount spent by month"
                  data={spend.map((m) => ({ label: m.month, value: m.cumulativeCr, tone: 'success' as const }))}
                  valueFormatter={(v) => formatCr(v)}
                  showValues={false}
                />
                <p className="mt-3 text-caption text-fg-subtle">
                  Latest cumulative amount spent recorded in this project's financial updates, per month of
                  observation. Latest: {formatCr(spend[spend.length - 1].cumulativeCr)} ({spend[spend.length - 1].month}).
                  No planned curve is shown — the finance register records actuals only.
                </p>
              </>
            ) : (
              <p className="text-body-small text-fg-muted">No financial updates have been recorded for this project yet, so there is no expenditure series to chart.</p>
            )}
          </Panel>
        </div>

        <FilterBar
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search budget head…"
          onClear={() => setSearch('')}
        />
        <Panel title={`Budget Allocation (${filteredHeads.length})`} icon="account_balance_wallet" bodyClassName="p-0">
          <DataTable
            minWidth={880}
            rows={filteredHeads}
            rowKey={(h) => h.id}
            paginated
            pageSize={6}
            initialSort={{ key: 'original', dir: 'desc' }}
            columns={[
              { key: 'head', header: 'Budget Head', isRowHeader: true, sortable: true, sortValue: (h) => h.head, render: (h) => h.head },
              { key: 'original', header: 'Original', cellClassName: 'tabular-nums', sortable: true, sortValue: (h) => h.originalCr, render: (h) => formatCr(h.originalCr) },
              { key: 'revised', header: 'Revised', cellClassName: 'tabular-nums', render: (h) => (h.revisedCr != null ? formatCr(h.revisedCr) : '—') },
              { key: 'utilized', header: 'Utilized', cellClassName: 'tabular-nums', sortable: true, sortValue: (h) => h.utilizedCr, render: (h) => formatCr(h.utilizedCr) },
              { key: 'remaining', header: 'Remaining', cellClassName: 'tabular-nums', render: (h) => formatCr(Math.max(0, (h.revisedCr ?? h.originalCr) - h.utilizedCr)) },
              {
                key: 'utilization',
                header: 'Utilization',
                render: (h) => {
                  const pct = Math.min(100, (h.utilizedCr / (h.revisedCr ?? h.originalCr)) * 100)
                  return <Progress value={pct} label={`${h.head} utilization`} size="sm" className="min-w-28" showValue={false} />
                },
              },
              {
                key: 'variance',
                header: t('common.risk'),
                render: (h) => {
                  const variance = (h.revisedCr ?? 0) - h.originalCr
                  const burn = h.utilizedCr / (h.revisedCr ?? h.originalCr)
                  if (variance > 0) return <Badge tone="warning" icon="trending_up">Revised +{formatCr(variance)}</Badge>
                  if (burn > 0.9) return <Badge tone="warning" icon="priority_high">Burn {(burn * 100).toFixed(0)}%</Badge>
                  return <Badge tone="success" icon="check_circle">Normal</Badge>
                },
              },
            ]}
            rowActions={(h) => (
              <Button variant="outline" size="sm" className="!min-h-7 !px-2.5" onClick={() => setHeadDrawer(h)}>
                {t('common.view')}
              </Button>
            )}
            emptyState={
              <div className="p-8 text-center">
                <p className="text-body-small text-fg-muted">No budget heads have been allocated for this project yet.</p>
                <Button variant="primary" size="sm" icon="add" className="mt-3" onClick={() => setAddHeadOpen(true)}>
                  Add Budget Allocation
                </Button>
              </div>
            }
          />
        </Panel>
      </section>

      {/* Fund release tracking */}
      <section id="fund-release" className="scroll-mt-24">
        <Panel title="Fund Release Tracking" icon="route" bodyClassName="p-0">
          {releaseApprovals.length > 0 ? (
            <ul className="divide-y divide-border">
              {releaseApprovals.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <div>
                    <p className="text-label text-fg">{a.type}</p>
                    <p className="text-caption text-fg-muted">
                      {a.submittedBy} • {formatDate(a.submittedOn)} • SLA {formatDate(a.slaDueDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {a.amountCr != null && <Badge tone="neutral" icon="payments">{formatCr(a.amountCr)}</Badge>}
                    <StatusBadge descriptor={APPROVAL_STATUS[a.status]} size="sm" />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-4 text-body-small text-fg-muted">
              No fund-release actions recorded yet. Last tranche credited {formatDate(fin.lastTrancheDate)}
              {fin.nextTrancheDueCr ? `; next due ${formatCr(fin.nextTrancheDueCr)}.` : '.'}
            </p>
          )}
        </Panel>
      </section>

      {/* Cost-overrun tracking */}
      <section id="cost-overrun" className="scroll-mt-24">
        <Panel title="Cost & Time Overrun Tracking" icon="trending_up">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card className="p-3">
              <p className="nk-label">Cost overrun</p>
              <p className="tabular-nums text-label text-fg">
                {revised != null && overrunCr !== 0 ? `${overrunCr > 0 ? '+' : ''}${formatCr(overrunCr)}` : 'None recorded'}
              </p>
              <p className="text-caption text-fg-subtle">
                {revised != null ? `${formatCr(fin.sanctionedAmountCr)} sanctioned → ${formatCr(revised)} revised` : 'Sanctioned cost holds.'}
              </p>
            </Card>
            <Card className="p-3">
              <p className="nk-label">Time overrun</p>
              <p className="tabular-nums text-label text-fg">{project.delayDays > 0 ? `${project.delayDays} ${t('common.days')}` : 'On schedule'}</p>
              <p className="text-caption text-fg-subtle">Against expected completion {formatDate(project.expectedCompletion)}</p>
            </Card>
            <Card className="p-3">
              <p className="nk-label">Commitment risk</p>
              <p className="tabular-nums text-label text-fg">{formatCr(fin.amountCommittedCr)}</p>
              <p className="text-caption text-fg-subtle">Committed but not yet billed.</p>
            </Card>
          </div>
        </Panel>
      </section>

      {/* Payment & Bill Management */}
      <section id="payments" className="scroll-mt-24 flex flex-col gap-4">
        <KpiRow>
          <KpiCard label="Total Bills" value={billState.length} icon="receipt_long" />
          <KpiCard label="Pending Verification" value={billState.filter((b) => b.status === 'submitted').length} icon="hourglass_top" iconTone="warning" />
          <KpiCard label="Approved / Paid" value={billState.filter((b) => ['approved', 'paid'].includes(b.status)).length} icon="task_alt" iconTone="success" />
          <KpiCard label="Total Recorded Amount" value={formatCr(totalRecorded)} icon="account_balance_wallet" iconTone="neutral" />
        </KpiRow>
        <KpiRow>
          <KpiCard label="Paid Amount" value={formatCr(paidAmount)} icon="payments" iconTone="success" />
          <KpiCard label="Pending Amount" value={formatCr(pendingAmount)} icon="pending_actions" iconTone="warning" />
          <KpiCard label="Next Tranche Due" value={fin.nextTrancheDueCr ? formatCr(fin.nextTrancheDueCr) : '—'} icon="event_repeat" />
          <KpiCard label="Last Tranche" value={formatDate(fin.lastTrancheDate)} icon="history" iconTone="neutral" />
        </KpiRow>

        <FilterBar
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search bill no, ref, contractor, e-MB entry…"
          selects={[
            {
              label: t('common.status'),
              value: statusFilter,
              onChange: setStatusFilter,
              options: [{ value: '', label: t('common.all') }, ...(['submitted', 'verified', 'approved', 'paid', 'returned'] as const).map((s) => ({ value: s, label: t(BILL_STATUS[s].key) }))],
            },
            {
              label: 'Bill type',
              value: typeFilter,
              onChange: setTypeFilter,
              options: [{ value: '', label: t('common.all') }, ...billTypes.map((x) => ({ value: x, label: x }))],
            },
          ]}
          onClear={() => {
            setSearch('')
            setStatusFilter('')
            setTypeFilter('')
          }}
        />

        <Panel title="Payment & Bill Management" icon="receipt_long" subtitle="Financial-update records for this project, as recorded in the finance register." bodyClassName="p-0">
          <DataTable
            minWidth={1040}
            rows={filteredBills}
            rowKey={(b) => b.id}
            paginated
            pageSize={8}
            initialSort={{ key: 'submitted', dir: 'desc' }}
            columns={[
              { key: 'id', header: 'Ref', render: (b) => <span className="nk-mono-id text-fg-muted">{b.id}</span> },
              { key: 'billNo', header: 'Bill No.', isRowHeader: true, sortable: true, sortValue: (b) => b.billNo, render: (b) => <span className="nk-mono-id text-fg">{b.billNo}</span> },
              { key: 'type', header: 'Type', render: (b) => <Badge tone="neutral">{b.type}</Badge> },
              { key: 'amount', header: t('common.amount'), cellClassName: 'tabular-nums', sortable: true, sortValue: (b) => b.amountCr, render: (b) => formatCr(b.amountCr) },
              { key: 'status', header: 'Status', render: (b) => <StatusBadge descriptor={BILL_STATUS[b.status]} size="sm" /> },
              { key: 'submitted', header: 'Submitted', cellClassName: 'tabular-nums', sortable: true, sortValue: (b) => b.submittedOn, render: (b) => formatDate(b.submittedOn) },
            ]}
            rowActions={(b) => (
              <Button variant="outline" size="sm" className="!min-h-7 !px-2.5" onClick={() => setBillDrawer(b)}>
                {t('common.view')}
              </Button>
            )}
            emptyState={
              <div className="p-8 text-center">
                <p className="text-body-small text-fg-muted">No bills match the current filters, or none have been submitted for this project yet.</p>
                <p className="mt-2 text-caption text-fg-subtle">Bills are raised by the contractor against certified e-MB entries.</p>
              </div>
            }
          />
        </Panel>

        <Panel title="Contractor Invoices" icon="receipt" subtitle="Invoices raised by the contractor in contractor_invoices, with the status recorded on each invoice. Drafts are not listed — they have not been submitted yet." bodyClassName="p-0">
          <DataTable
            minWidth={960}
            rows={contractorInvoices}
            rowKey={(inv) => inv.id}
            paginated
            pageSize={8}
            initialSort={{ key: 'invoiceDate', dir: 'desc' }}
            columns={[
              { key: 'invoiceNumber', header: 'Invoice No.', isRowHeader: true, sortable: true, sortValue: (inv) => inv.invoiceNumber, render: (inv) => <span className="nk-mono-id text-fg">{inv.invoiceNumber}</span> },
              { key: 'contractor', header: 'Contractor', render: (inv) => inv.contractor },
              { key: 'milestone', header: 'Bill / Milestone', render: (inv) => inv.milestoneLabel ?? '—' },
              { key: 'amount', header: t('common.amount'), cellClassName: 'tabular-nums', sortable: true, sortValue: (inv) => inv.amountInr, render: (inv) => `₹ ${formatIndianNumber(inv.amountInr)}` },
              { key: 'status', header: 'Status', render: (inv) => { const s = CONTRACTOR_INVOICE_STATUS[inv.status] ?? { label: inv.status, tone: 'neutral' as const }; return <Badge tone={s.tone}>{s.label}</Badge> } },
              { key: 'invoiceDate', header: 'Invoice Date', cellClassName: 'tabular-nums', sortable: true, sortValue: (inv) => inv.invoiceDate, render: (inv) => formatDate(inv.invoiceDate) },
              { key: 'notes', header: 'Notes', render: (inv) => inv.notes ?? '—' },
            ]}
            emptyState={
              <div className="p-8 text-center">
                <p className="text-body-small text-fg-muted">No contractor invoices have been submitted for this project yet.</p>
                <p className="mt-2 text-caption text-fg-subtle">Submitted invoices appear here with their recorded verification / payment status.</p>
              </div>
            }
          />
        </Panel>

      </section>

      {/* Bill detail drawer */}
      <Drawer
        open={billDrawer !== null}
        onClose={() => setBillDrawer(null)}
        title={billDrawer ? `Bill ${billDrawer.billNo}` : ''}
        titleIcon="receipt_long"
        width="max-w-xl"
      >
        {billDrawer && <BillDrawerContent bill={billDrawer} />}
      </Drawer>

      {/* Budget head drawer */}
      <Drawer
        open={headDrawer !== null}
        onClose={() => setHeadDrawer(null)}
        title={headDrawer?.head ?? ''}
        titleIcon="account_balance_wallet"
        width="max-w-md"
      >
        {headDrawer && (
          <div className="flex flex-col gap-4 p-4">
            <dl className="grid grid-cols-2 gap-3 text-body-small">
              <DetailField label="Original allocation" value={<span className="tabular-nums">{formatCr(headDrawer.originalCr)}</span>} />
              <DetailField label="Revised allocation" value={<span className="tabular-nums">{headDrawer.revisedCr != null ? formatCr(headDrawer.revisedCr) : '—'}</span>} />
              <DetailField label="Utilized" value={<span className="tabular-nums">{formatCr(headDrawer.utilizedCr)}</span>} />
              <DetailField label="Remaining" value={<span className="tabular-nums">{formatCr(Math.max(0, (headDrawer.revisedCr ?? headDrawer.originalCr) - headDrawer.utilizedCr))}</span>} />
              <DetailField label="Charged bills" value={billState.filter((b) => b.status === 'paid' || b.status === 'approved').length} />
              <DetailField label="Funding source" value={fin.fundingSources[0]?.source ?? '—'} />
            </dl>
            <Progress
              value={(headDrawer.utilizedCr / (headDrawer.revisedCr ?? headDrawer.originalCr)) * 100}
              label="Head utilization"
            />
            <p className="text-caption text-fg-subtle">
              Expenditure against this head is booked from verified RA/material bills. Utilization above 90% raises a
              burn warning for re-appropriation review.
            </p>
          </div>
        )}
      </Drawer>

      {/* Add budget allocation */}
      <Modal
        open={addHeadOpen}
        onClose={() => setAddHeadOpen(false)}
        title="Add Budget Allocation"
        titleIcon="add"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setAddHeadOpen(false)}>{t('common.cancel')}</Button>
            <Button
              variant="primary"
              disabled={!newHead.head.trim() || !(Number(newHead.amountCr) > 0) || !newHead.source || allocating}
              onClick={async () => {
                const amount = Number(newHead.amountCr)
                // DF-07: persist first (with the project's database UUID) —
                // the head is added and success announced only after the
                // insert actually succeeds; failures surface as an error.
                setAllocating(true)
                try {
                  await financeApi.createAllocation(project.dbId ?? project.id, amount, newHead.head.trim(), newHead.source)
                } catch (err: any) {
                  showToast(err?.message || 'Budget allocation could not be saved. Please try again.', 'danger')
                  return
                } finally {
                  setAllocating(false)
                }
                // Reload the heads from financial_updates so the table
                // shows exactly what was persisted — nothing is appended
                // locally on the strength of the toast.
                setHeadsRefresh((k) => k + 1)
                showToast(`Budget head "${newHead.head.trim()}" (${formatCr(amount)}) recorded in the project's financial updates.`, 'success')
                setNewHead({ head: '', amountCr: '', source: '' })
                setAddHeadOpen(false)
              }}
            >
              {allocating ? 'Saving…' : t('common.submit')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <TextField label="Budget head" required value={newHead.head} onChange={(e) => setNewHead((f) => ({ ...f, head: e.target.value }))} placeholder="e.g. Utility shifting — Phase 2" />
          <TextField label="Amount (₹ Cr)" required type="number" min={0} step={0.01} value={newHead.amountCr} onChange={(e) => setNewHead((f) => ({ ...f, amountCr: e.target.value }))} />
          <Select
            label="Funding source"
            required
            value={newHead.source}
            onChange={(e) => setNewHead((f) => ({ ...f, source: e.target.value }))}
            placeholder={t('common.select')}
            options={FUNDING_SOURCES.map((f) => ({ value: f, label: f }))}
          />
          <TextArea label="Justification" rows={2} placeholder="Administrative approval reference / work item…" />
        </div>
      </Modal>

      {/* Export menu — CSVs generated from the data loaded on this page */}
      <Modal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Export Financial Report"
        titleIcon="download"
        size="sm"
        footer={
          <Button variant="outline" onClick={() => setExportOpen(false)}>{t('common.close')}</Button>
        }
      >
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            icon="download"
            onClick={() => {
              downloadCsv(`budget-heads-${project.id}.csv`, [
                ['Budget head', 'Original (₹ Cr)', 'Revised (₹ Cr)', 'Utilized (₹ Cr)'],
                ...heads.map((h) => [h.head, h.originalCr, h.revisedCr ?? '', h.utilizedCr]),
              ])
              setExportOpen(false)
            }}
          >
            Budget head register (CSV)
          </Button>
          <Button
            variant="outline"
            icon="download"
            onClick={() => {
              downloadCsv(`bills-${project.id}.csv`, [
                ['Reference', 'Bill No.', 'Type', 'Contractor', 'Amount (₹ Cr)', 'Status', 'Submitted'],
                ...billState.map((b) => [b.id, b.billNo, b.type, b.contractor, b.amountCr, b.status, b.submittedOn]),
              ])
              setExportOpen(false)
            }}
          >
            Bill payment register (CSV)
          </Button>
          <Button
            variant="outline"
            icon="download"
            onClick={() => {
              downloadCsv(`monthly-spend-${project.id}.csv`, [
                ['Month', 'Cumulative spent (₹ Cr)'],
                ...spend.map((m) => [m.month, m.cumulativeCr]),
              ])
              setExportOpen(false)
            }}
          >
            Monthly expenditure series (CSV)
          </Button>
        </div>
      </Modal>
    </div>
  )
}

/**
 * Bill drawer: the record exactly as stored. Bills on this page are
 * financial_updates rows — the register stores no GST/retention split, no
 * verification workflow and no risk score, so none is shown or simulated.
 */
function BillDrawerContent({ bill }: { bill: BillItem }) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge descriptor={BILL_STATUS[bill.status]} />
      </div>

      <Panel title="Bill Information" icon="info">
        <dl className="grid grid-cols-2 gap-3 text-body-small">
          <DetailField label="Reference" value={<span className="nk-mono-id">{bill.id}</span>} />
          <DetailField label="Contractor" value={bill.contractor} />
          <DetailField label="Type" value={bill.type} />
          <DetailField label="Submitted" value={formatDate(bill.submittedOn)} />
          <DetailField label="e-MB entry" value={<span className="nk-mono-id">{bill.mbEntry}</span>} />
          <DetailField label="Paid on" value={bill.paidOn ? formatDate(bill.paidOn) : '—'} />
        </dl>
      </Panel>

      <Panel title="Recorded Amount" icon="calculate">
        <dl className="grid grid-cols-2 gap-3 text-body-small">
          <DetailField label="Amount on record" value={<span className="tabular-nums font-semibold">{formatCr(bill.amountCr)}</span>} />
          <DetailField label="Verified by" value={bill.verifiedBy ?? '—'} />
          <DetailField label="Approved by" value={bill.approvedBy ?? '—'} />
        </dl>
        <p className="mt-3 text-caption text-fg-subtle">
          This is the amount stored on the financial-update record. Tax, retention and net-payable splits are
          not stored in the finance register and are therefore not shown.
        </p>
      </Panel>

      <Panel title="Verification & Approval History" icon="history">
        <ol className="flex flex-col gap-2">
          {(
            [
              bill.status !== 'submitted' && { label: 'Verified', detail: bill.verifiedBy ?? '—' },
              ['approved', 'paid'].includes(bill.status) && { label: 'Approved for payment', detail: bill.approvedBy ?? '—' },
              bill.status === 'paid' && { label: 'Payment credited', detail: bill.paidOn ? formatDate(bill.paidOn) : '—' },
              bill.status === 'returned' && { label: 'Returned to contractor', detail: bill.flagNote ?? '—' },
            ].filter(Boolean) as { label: string; detail: string }[]
          ).map((row, i) => (
            <li key={i} className="flex items-start gap-2 text-body-small">
              <span className="material-symbols-outlined text-[16px] text-success-strong" aria-hidden="true">check_circle</span>
              <span>
                <strong className="text-fg">{row.label}</strong> — {row.detail}
              </span>
            </li>
          ))}
          {bill.status === 'submitted' && <li className="text-body-small text-fg-muted">No verification action recorded yet.</li>}
        </ol>
      </Panel>
    </div>
  )
}
