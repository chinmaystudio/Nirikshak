import { useMemo, useState } from 'react'
import { useI18n } from '@/context/I18nContext'
import { useProjectWorkspace } from '@/context/ProjectWorkspaceContext'
import { useToast } from '@/context/ToastContext'
import { approvalsApi, auditApi, workApi } from '@/api'
import { useApiData } from '@/hooks/useApiData'
import { Panel, Card } from '@/components/ui/Card'
import { DataTable } from '@/components/tables/DataTable'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Drawer, Modal } from '@/components/modals/Modal'
import { TextField } from '@/components/ui/Fields'
import { PageHeader, KpiRow, FilterBar, ConfirmDialog, DetailField, KpiCard } from '@/components/blocks/Page'
import { DualProgress } from '@/components/ui/Progress'
import { formatCr, formatDate } from '@/utils/format'
import { AI_CLASSIFICATION, AI_CONFIDENCE, INSPECTION_OUTCOME, LITIGATION_STATUS } from '@/utils/status'
import type { LitigationCase } from '@/types'

const CONTRACT_STAGES = [
  { label: 'Contract Award', icon: 'emoji_events', dateKey: 'adminApprovalDate' as const },
  { label: 'Work Order', icon: 'receipt_long', dateKey: 'technicalApprovalDate' as const },
  { label: 'Site Handover', icon: 'fence', dateKey: null as null },
  { label: 'Execution', icon: 'construction', dateKey: null as null },
  { label: 'Inspection & Verification', icon: 'fact_check', dateKey: null as null },
  { label: 'Completion', icon: 'flag', dateKey: 'expectedCompletion' as const },
]

const UPDATE_STATUS_BADGE = {
  verified: { key: 'status.approved', tone: 'success', icon: 'verified' },
  pending: { key: 'status.pending', tone: 'warning', icon: 'hourglass_top' },
  rejected: { key: 'status.rejected', tone: 'danger', icon: 'cancel' },
  clarification: { key: 'status.pending', tone: 'warning', icon: 'help' },
} as const

/** Project workspace — Work & Contract Management: the contract-control center
 * with execution tracking, real site progress updates, litigation and AI
 * monitoring — all scoped to the open project. Progress updates and the
 * activity log are read from progress_updates / audit_logs; sections whose
 * domains have no backing table (settlements, migration, hearings) are not
 * shown at all rather than filled with fixture rows. */
