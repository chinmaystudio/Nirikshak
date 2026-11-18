import { useState } from 'react';
import { BarChart3, TrendingUp, IndianRupee, Users } from 'lucide-react';
import { Card, SectionTitle, Pills } from '../../components/ui';
import { GroupedBars, HBars } from '../../components/charts';
import type { Project } from '../../lib/types';
import { useStore } from '../../lib/store';
import { fmtDate, money } from '../../lib/utils';

// ─── Analytics ───────────────────────────────────────────────────────────────
// Only real, recorded data is charted. The previous version fabricated an
// Apr–Sep monthly history from project.planned/progress with ad-hoc
// multipliers, plus invented payment and utilisation series. There is no
// monthly time-series table for a single project, so this page shows the
// current recorded snapshot, the real milestone register, the department's
// real financial_updates rows, and the project-record worker/resource
// registers (project_workers / project_resources).

const VIEWS = ['Progress', 'Financial', 'Resource'];

export default function Analytics({ project }: { project: Project }) {
  const [view, setView] = useState('Progress');
  const { financialUpdates, workers, resources } = useStore();

  const fin = financialUpdates.filter((f) => f.projectId === project.id);
  const workerList = workers[project.id] ?? [];
  const resourceList = resources[project.id] ?? [];
  const variance = project.progress - project.planned;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-blue-900 dark:text-blue-300">
          <BarChart3 className="w-5 h-5" />
          <h3 className="font-bold text-[15px]">Project Analytics — {project.name}</h3>
        </div>
        <Pills options={VIEWS} value={view} onChange={setView} />
      </div>

      {view === 'Progress' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-5">
            <SectionTitle icon={TrendingUp} title="Progress vs Schedule Elapsed (current snapshot)" />
            <GroupedBars
              labels={['Current']}
              series={[
                { name: 'Schedule elapsed %', color: 'bg-slate-300', values: [project.planned] },
                { name: 'Physical progress %', color: 'bg-blue-700', values: [project.progress] },
              ]}
            />
            <p className="text-[11px] text-slate-500 mt-3 font-medium dark:text-slate-400">
              Variance {variance > 0 ? '+' : ''}{variance}%. “Schedule elapsed” is the share of the planned duration
              (start → deadline) already gone — a calendar figure. No monthly history is charted because no
              time-series of past progress is recorded for this project.
            </p>
          </Card>

          <Card className="p-5">
            <SectionTitle icon={TrendingUp} title="Milestone Completion (project record)" />
            {project.milestones.length === 0 ? (
              <p className="text-sm text-slate-500 font-medium py-6 text-center dark:text-slate-400">No milestones are recorded for this project.</p>
            ) : (
              <HBars
                items={project.milestones.map((m) => ({
                  label: m.name,
                  value: m.state === 'done' ? 100 : m.progress ?? 0,
                  color: m.state === 'done' ? 'bg-green-600' : m.state === 'current' ? 'bg-blue-700' : 'bg-slate-300',
                }))}
              />
            )}
          </Card>

          <Card className="overflow-hidden lg:col-span-2">
            <div className="p-5 pb-3">
              <SectionTitle title="Milestone Register" className="mb-0" />
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr><th>Milestone</th><th>Planned / Revised Date</th><th>State</th><th>Verified Progress</th></tr>
                </thead>
                <tbody>
                  {project.milestones.map((m) => (
                    <tr key={m.name}>
                      <td className="font-bold text-slate-800 dark:text-slate-100">{m.name}</td>
                      <td className="text-xs font-semibold">{m.date ? fmtDate(m.date) : '—'}</td>
                      <td className="text-xs font-semibold">{m.state === 'done' ? 'Completed' : m.state === 'current' ? 'In progress' : 'Pending'}</td>
                      <td className="text-xs font-bold tabular-nums">{m.progress != null ? `${m.progress}%` : '—'}</td>
                    </tr>
                  ))}
                  {project.milestones.length === 0 && (
                    <tr><td colSpan={4} className="text-center py-8 text-sm text-slate-500">No milestones on record.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {view === 'Financial' && (
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="p-5 pb-3">
              <SectionTitle icon={IndianRupee} title="Department Financial Updates (financial_updates)" className="mb-0" />
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr><th>Date</th><th>Reported Cost</th><th>Amount Spent</th><th>Budget Allocation</th><th>Revised Cost</th><th>Cost Overrun</th><th>Notes</th></tr>
                </thead>
                <tbody>
                  {fin.map((f) => (
                    <tr key={f.id}>
                      <td className="text-xs font-semibold whitespace-nowrap">{fmtDate(f.date)}</td>
                      <td className="text-xs tabular-nums font-semibold">{f.reportedCostCr != null ? `₹ ${f.reportedCostCr.toFixed(2)} Cr` : '—'}</td>
                      <td className="text-xs tabular-nums font-semibold">{f.amountSpentCr != null ? `₹ ${f.amountSpentCr.toFixed(2)} Cr` : '—'}</td>
                      <td className="text-xs tabular-nums font-semibold">{f.budgetAllocationCr != null ? `₹ ${f.budgetAllocationCr.toFixed(2)} Cr` : '—'}</td>
                      <td className="text-xs tabular-nums font-semibold">{f.revisedCostCr != null ? `₹ ${f.revisedCostCr.toFixed(2)} Cr` : '—'}</td>
                      <td className="text-xs tabular-nums font-semibold">{f.costOverrunCr != null ? `₹ ${f.costOverrunCr.toFixed(2)} Cr` : '—'}</td>
                      <td className="text-xs max-w-[240px]">{f.notes || '—'}</td>
                    </tr>
                  ))}
                  {fin.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-8 text-sm text-slate-500">The department has not recorded any financial update for this project yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="p-4 text-[11px] text-slate-500 dark:text-slate-400">
              Contract value {money(project.value * 1e7)} • Amount spent on the latest record {fin[0]?.amountSpentCr != null ? `₹ ${fin[0].amountSpentCr.toFixed(2)} Cr` : '—'}.
              This portal has no payment-receipt feed, so no “received” series is shown.
            </p>
          </Card>
        </div>
      )}

      {view === 'Resource' && (
        <div className="space-y-6">
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
            Project record — workers and resources below are the figures saved on this project's database record (project_workers / project_resources).
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-5">
              <SectionTitle icon={Users} title="Workers by Category" />
              {workerList.length === 0 ? (
                <p className="text-sm text-slate-500 font-medium py-6 text-center dark:text-slate-400">No workers registered for this project.</p>
              ) : (
                <HBars
                  items={['Skilled', 'Unskilled', 'Supervisor'].map((c) => ({
                    label: c,
                    value: workerList.filter((w) => w.category === c).length,
                    color: 'bg-blue-700',
                  }))}
                />
              )}
              <p className="text-[11px] text-slate-500 mt-4 font-medium dark:text-slate-400">{workerList.length} worker{workerList.length === 1 ? '' : 's'} on the project record, {workerList.filter((w) => w.status === 'Active').length} marked active.</p>
            </Card>

            <Card className="p-5">
              <SectionTitle icon={Users} title="Resources by Category" />
              {resourceList.length === 0 ? (
                <p className="text-sm text-slate-500 font-medium py-6 text-center dark:text-slate-400">No resources registered for this project.</p>
              ) : (
                <HBars
                  items={['Machinery', 'Equipment', 'Vehicles', 'Materials'].map((c) => ({
                    label: c,
                    value: resourceList.filter((r) => r.category === c).reduce((s, r) => s + r.qty, 0),
                    color: 'bg-green-600',
                  }))}
                />
              )}
              <p className="text-[11px] text-slate-500 mt-4 font-medium dark:text-slate-400">{resourceList.length} resource row{resourceList.length === 1 ? '' : 's'} on the project record.</p>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
