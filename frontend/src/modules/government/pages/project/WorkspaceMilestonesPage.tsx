import { useState } from 'react'
import { useI18n } from '@/context/I18nContext'
import { useProjectWorkspace } from '@/context/ProjectWorkspaceContext'
import { useToast } from '@/context/ToastContext'
import { workApi } from '@/api'
import { useApiData } from '@/hooks/useApiData'
import { Panel } from '@/components/ui/Card'
import { DataTable } from '@/components/tables/DataTable'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import { Button } from '@/components/ui/Button'
import { Drawer, Modal } from '@/components/modals/Modal'
import { TextField } from '@/components/ui/Fields'
import { PageHeader, KpiRow, DetailField, KpiCard } from '@/components/blocks/Page'
import { formatCr, formatDate } from '@/utils/format'
import { MILESTONE_STATUS } from '@/utils/status'
import type { Milestone } from '@/types'

/** Project workspace — Milestone Management: the project's real
 * project_milestones register — deadline tracking and verified-progress
 * corrections. Only stored milestone fields are rendered; the register
 * carries no verification workflow, payment linkage or deliverable
 * checklist, so none is shown. */
export function WorkspaceMilestonesPage() {
  const { t } = useI18n()
  const { showToast } = useToast()
  const { project } = useProjectWorkspace()
  const [refresh, setRefresh] = useState(0)
  const projectDbId = project?.dbId ?? ''
  const { data: loadedMilestones } = useApiData(() => workApi.milestones(projectDbId), [projectDbId, refresh])
  const [detail, setDetail] = useState<Milestone | null>(null)
  const [updateTarget, setUpdateTarget] = useState<Milestone | null>(null)
  const [newProgress, setNewProgress] = useState('')
  const [saving, setSaving] = useState(false)

  if (!project) return null

  const milestones = loadedMilestones ?? []
  const completed = milestones.filter((m) => m.status === 'completed').length
  const inProgress = milestones.filter((m) => m.status === 'in_progress').length
  const delayed = milestones.filter((m) => m.status === 'delayed').length
  const upcoming = milestones.filter((m) => m.status === 'upcoming').length

  const exportRegister = () => {
    const rows: (string | number)[][] = [
      ['Milestone', 'Status', 'Planned start', 'Planned end', 'Actual start', 'Actual end', 'Planned %', 'Verified %', 'Planned cost (₹ Cr)', 'Actual cost (₹ Cr)'],
      ...milestones.map((m) => [
        m.title, m.status, m.plannedStart, m.plannedEnd, m.actualStart ?? '', m.actualEnd ?? '',
        m.plannedProgressPct ?? '', m.physicalProgressPct, m.plannedCostCr ?? '', m.actualCostCr ?? '',
      ]),
    ]
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `milestones-${project.id}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Milestone Management"
        description="Deadline tracking and verified progress for this project's milestone register."
        actions={
          <Button variant="outline" size="sm" icon="download" onClick={exportRegister}>
            {t('common.export')}
          </Button>
        }
      />

      <KpiRow>
        <KpiCard label="Total Milestones" value={milestones.length} icon="fact_check" />
        <KpiCard label="Completed" value={completed} icon="verified" iconTone="success" />
        <KpiCard label="In Progress" value={inProgress} icon="construction" iconTone="neutral" />
        <KpiCard label="Delayed / Upcoming" value={`${delayed} / ${upcoming}`} icon="timer_off" iconTone={delayed ? 'danger' : 'neutral'} />
      </KpiRow>

      {/* Visual timeline */}
      <Panel title="Milestone Timeline" icon="timeline">
        {milestones.length > 0 ? (
          <ol className="relative ml-3 border-l-2 border-border">
            {milestones.map((m) => (
              <li key={m.id} className="mb-4 ml-4 last:mb-0">
                <span
                  className={`absolute -left-[9px] mt-1.5 h-4 w-4 rounded-full border-2 border-surface ${
                    m.status === 'completed' ? 'bg-success' : m.status === 'delayed' ? 'bg-danger' : m.status === 'upcoming' ? 'bg-surface-3' : 'bg-primary'
                  }`}
                  aria-hidden="true"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => setDetail(m)} className="text-body-small font-medium text-fg hover:text-primary-strong hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                    {m.title}
                  </button>
                  <StatusBadge descriptor={MILESTONE_STATUS[m.status]} size="sm" />
                </div>
                <p className="mt-0.5 text-caption text-fg-subtle">
                  {formatDate(m.plannedStart)} → {formatDate(m.plannedEnd)}
                  {m.actualEnd ? ` • finished ${formatDate(m.actualEnd)}` : ''}
                  {m.delayDays ? ` • +${m.delayDays} ${t('common.days')}` : ''}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-body-small text-fg-muted">No milestones are recorded for this project yet.</p>
        )}
      </Panel>

      <Panel title={`Milestone Register (${milestones.length})`} icon="checklist" bodyClassName="p-0">
        <DataTable
          minWidth={1060}
          rows={milestones}
          rowKey={(m) => m.id}
          columns={[
            { key: 'title', header: 'Milestone', isRowHeader: true, render: (m) => (
              <button type="button" onClick={() => setDetail(m)} className="text-left font-medium text-fg hover:text-primary-strong hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                {m.title}
              </button>
            ) },
            { key: 'window', header: 'Planned Window', cellClassName: 'tabular-nums', render: (m) => `${formatDate(m.plannedStart)} → ${formatDate(m.plannedEnd)}` },
            { key: 'progress', header: 'Verified Progress', sortable: true, sortValue: (m) => m.physicalProgressPct, render: (m) => <Progress value={m.physicalProgressPct} label={`Verified progress of ${m.title}`} size="sm" className="min-w-28" /> },
            { key: 'planned', header: 'Planned %', cellClassName: 'tabular-nums', render: (m) => `${m.plannedProgressPct ?? 0}%` },
            { key: 'status', header: t('common.status'), render: (m) => <StatusBadge descriptor={MILESTONE_STATUS[m.status]} size="sm" /> },
            { key: 'delay', header: 'Delay', cellClassName: 'tabular-nums', render: (m) => (m.delayDays ? <Badge tone="danger" icon="timer_off">+{m.delayDays}d</Badge> : <span className="text-caption text-fg-subtle">—</span>) },
          ]}
          rowActions={(m) => (
            <Button
              variant="outline"
              size="sm"
              className="!min-h-7 !px-2.5"
              onClick={() => {
                setUpdateTarget(m)
                setNewProgress(String(m.physicalProgressPct))
              }}
            >
              Update
            </Button>
          )}
          emptyState={<div className="p-8 text-center text-body-small text-fg-muted">No milestones are recorded for this project yet.</div>}
        />
      </Panel>

      {/* Milestone detail drawer — stored fields only */}
      <Drawer open={detail !== null} onClose={() => setDetail(null)} title={detail?.title ?? ''} titleIcon="fact_check" width="max-w-lg">
        {detail && (
          <div className="flex flex-col gap-4 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge descriptor={MILESTONE_STATUS[detail.status]} />
              <Badge tone="neutral" icon="speed">{detail.physicalProgressPct}% verified</Badge>
              {detail.delayDays ? <Badge tone="danger" icon="timer_off">+{detail.delayDays} {t('common.days')}</Badge> : null}
            </div>
            <Panel title="Scope & Schedule" icon="info">
              <dl className="grid grid-cols-2 gap-3 text-body-small">
                <DetailField label="Planned start" value={formatDate(detail.plannedStart)} />
                <DetailField label="Planned end" value={formatDate(detail.plannedEnd)} />
                <DetailField label="Actual start" value={detail.actualStart ? formatDate(detail.actualStart) : '—'} />
                <DetailField label="Actual end" value={detail.actualEnd ? formatDate(detail.actualEnd) : '—'} />
                <DetailField label="Responsible" value={project.contractor ?? '—'} />
                <DetailField label="Remarks" value={detail.remarks ?? '—'} />
              </dl>
            </Panel>
            <Panel title="Progress & Cost" icon="payments">
              <dl className="grid grid-cols-2 gap-3 text-body-small">
                <DetailField label="Planned progress" value={`${detail.plannedProgressPct ?? 0}%`} />
                <DetailField label="Verified progress" value={`${detail.physicalProgressPct}%`} />
                <DetailField label="Weightage" value={detail.weightage != null ? `${detail.weightage}%` : '—'} />
                <DetailField label="Planned cost" value={<span className="tabular-nums">{formatCr(detail.plannedCostCr)}</span>} />
                <DetailField label="Actual cost" value={<span className="tabular-nums">{formatCr(detail.actualCostCr)}</span>} />
              </dl>
              <p className="mt-3 text-caption text-fg-subtle">
                Milestone verification itself is recorded through progress-update approvals in Work &amp;
                Contract Management ({project.inspectionsCount} inspections on record for this project).
              </p>
            </Panel>
          </div>
        )}
      </Drawer>

      {/* Update verified progress — persisted to project_milestones */}
      <Modal
        open={updateTarget !== null}
        onClose={() => setUpdateTarget(null)}
        title={`Update Progress — ${updateTarget?.title ?? ''}`}
        titleIcon="edit"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setUpdateTarget(null)}>{t('common.cancel')}</Button>
            <Button
              variant="primary"
              disabled={!(Number(newProgress) >= 0 && Number(newProgress) <= 100) || saving}
              onClick={async () => {
                if (!updateTarget) return
                const value = Number(newProgress)
                setSaving(true)
                try {
                  await workApi.updateMilestoneProgress(updateTarget.id, value)
                } catch (err: any) {
                  showToast(err?.message || 'The milestone progress could not be saved. Please try again.', 'danger')
                  setSaving(false)
                  return
                }
                setSaving(false)
                showToast(`Verified progress on "${updateTarget.title}" recorded as ${value}%.`, 'success')
                setUpdateTarget(null)
                setRefresh((k) => k + 1)
              }}
            >
              {saving ? 'Saving…' : t('common.submit')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <TextField label="Verified physical progress (%)" required type="number" min={0} max={100} value={newProgress} onChange={(e) => setNewProgress(e.target.value)} />
          <p className="text-caption text-fg-subtle">
            This writes the milestone's verified progress to the register; the milestone status follows
            from it (100% completes the milestone).
          </p>
        </div>
      </Modal>
    </div>
  )
}
