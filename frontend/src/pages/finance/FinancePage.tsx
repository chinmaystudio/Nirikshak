import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '@/context/I18nContext'
import { Tabs, TabPanel } from '@/components/navigation/Tabs'
import { Panel, Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Fields'
import { Button } from '@/components/ui/Button'
import { KpiCard } from '@/components/charts/KpiCard'
import { BarChart, SegmentBar, Sparkline } from '@/components/charts/Charts'
import { DataTable } from '@/components/tables/DataTable'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Progress } from '@/components/ui/Progress'
import { Badge } from '@/components/ui/Badge'
import { formatCr, formatCrCompact, formatPct, formatIndianNumber } from '@/utils/format'
import { FUND_FLOW_STATUS } from '@/utils/status'
import { financeApi } from '@/api'
import { useApiData } from '@/hooks/useApiData'
import type { FundFlow } from '@/types'

const FISCAL_TABS = [
  { id: 'budget', label: 'Budget & Demand', icon: 'account_balance' },
  { id: 'disbursals', label: 'Disbursals', icon: 'payments' },
  { id: 'utilization', label: 'Utilization', icon: 'stacked_bar_chart' },
  { id: 'projects', label: 'Project-wise Outlay', icon: 'map' },
  { id: 'tranches', label: 'Tranche Schedule', icon: 'calendar_month' },
  { id: 'uc', label: 'Utilization Certificates', icon: 'receipt_long' },
  { id: 'reappropriation', label: 'Re-appropriation', icon: 'swap_horiz' },
  { id: 'convergence', label: 'Convergent Funds', icon: 'join_full' },
] as const

/**
 * FinancePage — Budget & Finance (₹ Lakh/Crore everywhere, tabular figures).
 * 8 sections per spec.
 */
