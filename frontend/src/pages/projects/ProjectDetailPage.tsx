import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useI18n } from '@/context/I18nContext'
import { Tabs, TabPanel } from '@/components/navigation/Tabs'
import { Panel, Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Progress, DualProgress } from '@/components/ui/Progress'
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs'
import { LoadingBlock } from '@/components/feedback/Feedback'
import { DataTable } from '@/components/tables/DataTable'
import { Badge } from '@/components/ui/Badge'
import { formatCr, formatDate, formatSlaCountdown, formatFileSizeKb } from '@/utils/format'
import {
  PROJECT_STATUS,
  MILESTONE_STATUS,
  GRIEVANCE_STATUS,
  LITIGATION_STATUS,
  ACCESS_LEVEL,
  AI_CLASSIFICATION,
  AI_CONFIDENCE,
  AUDIT_SEVERITY,
  INSPECTION_OUTCOME,
} from '@/utils/status'
import { PROJECT_DETAIL_TABS } from '@/constants'
import type { ProjectDetailTab } from '@/constants'
import { projectsApi } from '@/api'
import { useApiData } from '@/hooks/useApiData'
import { PROJECTS } from '@/data/projects'
import { WORK_ORDERS, INSPECTIONS, LITIGATION, GRIEVANCES, DOCUMENTS, APPROVALS, AI_INSIGHTS, AUDIT_FINDINGS } from '@/data/modules'

/**
 * ProjectDetailPage — 13 sub-tabs (spec). Shows the full government record:
 * overview, timeline, financials, milestones, work order, contractor,
 * inspections, documents, grievances, approvals, litigation, AI insights,
 * audit trail.
 */
