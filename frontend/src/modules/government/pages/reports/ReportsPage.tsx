import { useMemo, useState } from 'react'
import { useI18n } from '@/context/I18nContext'
import { Panel } from '@/components/ui/Card'
import { Select, TextField } from '@/components/ui/Fields'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { DataTable } from '@/components/tables/DataTable'
import { BarChart, DonutChart } from '@/components/charts/Charts'
import { KpiCard } from '@/components/charts/KpiCard'
import { LoadingBlock } from '@/components/feedback/Feedback'
import { formatCr } from '@/utils/format'
import { useToast } from '@/context/ToastContext'
import { REPORT_TYPES } from '@/constants'
import { projectsApi, contractorsApi } from '@/api'
import { useApiData } from '@/hooks/useApiData'
import type { Project } from '@/types'

/**
 * ReportsPage — Reports & Analytics. Every figure is computed live from
 * the real project register (government_project_summary_view via
 * projectsApi) and the real contractor register (organizations via
 * contractorsApi). Nothing is sampled, mocked or estimated.
 */

const STATUS_LABELS: Record<Project['status'], string> = {
  sanctioned: 'Sanctioned',
  in_execution: 'In Execution',
  delayed: 'Delayed',
  at_risk: 'At Risk',
  completed: 'Completed',
  on_hold: 'On Hold',
  tendered: 'Tendered',
  awarded: 'Awarded',
}

const STATUS_COLORS: Record<Project['status'], string> = {
  sanctioned: 'var(--color-info)',
  in_execution: 'var(--color-primary)',
  delayed: 'var(--color-danger)',
  at_risk: 'var(--color-warning)',
  completed: 'var(--color-success)',
  on_hold: 'var(--color-surface-3)',
  tendered: 'var(--color-secondary)',
  awarded: 'var(--color-success)',
}

function topCounts(values: string[], limit = 8): { label: string; value: number }[] {
  const counts = new Map<string, number>()
  values.forEach((v) => {
    const key = v || 'Not recorded'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  })
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
}