export function FinancePage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [tab, setTab] = useState<(typeof FISCAL_TABS)[number]['id']>('budget')
  const { data: flows } = useApiData(() => financeApi.fundFlows(), [])

  const totals = (flows ?? []).reduce(
    (a, f) => ({ be: a.be + f.budgetEstimateCr, re: a.re + f.revisedEstimateCr, al: a.al + f.allocationCr, rel: a.rel + f.releasedCr, ut: a.ut + f.utilizedCr }),
    { be: 0, re: 0, al: 0, rel: 0, ut: 0 },
  )

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-heading-1 text-fg">{t('nav.finance')}</h1>
        <p className="mt-1 text-body-small text-fg-muted">FY 2025-2026 • All figures in ₹ Crore (mock data).</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Budget Estimate" value={formatCrCompact(totals.be)} icon="account_balance" />
        <KpiCard label="Allocation" value={formatCrCompact(totals.al)} icon="savings" iconTone="primary" />
        <KpiCard label="Released" value={formatCrCompact(totals.rel)} icon="payments" iconTone="success" />
        <KpiCard label="Utilized" value={formatCrCompact(totals.ut)} icon="task_alt" iconTone="success" delta={totals.al ? `${formatPct((totals.ut / totals.al) * 100)} of allocation` : undefined} deltaTone="neutral" />
      </div>

      <Tabs items={FISCAL_TABS.map((x) => ({ id: x.id, label: x.label, icon: x.icon }))} active={tab} onChange={(v) => setTab(v as typeof tab)} ariaLabel="Finance sections" />

      <TabPanel id="budget" active={tab}>
        <Panel title="Budget & Demand Heads" icon="account_balance" bodyClassName="p-0">
          <DataTable<FundFlow>
            minWidth={1000}
            rows={flows ?? []}
            rowKey={(f) => f.id}
            columns={[
              { key: 'demand', header: 'Demand', cellClassName: 'tabular-nums', render: (f) => `#${f.demandNo}` },
              { key: 'head', header: 'Head', isRowHeader: true, render: (f) => f.head },
              { key: 'be', header: 'BE', cellClassName: 'tabular-nums', render: (f) => formatCr(f.budgetEstimateCr) },
              { key: 're', header: 'RE', cellClassName: 'tabular-nums', render: (f) => formatCr(f.revisedEstimateCr) },
              { key: 'alloc', header: 'Allocation', cellClassName: 'tabular-nums', render: (f) => formatCr(f.allocationCr) },
              { key: 'status', header: t('common.status'), render: (f) => <StatusBadge descriptor={FUND_FLOW_STATUS[f.status]} size="sm" /> },
            ]}
          />
        </Panel>
      </TabPanel>

      <TabPanel id="disbursals" active={tab}>
        <Panel title="Disbursals (Released vs Utilized)" icon="payments" bodyClassName="p-0">
          <DataTable<FundFlow>
            minWidth={900}
            rows={flows ?? []}
            rowKey={(f) => f.id}
            columns={[
              { key: 'head', header: 'Head', isRowHeader: true, render: (f) => f.head },
              { key: 'released', header: 'Released', cellClassName: 'tabular-nums', render: (f) => formatCr(f.releasedCr) },
              { key: 'utilized', header: 'Utilized', cellClassName: 'tabular-nums', render: (f) => formatCr(f.utilizedCr) },
              { key: 'pct', header: 'Utilization', render: (f) => <Progress value={(f.utilizedCr / Math.max(f.releasedCr, 1)) * 100} label={`Utilization of ${f.head}`} size="sm" className="min-w-36" /> },
            ]}
          />
        </Panel>
      </TabPanel>

      <TabPanel id="utilization" active={tab}>
        <Panel title="Utilization by Head" icon="stacked_bar_chart">
          <BarChart
            ariaLabel="Utilized amounts by demand head"
            data={(flows ?? []).map((f) => ({ label: `D${f.demandNo} ${f.head.split('—')[0].trim()}`, value: f.utilizedCr }))}
            valueFormatter={(v) => formatCrCompact(v)}
          />
        </Panel>
      </TabPanel>

      <TabPanel id="projects" active={tab}>
        <Panel title="Project-wise Outlay" icon="map" actions={<Button variant="outline" size="sm" icon="arrow_forward" onClick={() => navigate('/projects')}>{t('nav.projects')}</Button>}>
          <p className="text-body-small text-fg-muted">Project-level outlay lives in the project register; open a project to see its funding sources and tranche history.</p>
        </Panel>
      </TabPanel>

      <TabPanel id="tranches" active={tab}>
        <Panel title="Tranche Schedule" icon="calendar_month" bodyClassName="p-0">
          <DataTable<FundFlow>
            minWidth={800}
            rows={flows ?? []}
            rowKey={(f) => f.id}
            columns={[
              { key: 'head', header: 'Head', isRowHeader: true, render: (f) => f.head },
              { key: 'pending', header: 'Pending Release', cellClassName: 'tabular-nums', render: (f) => formatCr(Math.max(f.allocationCr - f.releasedCr, 0)) },
              { key: 'status', header: t('common.status'), render: (f) => <StatusBadge descriptor={FUND_FLOW_STATUS[f.status]} size="sm" /> },
            ]}
          />
        </Panel>
      </TabPanel>

      <TabPanel id="uc" active={tab}>
        <Panel title="Utilization Certificates" icon="receipt_long">
          <ul className="flex flex-col gap-2 text-body-small text-fg-muted">
            <li className="flex items-center gap-2"><StatusBadge descriptor={{ key: 'status.approved', tone: 'success', icon: 'check_circle' }} size="sm" /> UC Tranche 3 — NIR-UID-2026-0311 accepted by PAO.</li>
            <li className="flex items-center gap-2"><StatusBadge descriptor={{ key: 'status.pending', tone: 'warning', icon: 'hourglass_top' }} size="sm" /> UC Tranche 2 — NIR-MED-2025-0455 awaited (project on hold).</li>
            <li className="flex items-center gap-2"><StatusBadge descriptor={{ key: 'status.approved', tone: 'success', icon: 'check_circle' }} size="sm" /> UC FY-H1 — NIR-RHD-2025-0930 filed with final bill.</li>
          </ul>
        </Panel>
      </TabPanel>

      <TabPanel id="reappropriation" active={tab}>
        <Panel title="Re-appropriation Requests" icon="swap_horiz">
          <SegmentBar
            ariaLabel="Re-appropriation split"
            segments={[
              { label: 'Approved', value: 3, className: 'bg-success' },
              { label: 'In Process', value: 1, className: 'bg-warning' },
              { label: 'Withdrawn', value: 1, className: 'bg-surface-3' },
            ]}
          />
          <p className="mt-3 text-caption text-fg-subtle">Demo counts. Requests move through Finance Dept after SE recommendation.</p>
        </Panel>
      </TabPanel>

      <TabPanel id="convergence" active={tab}>
        <Panel title="Convergent Funding Schemes" icon="join_full">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { name: 'Jal Jeevan Mission', share: '60 : 40' },
              { name: 'AMRUT 2.0', share: '50 : 50' },
              { name: 'PMGSY-IV', share: '60 : 40' },
              { name: 'SBM 2.0', share: 'Centre + State' },
            ].map((s) => (
              <Card key={s.name} className="p-3">
                <p className="text-label text-fg">{s.name}</p>
                <Badge tone="secondary" className="mt-1">{s.share}</Badge>
                <Sparkline points={[4, 6, 5, 8, 9, 12]} ariaLabel={`${s.name} release trend`} className="mt-2" height={36} />
              </Card>
            ))}
          </div>
          <p className="mt-3 text-caption text-fg-subtle">Sharing patterns are indicative; actual matching shares follow the scheme guidelines of each FY.</p>
        </Panel>
      </TabPanel>

      <p className="text-caption text-fg-subtle">{t('common.mockDataNote')} — Indian numbering: {formatIndianNumber(1842500)} (example).</p>
    </div>
  )
}