export function ProjectDetailPage() {
  const { id = '' } = useParams()
  const { t } = useI18n()
  const { data: project, loading } = useApiData(() => projectsApi.get(id), [id])
  const [tab, setTab] = useState<ProjectDetailTab>('overview')

  const workOrder = useMemo(() => WORK_ORDERS.find((w) => w.projectId === id), [id])
  const inspections = useMemo(() => INSPECTIONS.filter((i) => i.projectId === id), [id])
  const litigation = useMemo(() => LITIGATION.filter((l) => l.projectId === id), [id])
  const grievances = useMemo(() => GRIEVANCES.filter((g) => g.projectId === id), [id])
  const documents = useMemo(() => DOCUMENTS.filter((d) => d.projectId === id), [id])
  const approvals = useMemo(() => APPROVALS.filter((a) => a.projectId === id), [id])
  const insights = useMemo(() => AI_INSIGHTS.filter((i) => i.relatedProjectIds.includes(id)), [id])
  const findings = useMemo(() => AUDIT_FINDINGS.filter((f) => f.projectId === id), [id])
  const citizen = useMemo(() => PROJECTS.find((p) => p.id === id), [id])

  if (loading) return <LoadingBlock />
  if (!project) {
    return (
      <div className="nk-card p-10 text-center">
        <p className="text-heading-2 text-fg">{t('err.projectNotFound')}</p>
        <p className="nk-mono-id mt-2 text-fg-muted">{id}</p>
        <Link to="/projects" className="mt-4 inline-block text-body-small text-primary-strong hover:underline">
          {t('common.back')} — {t('nav.projects')}
        </Link>
      </div>
    )
  }

  const tabMeta: Record<ProjectDetailTab, { label: string; icon: string; badge?: number }> = {
    overview: { label: t('common.overview'), icon: 'dashboard' },
    timeline: { label: t('common.timeline'), icon: 'timeline' },
    financials: { label: 'Financials', icon: 'account_balance_wallet' },
    milestones: { label: t('common.milestones'), icon: 'fact_check', badge: project.milestones.length },
    workOrder: { label: t('common.workOrder'), icon: 'construction' },
    contractor: { label: t('common.contractor'), icon: 'engineering' },
    inspections: { label: t('common.inspections'), icon: 'travel_explore', badge: inspections.length },
    documents: { label: t('common.documents'), icon: 'folder_shared', badge: documents.length },
    grievances: { label: t('common.grievances'), icon: 'report_problem', badge: grievances.length },
    approvals: { label: t('common.approvals'), icon: 'rule', badge: approvals.length },
    litigation: { label: t('common.litigation'), icon: 'policy', badge: litigation.length },
    aiInsights: { label: 'AI Insights', icon: 'auto_awesome', badge: insights.length },
    auditTrail: { label: t('common.auditTrail'), icon: 'content_paste_search', badge: findings.length },
  }

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs
        items={[
          { label: t('nav.dashboard'), to: '/dashboard' },
          { label: t('nav.projects'), to: '/projects' },
          { label: project.id },
        ]}
      />

      {/* Identity header */}
      <div className="nk-card p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="nk-mono-id text-fg-muted">{project.id}</p>
            <h1 className="mt-1 text-heading-1 text-fg">{project.name}</h1>
            <p className="mt-1 text-body-small text-fg-muted">
              {project.department} • {project.division} Division • {project.district} • {project.category}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusBadge descriptor={PROJECT_STATUS[project.status]} />
            <Badge tone="neutral" icon="schedule">
              {project.delayDays > 0 ? `${project.delayDays} ${t('common.days')} delay` : 'On schedule'}
            </Badge>
          </div>
        </div>
        <p className="mt-3 max-w-4xl text-body-small text-fg-muted">{project.summary}</p>
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div><p className="nk-label">Sanctioned</p><p className="tabular-nums text-label text-fg">{formatCr(project.sanctionedAmountCr)}</p></div>
          <div><p className="nk-label">Utilized</p><p className="tabular-nums text-label text-fg">{formatCr(project.utilizedAmountCr)}</p></div>
          <div><p className="nk-label">Work Order</p><p className="nk-mono-id text-fg">{project.workOrderNo ?? '—'}</p></div>
          <div><p className="nk-label">Expected Completion</p><p className="tabular-nums text-label text-fg">{formatDate(project.expectedCompletion)}</p></div>
        </div>
      </div>

      <Tabs items={PROJECT_DETAIL_TABS.map((k) => ({ id: k, ...tabMeta[k] }))} active={tab} onChange={(v) => setTab(v as ProjectDetailTab)} ariaLabel="Project sections" />

      {/* Overview */}
      <TabPanel id="overview" active={tab}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel title="Progress Snapshot" icon="speed">
            <DualProgress physical={project.physicalProgressPct} financial={project.financialProgressPct} />
            <dl className="mt-4 grid grid-cols-2 gap-3 text-body-small">
              <div><dt className="text-fg-subtle">Admin Approval</dt><dd className="text-fg">{formatDate(project.adminApprovalDate)}</dd></div>
              <div><dt className="text-fg-subtle">Technical Approval</dt><dd className="text-fg">{formatDate(project.technicalApprovalDate)}</dd></div>
              <div><dt className="text-fg-subtle">Inspections</dt><dd className="tabular-nums text-fg">{project.inspectionsCount}</dd></div>
              <div><dt className="text-fg-subtle">Open Complaints</dt><dd className="tabular-nums text-fg">{project.openComplaints}</dd></div>
            </dl>
          </Panel>
          <Panel title="Funding Sources" icon="pie_chart">
            <ul className="flex flex-col gap-3">
              {project.financials.fundingSources.map((f) => (
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
        </div>
      </TabPanel>

      {/* Timeline */}
      <TabPanel id="timeline" active={tab}>
        <Panel title={t('common.timeline')} icon="timeline">
          <ol className="relative ml-3 border-l-2 border-border">
            {project.milestones.map((m) => (
              <li key={m.id} className="mb-6 ml-4">
                <span className="absolute -left-[9px] mt-1.5 h-4 w-4 rounded-full border-2 border-surface bg-primary" aria-hidden="true" />
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-label text-fg">{m.title}</p>
                  <StatusBadge descriptor={MILESTONE_STATUS[m.status]} size="sm" />
                </div>
                <p className="mt-0.5 text-caption text-fg-subtle">
                  Planned {formatDate(m.plannedStart)} → {formatDate(m.plannedEnd)}
                  {m.actualEnd && ` • Actual end ${formatDate(m.actualEnd)}`}
                  {m.delayDays ? ` • +${m.delayDays} ${t('common.days')}` : ''}
                </p>
                {m.remarks && <p className="mt-1 text-caption text-fg-muted">{m.remarks}</p>}
              </li>
            ))}
          </ol>
        </Panel>
      </TabPanel>

      {/* Financials */}
      <TabPanel id="financials" active={tab}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel title="Financial Position" icon="account_balance_wallet">
            <dl className="grid grid-cols-2 gap-3 text-body-small">
              <div><dt className="text-fg-subtle">Sanctioned</dt><dd className="tabular-nums text-label text-fg">{formatCr(project.financials.sanctionedAmountCr)}</dd></div>
              <div><dt className="text-fg-subtle">Revised</dt><dd className="tabular-nums text-label text-fg">{project.financials.revisedAmountCr ? formatCr(project.financials.revisedAmountCr) : '—'}</dd></div>
              <div><dt className="text-fg-subtle">Utilized</dt><dd className="tabular-nums text-label text-fg">{formatCr(project.financials.amountUtilizedCr)}</dd></div>
              <div><dt className="text-fg-subtle">Committed</dt><dd className="tabular-nums text-label text-fg">{formatCr(project.financials.amountCommittedCr)}</dd></div>
              <div><dt className="text-fg-subtle">Last Tranche</dt><dd className="text-fg">{formatDate(project.financials.lastTrancheDate)}</dd></div>
              <div><dt className="text-fg-subtle">Next Due</dt><dd className="tabular-nums text-fg">{project.financials.nextTrancheDueCr ? formatCr(project.financials.nextTrancheDueCr) : '—'}</dd></div>
            </dl>
          </Panel>
          <Panel title="Utilization" icon="stacked_bar_chart">
            <Progress
              value={(project.financials.amountUtilizedCr / project.financials.sanctionedAmountCr) * 100}
              label="Financial utilization"
              tone="success"
            />
            <p className="mt-3 text-caption text-fg-subtle">{t('common.mockDataNote')}</p>
          </Panel>
        </div>
      </TabPanel>

      {/* Milestones */}
      <TabPanel id="milestones" active={tab}>
        <Panel title={t('common.milestones')} icon="fact_check" bodyClassName="p-0">
          <DataTable
            minWidth={900}
            rows={project.milestones}
            rowKey={(m) => m.id}
            columns={[
              { key: 'title', header: 'Milestone', isRowHeader: true, render: (m) => m.title },
              { key: 'status', header: t('common.status'), render: (m) => <StatusBadge descriptor={MILESTONE_STATUS[m.status]} size="sm" /> },
              { key: 'window', header: 'Planned Window', cellClassName: 'tabular-nums', render: (m) => `${formatDate(m.plannedStart)} → ${formatDate(m.plannedEnd)}` },
              { key: 'progress', header: t('common.progress'), render: (m) => <Progress value={m.physicalProgressPct} label={`Progress of ${m.title}`} size="sm" className="min-w-32" /> },
              { key: 'delay', header: 'Delay', cellClassName: 'tabular-nums', render: (m) => (m.delayDays ? `${m.delayDays} ${t('common.days')}` : '—') },
            ]}
          />
        </Panel>
      </TabPanel>

      {/* Work order */}
      <TabPanel id="workOrder" active={tab}>
        <Panel title={t('common.workOrder')} icon="construction">
          {workOrder ? (
            <dl className="grid grid-cols-1 gap-3 text-body-small sm:grid-cols-3">
              <div><dt className="text-fg-subtle">Order No.</dt><dd className="nk-mono-id text-fg">{workOrder.id}</dd></div>
              <div><dt className="text-fg-subtle">Contractor</dt><dd className="text-fg">{workOrder.contractor}</dd></div>
              <div><dt className="text-fg-subtle">Issued</dt><dd className="text-fg">{formatDate(workOrder.issuedOn)}</dd></div>
              <div><dt className="text-fg-subtle">Value</dt><dd className="tabular-nums text-fg">{formatCr(workOrder.valueCr)}</dd></div>
              <div><dt className="text-fg-subtle">Completion Period</dt><dd className="tabular-nums text-fg">{workOrder.completionPeriodDays} {t('common.days')}</dd></div>
              <div><dt className="text-fg-subtle">e-MB No.</dt><dd className="nk-mono-id text-fg">{workOrder.measurementBookNo}</dd></div>
              <div><dt className="text-fg-subtle">Defect Liability</dt><dd className="tabular-nums text-fg">{workOrder.defectLiabilityMonths} months</dd></div>
            </dl>
          ) : (
            <p className="text-body-small text-fg-muted">No work order issued yet (pre-execution stage).</p>
          )}
        </Panel>
      </TabPanel>

      {/* Contractor */}
      <TabPanel id="contractor" active={tab}>
        <Panel title={t('common.contractor')} icon="engineering">
          {project.contractor ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-label text-fg">{project.contractor}</p>
                <Link to="/contractors" className="text-caption text-primary-strong hover:underline">
                  Open contractor performance record →
                </Link>
              </div>
              <Badge tone="neutral" icon="shield">Registered — Class A/B registry (demo)</Badge>
            </div>
          ) : (
            <p className="text-body-small text-fg-muted">No contractor appointed yet.</p>
          )}
        </Panel>
      </TabPanel>

      {/* Inspections */}
      <TabPanel id="inspections" active={tab}>
        <Panel title={t('common.inspections')} icon="travel_explore" bodyClassName="p-0">
          <DataTable
            minWidth={900}
            rows={inspections}
            rowKey={(i) => i.id}
            columns={[
              { key: 'id', header: 'Ref', render: (i) => <span className="nk-mono-id text-fg-muted">{i.id}</span> },
              { key: 'date', header: 'Date', cellClassName: 'tabular-nums', render: (i) => formatDate(i.inspectedOn) },
              { key: 'type', header: 'Type', render: (i) => <Badge tone="neutral">{i.type}</Badge> },
              { key: 'inspector', header: 'Inspector', render: (i) => i.inspector },
              { key: 'outcome', header: 'Outcome', render: (i) => <StatusBadge descriptor={INSPECTION_OUTCOME[i.outcome]} size="sm" /> },
              { key: 'geo', header: 'Geo-Tag', cellClassName: 'tabular-nums', render: (i) => `${i.geoTag.lat.toFixed(3)}, ${i.geoTag.lng.toFixed(3)}` },
            ]}
            emptyState={<div className="p-8 text-center text-body-small text-fg-muted">No inspections recorded.</div>}
          />
        </Panel>
      </TabPanel>

      {/* Documents */}
      <TabPanel id="documents" active={tab}>
        <Panel title={t('common.documents')} icon="folder_shared" bodyClassName="p-0">
          <DataTable
            minWidth={900}
            rows={documents}
            rowKey={(d) => d.id}
            columns={[
              { key: 'name', header: 'Document', isRowHeader: true, render: (d) => <span className="block max-w-96 truncate" title={d.name}>{d.name}</span> },
              { key: 'category', header: 'Category', render: (d) => <Badge tone="neutral">{d.category}</Badge> },
              { key: 'access', header: 'Access', render: (d) => <StatusBadge descriptor={ACCESS_LEVEL[d.accessLevel]} size="sm" /> },
              { key: 'uploaded', header: 'Uploaded', cellClassName: 'tabular-nums', render: (d) => formatDate(d.uploadedOn) },
              { key: 'size', header: 'Size', cellClassName: 'tabular-nums', render: (d) => formatFileSizeKb(d.fileSizeKb) },
            ]}
            emptyState={<div className="p-8 text-center text-body-small text-fg-muted">No documents on record.</div>}
          />
        </Panel>
      </TabPanel>

      {/* Grievances */}
      <TabPanel id="grievances" active={tab}>
        <Panel title={t('common.grievances')} icon="report_problem" bodyClassName="p-0">
          <DataTable
            minWidth={900}
            rows={grievances}
            rowKey={(g) => g.id}
            columns={[
              { key: 'id', header: 'Ref', render: (g) => <span className="nk-mono-id text-fg-muted">{g.id}</span> },
              { key: 'subject', header: 'Subject', isRowHeader: true, render: (g) => g.subject },
              { key: 'status', header: t('common.status'), render: (g) => <StatusBadge descriptor={GRIEVANCE_STATUS[g.status]} size="sm" /> },
              { key: 'sla', header: 'SLA', render: (g) => <span className="tabular-nums text-caption">{formatSlaCountdown(g.slaDeadline)}</span> },
            ]}
            emptyState={<div className="p-8 text-center text-body-small text-fg-muted">No grievances for this project.</div>}
          />
        </Panel>
      </TabPanel>

      {/* Approvals */}
      <TabPanel id="approvals" active={tab}>
        <Panel title={t('common.approvals')} icon="rule" bodyClassName="p-0">
          <ul className="divide-y divide-border">
            {approvals.map((a) => (
              <li key={a.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-label text-fg">{a.type}</p>
                  <StatusBadge descriptor={a.status === 'approved' ? { key: 'status.approved', tone: 'success', icon: 'check_circle' } : a.status === 'pending' ? { key: 'status.pending', tone: 'warning', icon: 'hourglass_top' } : { key: 'status.inReview', tone: 'info', icon: 'plagiarism' }} size="sm" />
                </div>
                <ol className="mt-2 flex flex-col gap-1 border-l-2 border-border pl-3">
                  {a.auditTrail.map((at, i) => (
                    <li key={i} className="text-caption text-fg-muted">
                      <span className="tabular-nums">{formatDate(at.timestamp)}</span> — <span className="font-medium text-fg">{at.actor}</span> ({at.role}): {at.action}. {at.remarks}
                    </li>
                  ))}
                </ol>
              </li>
            ))}
            {approvals.length === 0 && <li className="p-8 text-center text-body-small text-fg-muted">No approvals touch this project.</li>}
          </ul>
        </Panel>
      </TabPanel>

      {/* Litigation */}
      <TabPanel id="litigation" active={tab}>
        <Panel title={t('common.litigation')} icon="policy" bodyClassName="p-0">
          <DataTable
            minWidth={900}
            rows={litigation}
            rowKey={(l) => l.id}
            columns={[
              { key: 'title', header: 'Case', isRowHeader: true, render: (l) => l.title },
              { key: 'court', header: 'Court', render: (l) => l.court },
              { key: 'status', header: t('common.status'), render: (l) => <StatusBadge descriptor={LITIGATION_STATUS[l.status]} size="sm" /> },
              { key: 'hearing', header: 'Next Hearing', cellClassName: 'tabular-nums', render: (l) => formatDate(l.nextHearing) },
              { key: 'claim', header: 'Claim', cellClassName: 'tabular-nums', render: (l) => (l.claimAmountCr ? formatCr(l.claimAmountCr) : '—') },
            ]}
            emptyState={<div className="p-8 text-center text-body-small text-fg-muted">No litigation linked to this project.</div>}
          />
        </Panel>
      </TabPanel>

      {/* AI insights */}
      <TabPanel id="aiInsights" active={tab}>
        <div className="flex flex-col gap-4">
          {insights.map((i) => (
            <Card key={i.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge descriptor={AI_CLASSIFICATION[i.classification]} size="sm" />
                <StatusBadge descriptor={AI_CONFIDENCE[i.confidenceBand]} size="sm" />
                <span className="text-caption tabular-nums text-fg-subtle">{i.confidencePct}% • {formatDate(i.generatedOn)}</span>
              </div>
              <h3 className="mt-2 text-heading-3 text-fg">{i.title}</h3>
              <p className="mt-1 text-body-small text-fg-muted">{i.insight}</p>
              <p className="mt-2 rounded-control bg-surface-2 p-2 text-caption text-fg-muted"><strong className="text-fg">Supporting data:</strong> {i.supportingData}</p>
              <p className="mt-2 text-caption text-fg"><strong>Recommended action:</strong> {i.recommendedAction}</p>
              <p className="mt-3 border-t border-border pt-2 text-caption text-warning-strong">
                <span className="material-symbols-outlined mr-1 align-middle text-[16px]" aria-hidden="true">smart_toy</span>
                {t('common.aiDisclaimerInsight')}
              </p>
            </Card>
          ))}
          {insights.length === 0 && (
            <Card className="p-8 text-center text-body-small text-fg-muted">No AI insights generated for this project.</Card>
          )}
        </div>
      </TabPanel>

      {/* Audit trail */}
      <TabPanel id="auditTrail" active={tab}>
        <Panel title={t('common.auditTrail')} icon="content_paste_search" bodyClassName="p-0">
          <DataTable
            minWidth={900}
            rows={findings}
            rowKey={(f) => f.id}
            columns={[
              { key: 'id', header: 'Ref', render: (f) => <span className="nk-mono-id text-fg-muted">{f.id}</span> },
              { key: 'title', header: 'Audit', isRowHeader: true, render: (f) => f.auditTitle },
              { key: 'severity', header: 'Severity', render: (f) => <StatusBadge descriptor={AUDIT_SEVERITY[f.severity]} size="sm" /> },
              { key: 'status', header: 'Status', render: (f) => <Badge tone="neutral">{f.status.replace('_', ' ')}</Badge> },
              { key: 'due', header: 'Due', cellClassName: 'tabular-nums', render: (f) => formatDate(f.dueDate) },
            ]}
            emptyState={<div className="p-8 text-center text-body-small text-fg-muted">No audit findings against this project.</div>}
          />
          <p className="border-t border-border p-3 text-caption text-fg-subtle">
            Public view of this record: {citizen ? 'published on the Citizen Transparency Portal' : 'internal only'}.
          </p>
        </Panel>
      </TabPanel>
    </div>
  )
}