export function ReportsPage() {
  const { t } = useI18n()
  const { showToast } = useToast()
  const [report, setReport] = useState<string>(REPORT_TYPES[0])
  const [dept, setDept] = useState('')
  const [district, setDistrict] = useState('')
  const [asOn, setAsOn] = useState('')

  const { data: projects, loading, error } = useApiData(() => projectsApi.all(), [])
  const { data: contractors } = useApiData(() => contractorsApi.all(), [])

  const all = useMemo(() => projects ?? [], [projects])
  const departments = useMemo(
    () => [...new Set(all.map((p) => p.department).filter(Boolean))].sort(),
    [all],
  )
  const districts = useMemo(() => [...new Set(all.map((p) => p.district).filter(Boolean))].sort(), [all])

  const filtered = useMemo(
    () => all.filter((p) => (dept ? p.department === dept : true) && (district ? p.district === district : true)),
    [all, dept, district],
  )
  const outlay = filtered.reduce((s, p) => s + p.sanctionedAmountCr, 0)
  const utilized = filtered.reduce((s, p) => s + p.utilizedAmountCr, 0)
  const avgPhysical = filtered.length ? filtered.reduce((s, p) => s + p.physicalProgressPct, 0) / filtered.length : 0

  const sectorOutlay = useMemo(() => {
    const totals = new Map<string, number>()
    filtered.forEach((p) => {
      const key = p.category || 'Not recorded'
      totals.set(key, (totals.get(key) ?? 0) + p.sanctionedAmountCr)
    })
    return [...totals.entries()]
      .map(([label, value]) => ({ label, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [filtered])

  const statusSegments = useMemo(
    () =>
      (Object.keys(STATUS_LABELS) as Project['status'][])
        .map((status) => ({
          label: STATUS_LABELS[status],
          value: filtered.filter((p) => p.status === status).length,
          color: STATUS_COLORS[status],
        }))
        .filter((s) => s.value > 0),
    [filtered],
  )

  const stateCounts = useMemo(() => topCounts(filtered.map((p) => p.division)), [filtered])

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-heading-1 text-fg">{t('nav.reports')}</h1>
        <p className="mt-1 text-body-small text-fg-muted">
          Analytics across {REPORT_TYPES.length} standard report families, computed from the live project register.
        </p>
      </div>

      <Panel title="Report parameters" icon="tune" bodyClassName="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select label="Report type" value={report} onChange={(e) => setReport(e.target.value)} options={REPORT_TYPES.map((r) => ({ value: r, label: r }))} />
          <Select label={t('common.department')} value={dept} onChange={(e) => setDept(e.target.value)} options={[{ value: '', label: t('common.all') }, ...departments.map((d) => ({ value: d, label: d }))]} />
          <Select label={t('common.district')} value={district} onChange={(e) => setDistrict(e.target.value)} options={[{ value: '', label: t('common.all') }, ...districts.map((d) => ({ value: d, label: d }))]} />
          <TextField label="As-on date" type="date" value={asOn} onChange={(e) => setAsOn(e.target.value)} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button icon="description" onClick={() => showToast(`Report scope: ${filtered.length} projects, sanctioned ${formatCr(outlay)}, utilised ${formatCr(utilized)}.`, 'success')}>
            Generate Report
          </Button>
          <Button variant="outline" icon="print" onClick={() => window.print()}>
            {t('common.printRegister')}
          </Button>
        </div>
      </Panel>

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <Panel title="Reports unavailable" icon="error">
          <p className="text-body-small text-danger-strong">Failed to load project data: {error.message}</p>
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Projects in scope" value={filtered.length} icon="apps" />
            <KpiCard label="Sanctioned outlay" value={formatCr(outlay)} icon="account_balance" />
            <KpiCard label="Utilized" value={formatCr(utilized)} icon="payments" iconTone="success" />
            <KpiCard label="Avg physical progress" value={`${avgPhysical.toFixed(1)}%`} icon="stacked_line_chart" iconTone="primary" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Sanctioned outlay by sector" icon="bar_chart">
              {sectorOutlay.length > 0 ? (
                <BarChart ariaLabel="Sanctioned outlay by sector" data={sectorOutlay} valueFormatter={(v) => formatCr(v)} />
              ) : (
                <p className="text-body-small text-fg-muted">No projects in scope.</p>
              )}
            </Panel>
            <Panel title="Portfolio status mix" icon="donut_large">
              {statusSegments.length > 0 ? (
                <DonutChart
                  ariaLabel="Project status distribution"
                  centerValue={String(filtered.length)}
                  centerLabel="projects"
                  segments={statusSegments}
                />
              ) : (
                <p className="text-body-small text-fg-muted">No projects in scope.</p>
              )}
            </Panel>
          </div>

          <Panel title="Projects by state / division" icon="map">
            {stateCounts.length > 0 ? (
              <BarChart ariaLabel="Project count by state or division" data={stateCounts} valueFormatter={(v) => `${v}`} />
            ) : (
              <p className="text-body-small text-fg-muted">No projects in scope.</p>
            )}
          </Panel>

          <Panel
            title="Contractor register summary"
            icon="engineering"
            subtitle={`${contractors?.length ?? 0} contractor organisations on record, with aggregates from their real contracts and assigned projects.`}
            bodyClassName="p-0"
          >
            <DataTable
              minWidth={820}
              rows={contractors ?? []}
              rowKey={(c) => c.id}
              emptyState={
                <div className="p-8 text-center text-body-small text-fg-muted">
                  No contractor organisations are recorded yet.
                </div>
              }
              columns={[
                { key: 'name', header: 'Contractor', isRowHeader: true, render: (c) => c.name },
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
                { key: 'assigned', header: 'Assigned Projects', cellClassName: 'tabular-nums', render: (c) => c.assignedProjects ?? 0 },
                { key: 'completed', header: 'Completed', cellClassName: 'tabular-nums', render: (c) => c.completedProjects },
                { key: 'contracts', header: 'Active Contracts', cellClassName: 'tabular-nums', render: (c) => c.activeContracts ?? 0 },
                {
                  key: 'progress',
                  header: 'Avg Progress',
                  cellClassName: 'tabular-nums',
                  render: (c) => (c.averageProgressPct != null ? `${c.averageProgressPct}%` : '—'),
                },
                { key: 'value', header: 'Contract Value', cellClassName: 'tabular-nums', render: (c) => formatCr(c.totalValueCr) },
              ]}
            />
          </Panel>
        </>
      )}
    </div>
  )
}