export function WorkspaceExecutionPage() {
  const { t } = useI18n()
  const { showToast } = useToast()
  const { project, workOrder, inspections, litigation, insights } = useProjectWorkspace()
  const [refresh, setRefresh] = useState(0)
  const projectDbId = project?.dbId ?? ''
  const { data: loadedUpdates } = useApiData(() => workApi.progressUpdates(projectDbId), [projectDbId, refresh])
  const { data: loadedActivity } = useApiData(() => auditApi.activityForProject(projectDbId), [projectDbId, refresh])
  const { data: loadedMilestones } = useApiData(() => workApi.milestones(projectDbId), [projectDbId])
  const [updateSearch, setUpdateSearch] = useState('')
  const [updateFilter, setUpdateFilter] = useState('')
  const [caseDrawer, setCaseDrawer] = useState<LitigationCase | null>(null)
  const [addUpdateOpen, setAddUpdateOpen] = useState(false)
  const [newUpdate, setNewUpdate] = useState({ location: '', activity: '', progress: '' })
  const [submitting, setSubmitting] = useState(false)
  const [confirm, setConfirm] = useState<{ title: string; message: string; run: () => void } | null>(null)
  const [reportOpen, setReportOpen] = useState(false)

  const projectUpdates = loadedUpdates ?? []
  const projectActivity = loadedActivity ?? []
  const milestones = loadedMilestones ?? []

  const filteredUpdates = useMemo(
    () =>
      projectUpdates.filter(
        (u) =>
          (!updateFilter || u.status === updateFilter) &&
          (!updateSearch ||
            `${u.activity} ${u.location ?? ''} ${u.submittedBy ?? ''} ${u.contractor ?? ''}`.toLowerCase().includes(updateSearch.toLowerCase())),
      ),
    [projectUpdates, updateFilter, updateSearch],
  )

  if (!project) return null

  const completedMilestones = milestones.filter((m) => m.status === 'completed').length
  const delayedMilestones = milestones.filter((m) => m.status === 'delayed')
  const pendingUpdates = projectUpdates.filter((u) => u.status === 'pending').length

  /** Verification is a real write: the approve_progress_update RPC via
   * approvalsApi. The list reloads from the database afterwards. */
  const verifyUpdate = async (id: string, verdict: 'verified' | 'rejected') => {
    try {
      if (verdict === 'verified') await approvalsApi.approve(id, 'Verified from the project workspace.')
      else await approvalsApi.reject(id, 'Rejected from the project workspace — re-submission requested.')
    } catch (err: any) {
      showToast(err?.message || 'The verification could not be recorded. Please try again.', 'danger')
      return
    }
    showToast(
      verdict === 'verified'
        ? 'Progress update verified and posted to the register.'
        : 'Progress update rejected — the contractor can re-submit with corrections.',
      verdict === 'verified' ? 'success' : 'warning',
    )
    setRefresh((k) => k + 1)
  }

  const downloadReport = () => {
    const lines = [
      `Progress & Monitoring Summary — ${project.name} (${project.id})`,
      `Generated ${new Date().toISOString().slice(0, 10)} from the project's recorded data.`,
      '',
      `Physical progress: ${project.physicalProgressPct}%`,
      `Financial progress: ${project.financialProgressPct}%`,
      `Delay against original completion: ${project.delayDays} day(s)`,
      `Milestones: ${completedMilestones}/${milestones.length} completed, ${delayedMilestones.length} delayed`,
      `Progress updates: ${projectUpdates.length} on record, ${pendingUpdates} awaiting verification`,
      '',
      'Stored monitoring insights:',
      ...(insights.length
        ? insights.map((i) => `- ${i.title}: ${i.insight}`)
        : ['- None generated for this project yet.']),
    ]
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `progress-summary-${project.id}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Work & Contract Management"
        description="Contract control center — work order, execution tracking, site updates, litigation and AI-based monitoring for this project."
        actions={
          <>
            <Button variant="outline" size="sm" icon="description" onClick={() => setReportOpen(true)}>
              Generate Report
            </Button>
            <Button variant="primary" size="sm" icon="add" onClick={() => setAddUpdateOpen(true)}>
              Add Progress Update
            </Button>
          </>
        }
      />

      {/* Contract control */}
      <section id="contract" className="scroll-mt-24 flex flex-col gap-4">
        <KpiRow>
          <KpiCard label="Contract Value" value={workOrder ? formatCr(workOrder.valueCr) : '—'} icon="payments" />
          <KpiCard label="Work Order" value={workOrder?.id ?? project.workOrderNo ?? 'Pending'} icon="receipt_long" iconTone="neutral" />
          <KpiCard label="Defect Liability" value={workOrder?.defectLiabilityMonths != null ? `${workOrder.defectLiabilityMonths} mo` : '—'} icon="build_circle" iconTone="neutral" />
          <KpiCard label="Completion Period" value={workOrder?.completionPeriodDays != null ? `${workOrder.completionPeriodDays} ${t('common.days')}` : '—'} icon="schedule" iconTone="neutral" delta={workOrder ? `From ${formatDate(workOrder.issuedOn)}` : undefined} />
        </KpiRow>

        <Panel title="Contract Timeline" icon="timeline">
          <ol className="flex flex-wrap gap-2">
            {CONTRACT_STAGES.map((s, i) => {
              const date = s.dateKey ? formatDate(project[s.dateKey]) : i === 2 && workOrder ? formatDate(workOrder.issuedOn) : null
              const reached = i <= (project.physicalProgressPct > 0 ? 3 : 2) || (project.status === 'completed' && true)
              return (
                <li key={s.label} className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-badge border px-2.5 py-1 text-caption ${
                      reached ? 'border-primary-border bg-primary-soft text-primary-strong' : 'border-border bg-surface text-fg-subtle'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">{s.icon}</span>
                    {s.label}
                    {date && <span className="tabular-nums text-fg-subtle">• {date}</span>}
                  </span>
                  {i < CONTRACT_STAGES.length - 1 && (
                    <span className="material-symbols-outlined text-[16px] text-fg-subtle" aria-hidden="true">chevron_right</span>
                  )}
                </li>
              )
            })}
          </ol>
        </Panel>
      </section>

      {/* Project Execution */}
      <section id="execution" className="scroll-mt-24 flex flex-col gap-4">
        <KpiRow>
          <KpiCard label="Physical Progress" value={`${project.physicalProgressPct}%`} icon="construction" iconTone="primary" />
          <KpiCard label="Financial Progress" value={`${project.financialProgressPct}%`} icon="payments" iconTone="success" />
          <KpiCard label="Milestones Completed" value={milestones.length ? `${completedMilestones} / ${milestones.length}` : '—'} icon="fact_check" iconTone="neutral" />
          <KpiCard
            label="Updates Awaiting Verification"
            value={pendingUpdates}
            icon="hourglass_top"
            iconTone={pendingUpdates ? 'warning' : 'neutral'}
            delta={project.delayDays > 0 ? `${project.delayDays} days delayed` : 'On schedule'}
            deltaTone={project.delayDays > 0 ? 'danger' : 'success'}
          />
        </KpiRow>

        <Panel title="Physical vs Financial Progress" icon="speed">
          <DualProgress physical={project.physicalProgressPct} financial={project.financialProgressPct} />
          <p className="mt-3 text-caption text-fg-subtle">
            Both figures are the project's recorded progress values. No planned-to-date curve is shown — the
            register does not store a time-phased plan for this project.
          </p>
        </Panel>

        <FilterBar
          search={updateSearch}
          onSearch={setUpdateSearch}
          searchPlaceholder="Search activity, milestone, submitter…"
          selects={[
            {
              label: 'Verification',
              value: updateFilter,
              onChange: setUpdateFilter,
              options: [
                { value: '', label: t('common.all') },
                { value: 'verified', label: 'Verified' },
                { value: 'pending', label: 'Pending' },
                { value: 'rejected', label: 'Rejected' },
                { value: 'clarification', label: 'Clarification requested' },
              ],
            },
          ]}
          onClear={() => {
            setUpdateSearch('')
            setUpdateFilter('')
          }}
        />

        <Panel title={`Site Progress Updates (${projectUpdates.length})`} icon="travel_explore" subtitle="Updates recorded in the progress register — verify or reject before they post.">
          <ul className="flex flex-col gap-3 p-4">
            {filteredUpdates.map((u) => (
              <li key={u.id}>
                <Card className="p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-label text-fg">{u.activity}</p>
                      <p className="mt-0.5 text-caption text-fg-muted">
                        {u.location ? `${u.location} • ` : ''}{formatDate(u.date)}
                        {u.submittedBy ? ` • ${u.submittedBy}` : ''}
                        {u.contractor ? ` • ${u.contractor}` : ''}
                      </p>
                      <p className="mt-0.5 text-caption text-fg-subtle">
                        {u.geoTag ? `Geo-tag ${u.geoTag.lat.toFixed(3)}, ${u.geoTag.lng.toFixed(3)}` : 'No geo-tag recorded'}
                        {u.photos > 0 ? ` • ${u.photos} time-stamped photo(s)` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone="neutral" icon="speed">{u.progressPct}%</Badge>
                      <StatusBadge descriptor={UPDATE_STATUS_BADGE[u.status]} size="sm" />
                    </div>
                  </div>
                  {u.verificationNote && <p className="mt-1.5 text-caption text-fg-subtle">{u.verificationNote}</p>}
                  {u.status === 'pending' && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button variant="primary" size="sm" icon="verified" onClick={() => void verifyUpdate(u.id, 'verified')}>
                        {t('common.verify')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        icon="u_turn_left"
                        onClick={() => setConfirm({ title: 'Reject this progress update?', message: 'The contractor will be able to re-submit with corrections. This action is recorded in the audit trail.', run: () => void verifyUpdate(u.id, 'rejected') })}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </Card>
              </li>
            ))}
            {filteredUpdates.length === 0 && (
              <li className="py-6 text-center text-body-small text-fg-muted">
                No progress updates match the current filters. Updates appear here as the field team submits them.
              </li>
            )}
          </ul>
        </Panel>

        <Panel title="Site Evidence" icon="photo_library" subtitle="Photo evidence attached to verified updates, from the updates' evidence records.">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {projectUpdates
              .filter((u) => u.status === 'verified' && u.photos > 0)
              .slice(0, 4)
              .map((u) => (
                <div key={u.id} className="nk-card flex aspect-[4/3] flex-col items-center justify-center gap-1 p-3 text-center">
                  <span className="material-symbols-outlined text-[28px] text-fg-subtle" aria-hidden="true">image</span>
                  <p className="text-caption text-fg-muted">{u.location ?? u.activity}</p>
                  <p className="text-caption text-fg-subtle">{formatDate(u.date)} • {u.photos} photos</p>
                </div>
              ))}
            {projectUpdates.filter((u) => u.status === 'verified' && u.photos > 0).length === 0 && (
              <p className="col-span-full text-center text-body-small text-fg-muted">Verified photo evidence will appear as updates are verified.</p>
            )}
          </div>
        </Panel>

        <Panel title="Site Inspections" icon="fact_check" bodyClassName="p-0">
          <DataTable
            minWidth={900}
            rows={inspections}
            rowKey={(i) => i.id}
            paginated
            pageSize={6}
            columns={[
              { key: 'id', header: 'Ref', render: (i) => <span className="nk-mono-id text-fg-muted">{i.id}</span> },
              { key: 'date', header: 'Date', cellClassName: 'tabular-nums', sortable: true, sortValue: (i) => i.inspectedOn, render: (i) => formatDate(i.inspectedOn) },
              { key: 'type', header: 'Type', render: (i) => <Badge tone="neutral">{i.type}</Badge> },
              { key: 'inspector', header: 'Inspector', render: (i) => i.inspector ?? '—' },
              { key: 'outcome', header: 'Outcome', render: (i) => <StatusBadge descriptor={INSPECTION_OUTCOME[i.outcome]} size="sm" /> },
              { key: 'geo', header: 'Geo-Tag', cellClassName: 'tabular-nums', render: (i) => (i.geoTag ? `${i.geoTag.lat.toFixed(3)}, ${i.geoTag.lng.toFixed(3)}` : '—') },
              { key: 'photos', header: 'Photos', cellClassName: 'tabular-nums', render: (i) => i.photosCount },
            ]}
            emptyState={<div className="p-8 text-center text-body-small text-fg-muted">No inspections recorded for this project yet.</div>}
          />
        </Panel>
      </section>

      {/* Litigation Management — litigationApi reads no table (none exists in
          the schema), so this section renders its honest empty state. */}
      <section id="litigation" className="scroll-mt-24 flex flex-col gap-4">
        <KpiRow>
          <KpiCard label="Active Cases" value={litigation.filter((c) => !['decided', 'withdrawn'].includes(c.status)).length} icon="policy" />
          <KpiCard label="Hearings Scheduled" value={litigation.filter((c) => c.status === 'hearing_scheduled').length} icon="event" iconTone="warning" />
          <KpiCard label="Claims Value" value={formatCr(litigation.reduce((s, c) => s + (c.claimAmountCr ?? 0), 0))} icon="payments" iconTone="neutral" />
          <KpiCard label="Resolved" value={litigation.filter((c) => ['decided', 'withdrawn'].includes(c.status)).length} icon="verified" iconTone="success" />
        </KpiRow>

        <Panel title="Litigation Management" icon="policy" bodyClassName="p-0">
          <DataTable
            minWidth={960}
            rows={litigation}
            rowKey={(l) => l.id}
            columns={[
              { key: 'id', header: 'Case ID', isRowHeader: true, render: (l) => <span className="nk-mono-id text-fg">{l.id}</span> },
              { key: 'title', header: 'Case', render: (l) => <span className="block max-w-64 truncate" title={l.title}>{l.title}</span> },
              { key: 'court', header: 'Court', render: (l) => <span className="text-caption">{l.court}</span> },
              { key: 'claim', header: 'Claim', cellClassName: 'tabular-nums', render: (l) => (l.claimAmountCr ? formatCr(l.claimAmountCr) : '—') },
              { key: 'status', header: t('common.status'), render: (l) => <StatusBadge descriptor={LITIGATION_STATUS[l.status]} size="sm" /> },
              { key: 'hearing', header: 'Next Hearing', cellClassName: 'tabular-nums', sortable: true, sortValue: (l) => l.nextHearing ?? '', render: (l) => (l.nextHearing ? formatDate(l.nextHearing) : '—') },
            ]}
            rowActions={(l) => (
              <Button variant="outline" size="sm" className="!min-h-7 !px-2.5" onClick={() => setCaseDrawer(l)}>
                {t('common.view')}
              </Button>
            )}
            emptyState={
              <div className="p-8 text-center">
                <p className="text-body-small text-fg-muted">No litigation is linked to this project.</p>
              </div>
            }
          />
        </Panel>
      </section>

      {/* AI-Based Monitoring & Reports */}
      <section id="ai-monitoring" className="scroll-mt-24 flex flex-col gap-4">
        <Panel
          title="AI-Based Monitoring & Reports"
          icon="monitoring"
          subtitle="Automated analysis of this project's records only — AI assists, officers decide."
          bodyClassName="p-0"
          actions={
            <Button variant="primary" size="sm" icon="auto_awesome" onClick={() => setReportOpen(true)}>
              Generate Report
            </Button>
          }
        >
          <div className="flex flex-col gap-3 p-4">
            {insights.map((i) => (
              <Card key={i.id} className="p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge descriptor={AI_CLASSIFICATION[i.classification]} size="sm" />
                  {i.confidenceBand && <StatusBadge descriptor={AI_CONFIDENCE[i.confidenceBand]} size="sm" />}
                  <span className="text-caption tabular-nums text-fg-subtle">{i.confidencePct != null ? `${i.confidencePct}% • ` : ''}{formatDate(i.generatedOn)}</span>
                </div>
                <h3 className="mt-2 text-heading-3 text-fg">{i.title}</h3>
                <p className="mt-1 text-body-small text-fg-muted">{i.insight}</p>
                <p className="mt-2 text-caption text-fg"><strong>Recommended action:</strong> {i.recommendedAction}</p>
              </Card>
            ))}
            {insights.length === 0 && (
              <p className="text-body-small text-fg-muted">No automated monitoring insights generated for this project yet.</p>
            )}
          </div>
        </Panel>

        <Panel title="Recent Activity (This Project)" icon="history" bodyClassName="p-0">
          <DataTable
            minWidth={900}
            rows={projectActivity}
            rowKey={(a) => a.id}
            columns={[
              { key: 'when', header: 'When', cellClassName: 'tabular-nums', render: (a) => <span className="text-caption">{formatDate(a.timestamp)}</span> },
              { key: 'who', header: 'WHO', isRowHeader: true, render: (a) => (a.role ? `${a.actor} (${a.role})` : a.actor) },
              { key: 'what', header: 'WHAT', render: (a) => a.action },
              { key: 'field', header: 'Field', render: (a) => <span className="nk-mono-id text-fg-muted">{a.field}</span> },
              { key: 'old', header: 'Old Value', render: (a) => <span className="text-caption text-fg-muted">{a.oldValue}</span> },
              { key: 'new', header: 'New Value', render: (a) => <span className="text-caption text-fg">{a.newValue}</span> },
            ]}
            emptyState={<div className="p-8 text-center text-body-small text-fg-muted">No audit-log activity is recorded against this project yet.</div>}
          />
        </Panel>
      </section>

      {/* Litigation case drawer */}
      <Drawer open={caseDrawer !== null} onClose={() => setCaseDrawer(null)} title={caseDrawer?.id ?? ''} titleIcon="policy" width="max-w-xl">
        {caseDrawer && <CaseDrawer caseItem={caseDrawer} />}
      </Drawer>

      {/* Add progress update — a real insert into progress_updates against
          the project's assigned contractor. No geo-tag is attached from
          this console; geo-tagged evidence is captured by the field app. */}
      <Modal
        open={addUpdateOpen}
        onClose={() => setAddUpdateOpen(false)}
        title="Add Progress Update"
        titleIcon="add_a_photo"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setAddUpdateOpen(false)}>{t('common.cancel')}</Button>
            <Button
              variant="primary"
              disabled={!newUpdate.activity.trim() || !(Number(newUpdate.progress) >= 0 && Number(newUpdate.progress) <= 100) || submitting}
              onClick={async () => {
                setSubmitting(true)
                try {
                  await workApi.createProgressUpdate(projectDbId, {
                    activity: newUpdate.activity.trim(),
                    location: newUpdate.location.trim() || undefined,
                    progressPct: Number(newUpdate.progress),
                  })
                } catch (err: any) {
                  showToast(err?.message || 'The progress update could not be recorded. Please try again.', 'danger')
                  setSubmitting(false)
                  return
                }
                setSubmitting(false)
                showToast('Progress update recorded in the register — awaiting verification.', 'success')
                setNewUpdate({ location: '', activity: '', progress: '' })
                setAddUpdateOpen(false)
                setRefresh((k) => k + 1)
              }}
            >
              {submitting ? 'Saving…' : t('common.submit')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <TextField label="Location / chainage" value={newUpdate.location} onChange={(e) => setNewUpdate((f) => ({ ...f, location: e.target.value }))} placeholder="e.g. Ch 44+320" />
          <TextField label="Activity" required value={newUpdate.activity} onChange={(e) => setNewUpdate((f) => ({ ...f, activity: e.target.value }))} placeholder="e.g. WMM laying — 240 m" />
          <TextField label="Progress at location (%)" required type="number" min={0} max={100} value={newUpdate.progress} onChange={(e) => setNewUpdate((f) => ({ ...f, progress: e.target.value }))} />
          <p className="text-caption text-fg-subtle">
            The update is recorded against the contractor holding this project's contract and starts as
            awaiting verification. No geo-tag is attached from this console — geo-tagged photo evidence is
            captured by the field app.
          </p>
        </div>
      </Modal>

      {/* Progress & monitoring summary — composed only from recorded data */}
      <Modal open={reportOpen} onClose={() => setReportOpen(false)} title="Progress & Monitoring Summary" titleIcon="monitoring" size="lg"
        footer={
          <>
            <Button variant="outline" onClick={downloadReport}>
              {t('common.export')}
            </Button>
            <Button variant="primary" onClick={() => setReportOpen(false)}>{t('common.close')}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 text-body-small">
          <div>
            <p className="nk-label">Summary</p>
            <p className="mt-1 text-fg">
              {project.name} stands at {project.physicalProgressPct}% physical and {project.financialProgressPct}% financial
              progress. {project.delayDays > 0 ? `The recorded completion dates put the works ${project.delayDays} days behind the original completion date.` : 'No delay is recorded against the original completion date.'}
            </p>
          </div>
          <div>
            <p className="nk-label">Milestones</p>
            <p className="mt-1 text-fg-muted">
              {milestones.length === 0
                ? 'No milestones are recorded for this project.'
                : `${completedMilestones} of ${milestones.length} milestones completed; ${delayedMilestones.length} delayed${delayedMilestones.length ? ` (${delayedMilestones.map((m) => m.title).join('; ')})` : ''}.`}
            </p>
          </div>
          <div>
            <p className="nk-label">Progress Updates</p>
            <p className="mt-1 text-fg-muted">
              {projectUpdates.length} update(s) on record — {projectUpdates.filter((u) => u.status === 'verified').length} verified,{' '}
              {pendingUpdates} awaiting verification, {projectUpdates.filter((u) => u.status === 'rejected').length} rejected.
            </p>
          </div>
          <div>
            <p className="nk-label">Stored Monitoring Insights</p>
            <ul className="mt-1 list-disc pl-5 text-fg-muted">
              {insights.slice(0, 3).map((i) => (
                <li key={i.id}>{i.title} — {i.insight.split('.')[0]}.</li>
              ))}
              {insights.length === 0 && <li>No monitoring insights have been generated for this project yet.</li>}
            </ul>
          </div>
          <p className="rounded-control bg-surface-2 p-2 text-caption text-fg-muted">
            This summary is composed from the project's recorded progress, milestone, update and insight
            data only. It contains no forecast or prediction.
          </p>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        onConfirm={() => confirm?.run()}
        danger
      />
    </div>
  )
}

function CaseDrawer({ caseItem }: { caseItem: LitigationCase }) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge descriptor={LITIGATION_STATUS[caseItem.status]} />
        {caseItem.claimAmountCr != null && <Badge tone="neutral" icon="payments">Claim {formatCr(caseItem.claimAmountCr)}</Badge>}
      </div>
      <Panel title="Case Summary" icon="description">
        <dl className="grid grid-cols-2 gap-3 text-body-small">
          <DetailField label="Title" value={caseItem.title} />
          <DetailField label="Case No." value={<span className="nk-mono-id">{caseItem.caseNo}</span>} />
          <DetailField label="Court / Authority" value={caseItem.court} />
          <DetailField label="Filed on" value={formatDate(caseItem.filedOn)} />
          <DetailField label="Next hearing" value={caseItem.nextHearing ? formatDate(caseItem.nextHearing) : '—'} />
          <DetailField label="Department counsel" value={caseItem.counsel} />
          {caseItem.contractor && (
            <div className="col-span-2">
              <dt className="text-fg-subtle">Contractor party</dt>
              <dd className="text-fg">{caseItem.contractor}</dd>
            </div>
          )}
          <div className="col-span-2">
            <dt className="text-fg-subtle">Officer notes / summary</dt>
            <dd className="text-fg-muted">{caseItem.summary}</dd>
          </div>
        </dl>
      </Panel>
      <Panel title="Hearings & Orders" icon="event">
        <p className="text-body-small text-fg-muted">
          No hearings are recorded for this case — the portal has no hearings register.
        </p>
      </Panel>
      <Panel title="Financial Exposure" icon="payments">
        <p className="text-body-small text-fg">
          Claim on record: <strong className="tabular-nums">{caseItem.claimAmountCr != null ? formatCr(caseItem.claimAmountCr) : '—'}</strong>.
          Contingent liability is tracked in the financial statements; settlement requires competent-authority approval.
        </p>
      </Panel>
    </div>
  )
}
