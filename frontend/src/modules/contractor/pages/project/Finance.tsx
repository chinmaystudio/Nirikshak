import { useMemo, useState } from 'react';
import { Wallet, Eye, IndianRupee, Landmark, Banknote, FileSignature } from 'lucide-react';
import { Card, SectionTitle, KPISection, StatusBadge, Modal } from '../../components/ui';
import { Link } from '../../lib/router';
import type { KPIItem } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import { StepFlow } from '../../components/charts';
import { useStore } from '../../lib/store';
import type { Project, Invoice } from '../../lib/types';
import { fmtDate, money } from '../../lib/utils';

export default function Finance({ project }: { project: Project }) {
  const { invoices, financialUpdates } = useStore();
  const [view, setView] = useState<Invoice | null>(null);
  const projectFinUpdates = useMemo(() => financialUpdates.filter((f) => f.projectId === project.id), [financialUpdates, project.id]);
  const latestFin = projectFinUpdates[0];

  const projectBills = useMemo(() => invoices.filter((i) => i.projectId === project.id), [invoices, project.id]);
  const paid = projectBills.filter((i) => i.status === 'Paid').reduce((s, i) => s + i.amount, 0);
  const pending = projectBills.filter((i) => ['Submitted', 'Under Verification', 'Approved'].includes(i.status)).reduce((s, i) => s + i.amount, 0);
  const rejected = projectBills.filter((i) => i.status === 'Rejected').reduce((s, i) => s + i.amount, 0);
  const remaining = project.value - project.spent;

  const currentStage = pending > 2e7 ? 'Government Verification' : pending > 0 ? 'Bill Approved' : 'Payment Released';

  const kpis: KPIItem[] = [
    { label: 'Contract Value', value: `₹ ${project.value.toFixed(2)} Cr`, icon: Landmark },
    { label: 'Approved Budget', value: `₹ ${project.budgetApproved.toFixed(2)} Cr`, icon: IndianRupee },
    { label: 'Latest Dept. Finance Record', value: latestFin ? fmtDate(latestFin.date) : '—', sub: latestFin ? 'financial_updates' : 'none recorded yet', icon: Banknote, iconClass: 'text-green-600' },
    { label: 'Amount Pending', value: money(pending), sub: `${projectBills.filter((i) => ['Submitted', 'Under Verification', 'Approved'].includes(i.status)).length} bills`, icon: Banknote, iconClass: 'text-amber-500' },
    { label: 'Amount Spent', value: `₹ ${project.spent.toFixed(2)} Cr`, sub: `${Math.round((project.spent / project.value) * 100)}% of contract`, icon: Wallet, iconClass: 'text-blue-600' },
    { label: 'Remaining Amount', value: `₹ ${remaining.toFixed(2)} Cr`, icon: Wallet },
  ];

  const workflowSteps = [
    { label: 'Work Completed', state: 'done' as const, note: `${project.progress}% progress certified` },
    { label: 'Bill Submitted', state: 'done' as const, note: projectBills[0] ? `Latest: ${projectBills[0].no}` : '—' },
    { label: 'Government Verification', state: pending > 0 && currentStage === 'Government Verification' ? ('current' as const) : ('done' as const), note: `${money(pending)} in process` },
    { label: 'Bill Approved', state: currentStage === 'Bill Approved' ? ('current' as const) : projectBills.some((i) => i.status === 'Approved' || i.status === 'Paid') ? ('done' as const) : ('pending' as const) },
    { label: 'Payment Released', state: paid > 0 ? ('done' as const) : ('pending' as const), note: paid > 0 ? `${money(paid)} received` : undefined },
  ];

  return (
    <div className="space-y-6">
      <KPISection items={kpis} />

      <Card className="p-5">
        <SectionTitle icon={FileSignature} title="Payment Workflow" right={<Link to={`/projects/${project.id}/bills`} className="link text-sm">Manage bills</Link>} />
        <StepFlow steps={workflowSteps} />
        <p className="text-[11px] text-slate-500 mt-4 font-medium dark:text-slate-400">
          Monthly RA bills follow the department's verification SLA (21 days from DyE check). Follow up in writing when a bill crosses the SLA.
        </p>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-5 lg:col-span-2">
          <SectionTitle icon={Banknote} title={`Your Bills — ${project.name}`} />
          <p className="text-[11px] text-slate-500 font-medium mb-3 dark:text-slate-400">Your contractor invoices on the project record (contractor_invoices) — submitted bills are verified and paid by the department on this same record. Department-recorded finance is in the panel on the right.</p>
          <DataTable
            
            columns={[
              { key: 'no', label: 'Bill No.', sortVal: (i: Invoice) => i.no, render: (i: Invoice) => <span className="text-xs font-bold font-mono">{i.no}</span> },
              { key: 'milestone', label: 'Milestone', render: (i: Invoice) => <span className="text-xs font-semibold">{i.milestone}</span> },
              { key: 'amount', label: 'Amount', sortVal: (i: Invoice) => i.amount, render: (i: Invoice) => <span className="text-xs font-bold tabular-nums">{money(i.amount)}</span> },
              { key: 'date', label: 'Invoice Date', sortVal: (i: Invoice) => i.date, render: (i: Invoice) => <span className="text-xs">{fmtDate(i.date)}</span> },
              { key: 'status', label: 'Status', sortVal: (i: Invoice) => i.status, render: (i: Invoice) => <StatusBadge status={i.status} /> },
              { key: 'updated', label: 'Last Updated', sortVal: (i: Invoice) => i.updatedAt, render: (i: Invoice) => <span className="text-xs">{i.updatedAt ? fmtDate(i.updatedAt) : '—'}</span> },
              {
                key: 'action',
                label: 'Action',
                render: (i: Invoice) => (
                  <div className="flex gap-1.5">
                    <button className="btn btn-ghost btn-sm" onClick={() => setView(i)} aria-label={`View ${i.no}`}>
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    {/* No receipt download: this portal has no payment-receipt
                        source, and generating a plausible-looking receipt
                        document locally would fabricate an official record. */}
                  </div>
                ),
              },
            ]}
            rows={projectBills}
            empty={<p className="text-sm text-slate-500 py-10 text-center font-medium">No bills recorded for this project yet.</p>}
          />
        </Card>

        <Card className="p-5">
          <SectionTitle icon={Wallet} title="Department Financial Updates" />
          <p className="text-[11px] text-slate-500 font-medium mb-3 dark:text-slate-400">
            Recorded by the department in financial_updates — the authoritative finance figures for this project.
            Remaining budget on the latest record: ₹ {remaining.toFixed(2)} Cr.
          </p>
          {projectFinUpdates.length === 0 ? (
            <p className="text-sm text-slate-500 font-medium py-6 text-center dark:text-slate-400">No financial updates recorded for this project yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr><th>Date</th><th>Spent</th><th>Allocation</th><th>Overrun</th><th>Notes</th></tr>
                </thead>
                <tbody>
                  {projectFinUpdates.map((f) => (
                    <tr key={f.id}>
                      <td className="text-xs font-semibold whitespace-nowrap">{fmtDate(f.date)}</td>
                      <td className="text-xs font-bold tabular-nums">{f.amountSpentCr != null ? `₹ ${f.amountSpentCr.toFixed(2)} Cr` : '—'}</td>
                      <td className="text-xs tabular-nums">{f.budgetAllocationCr != null ? `₹ ${f.budgetAllocationCr.toFixed(2)} Cr` : '—'}</td>
                      <td className="text-xs tabular-nums">{f.costOverrunCr != null ? `₹ ${f.costOverrunCr.toFixed(2)} Cr` : '—'}</td>
                      <td className="text-xs max-w-[220px]">{f.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Bill detail modal */}
      <Modal open={view !== null} onClose={() => setView(null)} title={view ? `Bill ${view.no}` : ''}>
        {view && (
          <div className="space-y-4">
            <dl className="space-y-2.5">
              <DRow k="Project" v={project.name} />
              <DRow k="Milestone" v={view.milestone || '—'} />
              <DRow k="Amount" v={money(view.amount)} />
              <DRow k="Invoice Date" v={fmtDate(view.date)} />
              <DRow k="Status" v="" badge={<StatusBadge status={view.status} />} />
              <DRow k="Last Updated" v={view.updatedAt ? fmtDate(view.updatedAt) : '—'} />
              {view.note && <DRow k="Note" v={view.note} />}
            </dl>
            <div className="rounded-lg border border-slate-200 p-3.5 dark:border-slate-700">
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2">Status Trail</p>
              <ol className="text-xs text-slate-600 space-y-1.5 dark:text-slate-400">
                <li>1. Raised by contractor — invoice dated {fmtDate(view.date)}</li>
                <li>2. Submitted to the department {view.status === 'Draft' ? '— not yet submitted' : '— recorded'}</li>
                <li>3. Department verification {['Under Verification', 'Approved', 'Rejected', 'Paid'].includes(view.status) ? '— recorded' : '— pending'}</li>
                <li>4. Payment released {view.status === 'Paid' ? '— recorded' : '— pending'}</li>
              </ol>
              <p className="text-[11px] text-slate-400 mt-2">The record stores the current status and its last-update time, not a dated history of each step — the trail above reflects the current status only.</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function DRow({ k, v, badge }: { k: string; v: string; badge?: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-6">
      <dt className="dl-label">{k}</dt>
      <dd className="dl-value text-right">{badge ?? v}</dd>
    </div>
  );
}