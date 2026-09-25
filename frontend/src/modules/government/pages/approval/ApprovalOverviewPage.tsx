import { Link } from 'react-router-dom'
import { useI18n } from '@/context/I18nContext'
import { useApprovalWorkspace } from '@/context/ApprovalWorkspaceContext'
import { Panel, Card } from '@/components/ui/Card'
import { formatCr, formatDate, formatSlaCountdown } from '@/utils/format'

/** Approval workspace — Overview. Every figure is scoped to the open request. */
export function ApprovalOverviewPage() {
  const { t } = useI18n()
  const { approvalId, approval } = useApprovalWorkspace()
  if (!approval) return null

  const modules = [
    { labelKey: 'nav.workflow', icon: 'account_tree', to: `/government/approvals/${approvalId}/workflow`, value: `${approval.auditTrail.length}`, note: 'recorded actions' },
    { labelKey: 'nav.approvalHistory', icon: 'history', to: `/government/approvals/${approvalId}/history`, value: approval.status.replace('_', ' '), note: 'current status' },
    { labelKey: 'nav.linkedProject', icon: 'map', to: `/government/approvals/${approvalId}/project`, value: approval.projectId, note: approval.projectName },
  ]

  return (
    <div className="flex flex-col gap-4">
      <section id="overview" className="scroll-mt-24">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {modules.map((m) => (
            <Link
              key={m.labelKey}
              to={m.to}
              className="nk-card flex flex-col gap-1 p-3 transition-colors duration-fast hover:border-primary-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              <span className="flex items-center gap-2 text-caption text-fg-muted">
                <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">{m.icon}</span>
                {t(m.labelKey)}
              </span>
              <span className="nk-mono-id text-heading-2 text-fg">{m.value}</span>
              <span className="text-caption text-fg-subtle">{m.note}</span>
            </Link>
          ))}
        </div>
      </section>

      <Panel title="Request Facts" icon="approval">
        <dl className="grid grid-cols-2 gap-3 text-body-small md:grid-cols-3">
          <div><dt className="text-fg-subtle">Approval type</dt><dd className="text-fg">{approval.type}</dd></div>
          <div><dt className="text-fg-subtle">Category</dt><dd className="text-fg">{approval.type.split(' ')[0]}</dd></div>
          <div><dt className="text-fg-subtle">SLA</dt><dd className="tabular-nums text-fg">{formatSlaCountdown(approval.slaDueDate)}</dd></div>
          <div><dt className="text-fg-subtle">Submitted by</dt><dd className="text-fg">{approval.submittedBy}</dd></div>
          <div><dt className="text-fg-subtle">Submitted on</dt><dd className="tabular-nums text-fg">{formatDate(approval.submittedOn)}</dd></div>
          <div><dt className="text-fg-subtle">Financial implication</dt><dd className="tabular-nums text-fg">{approval.amountCr != null ? formatCr(approval.amountCr) : '—'}</dd></div>
          <div><dt className="text-fg-subtle">Assigned officer</dt><dd className="text-fg">{approval.assignedTo}</dd></div>
          <div><dt className="text-fg-subtle">SLA due date</dt><dd className="tabular-nums text-fg">{formatDate(approval.slaDueDate)}</dd></div>
          <div><dt className="text-fg-subtle">Linked project</dt><dd className="nk-mono-id text-fg">{approval.projectId}</dd></div>
        </dl>
      </Panel>

      <Card className="p-3 text-caption text-fg-subtle">{t('common.mockDataNote')}</Card>
    </div>
  )
}
