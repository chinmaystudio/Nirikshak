import { useMemo } from 'react'
import { useProjectWorkspace } from '@/context/ProjectWorkspaceContext'
import { Panel, Card } from '@/components/ui/Card'
import { DataTable } from '@/components/tables/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import { LoadingBlock } from '@/components/feedback/Feedback'
import { PageHeader, KpiRow, KpiCard } from '@/components/blocks/Page'
import { formatCr } from '@/utils/format'
import { contractorsApi } from '@/api'
import { useApiData } from '@/hooks/useApiData'
import type { Contractor, ContractorEvaluation } from '@/types'

type EvaluationProject = ContractorEvaluation['projects'][number]

/**
 * Project workspace — Contractor Evaluation. The evaluation is computed
 * from this contractor's real portal records: assigned projects (contracts
 * + project_organizations), completed projects, average recorded progress
 * and active contracts. There is no model score and no invented factor
 * breakdown — the officer judges from the record itself.
 */
export function WorkspaceContractorEvalPage() {
  const { project } = useProjectWorkspace()

  const { data: contractors, loading: loadingContractors } = useApiData(() => contractorsApi.all(), [])

  const assigned: Contractor | undefined = useMemo(() => {
    const list = contractors ?? []
    if (project?.dbId) {
      const byLink = list.find((c) => c.projectIds?.includes(project.dbId!))
      if (byLink) return byLink
    }
    if (project?.contractor) return list.find((c) => c.name === project.contractor)
    return undefined
  }, [contractors, project?.dbId, project?.contractor])

  const evaluation = useApiData(
    () => (assigned ? contractorsApi.evaluate(assigned.id) : Promise.resolve(undefined)),
    [assigned?.id],
  )

  const ranked = useMemo(
    () =>
      [...(contractors ?? [])].sort(
        (a, b) =>
          b.completedProjects - a.completedProjects ||
          (b.averageProgressPct ?? -1) - (a.averageProgressPct ?? -1),
      ),
    [contractors],
  )

  if (!project) return null
  if (loadingContractors) return <LoadingBlock />

  if (!assigned) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title="Contractor Evaluation"
          description="Evaluation from the contractor's recorded work history. It becomes available after tender award links a contractor to this project."
        />
        <Panel title="No contractor appointed yet" icon="person_search">
          <p className="text-body-small text-fg-muted">
            No contractor organisation is linked to this project through a contract or project assignment, so there
            is no record to evaluate.
          </p>
        </Panel>
      </div>
    )
  }

  const ev = evaluation.data

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Contractor Evaluation"
        description={`Record-based evaluation for ${assigned.name} — computed from contracts, project assignments and recorded progress in this portal. The award decision always remains with the authorized officer.`}
      />

      {evaluation.loading ? (
        <LoadingBlock />
      ) : evaluation.error ? (
        <Panel title="Evaluation unavailable" icon="error">
          <p className="text-body-small text-danger-strong">Failed to compute the evaluation: {evaluation.error.message}</p>
        </Panel>
      ) : ev ? (
        <>
          <KpiRow>
            <KpiCard label="Assigned Projects" value={ev.assignedProjects} icon="assignment" />
            <KpiCard label="Completed Projects" value={ev.completedProjects} icon="task_alt" iconTone="success" />
            <KpiCard
              label="Completion Rate"
              value={ev.completionRatePct != null ? `${ev.completionRatePct}%` : '—'}
              icon="percent"
              iconTone="primary"
            />
            <KpiCard label="Active Contracts" value={ev.activeContracts} icon="contract" iconTone="neutral" />
          </KpiRow>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Average Recorded Progress" icon="stacked_line_chart">
              {ev.averageProgressPct != null ? (
                <>
                  <p className="text-display tabular-nums text-fg">
                    {ev.averageProgressPct}
                    <span className="text-body-small text-fg-subtle">% mean physical progress across assigned projects</span>
                  </p>
                  <Progress value={ev.averageProgressPct} label="Average progress" size="sm" className="mt-3" showValue={false} />
                </>
              ) : (
                <p className="text-body-small text-fg-muted">No progress has been recorded for this contractor's projects yet.</p>
              )}
            </Panel>
            <Panel title="Contract Exposure" icon="payments">
              <dl className="grid grid-cols-2 gap-3 text-body-small">
                <div>
                  <dt className="text-fg-subtle">Total contract value</dt>
                  <dd className="tabular-nums text-fg">{formatCr(ev.totalContractValueCr)}</dd>
                </div>
                <div>
                  <dt className="text-fg-subtle">Active projects</dt>
                  <dd className="tabular-nums text-fg">{ev.activeProjects}</dd>
                </div>
                <div>
                  <dt className="text-fg-subtle">Organisation verified</dt>
                  <dd className="text-fg">{assigned.verified ? 'Yes' : 'Not recorded'}</dd>
                </div>
                <div>
                  <dt className="text-fg-subtle">Registration no.</dt>
                  <dd className="nk-mono-id text-fg">{assigned.registrationNo ?? '—'}</dd>
                </div>
              </dl>
            </Panel>
          </div>

          <Panel title="Assigned Project Record" icon="folder_open" bodyClassName="p-0">
            <DataTable
              minWidth={820}
              rows={ev.projects}
              rowKey={(p: EvaluationProject) => p.id}
              emptyState={
                <div className="p-8 text-center text-body-small text-fg-muted">
                  No projects are linked to this contractor yet.
                </div>
              }
              columns={[
                { key: 'name', header: 'Project', isRowHeader: true, render: (p: EvaluationProject) => p.name },
                { key: 'status', header: 'Status', render: (p: EvaluationProject) => <Badge tone="neutral">{p.status || '—'}</Badge> },
                { key: 'progress', header: 'Progress', cellClassName: 'tabular-nums', render: (p: EvaluationProject) => `${p.progressPct}%` },
                {
                  key: 'value',
                  header: 'Contract Value',
                  cellClassName: 'tabular-nums',
                  render: (p: EvaluationProject) => (p.contractValueCr != null ? formatCr(p.contractValueCr) : '—'),
                },
                { key: 'contractStatus', header: 'Contract Status', render: (p: EvaluationProject) => p.contractStatus ?? '—' },
              ]}
            />
          </Panel>
        </>
      ) : null}

      {/* Comparison across the real register */}
      <Panel
        title="Contractor Comparison"
        icon="compare_arrows"
        subtitle="All contractor organisations on record, ordered by completed projects, then average progress."
        bodyClassName="p-0"
      >
        <DataTable
          minWidth={880}
          rows={ranked}
          rowKey={(c) => c.id}
          emptyState={
            <div className="p-8 text-center text-body-small text-fg-muted">No contractor organisations are recorded yet.</div>
          }
          columns={[
            { key: 'name', header: 'Contractor', isRowHeader: true, render: (c) => (
              <span className={c.id === assigned.id ? 'font-semibold text-primary-strong' : ''}>
                {c.name}{c.id === assigned.id ? ' (assigned here)' : ''}
              </span>
            ) },
            { key: 'assigned', header: 'Assigned', cellClassName: 'tabular-nums', render: (c) => c.assignedProjects ?? 0 },
            { key: 'completed', header: 'Completed', cellClassName: 'tabular-nums', render: (c) => c.completedProjects },
            {
              key: 'rate',
              header: 'Completion Rate',
              cellClassName: 'tabular-nums',
              render: (c) =>
                (c.assignedProjects ?? 0) > 0
                  ? `${Math.round((c.completedProjects / (c.assignedProjects ?? 1)) * 1000) / 10}%`
                  : '—',
            },
            {
              key: 'progress',
              header: 'Avg Progress',
              cellClassName: 'tabular-nums',
              render: (c) => (c.averageProgressPct != null ? `${c.averageProgressPct}%` : '—'),
            },
            { key: 'contracts', header: 'Active Contracts', cellClassName: 'tabular-nums', render: (c) => c.activeContracts ?? 0 },
            { key: 'value', header: 'Contract Value', cellClassName: 'tabular-nums', render: (c) => formatCr(c.totalValueCr) },
          ]}
        />
      </Panel>

      <Card className="p-3 text-caption text-fg-subtle">
        This evaluation is arithmetic over the contractor's recorded contracts, assignments and progress in this
        portal. It is not a model score, and it does not replace the officer's judgement or any statutory
        qualification criteria.
      </Card>
    </div>
  )
}
