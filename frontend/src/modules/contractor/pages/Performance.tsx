import { Gauge, History } from 'lucide-react';
import { PageHeader, Card, SectionTitle, StatusBadge } from '../components/ui';
import { HBars } from '../components/charts';
import { useStore } from '../lib/store';
import { projectHealth } from '../lib/health';
import { cr, fmtDate } from '../lib/utils';
import { useAuth } from '@/core/auth/useAuth';

// ─── Performance ─────────────────────────────────────────────────────────────
// There is no contractor-evaluation table in the database and the department
// does not publish scores/grades/feedback to this portal, so no performance
// score is shown — inventing one (the previous page shipped a full fake
// scorecard) would violate the zero-fabrication rule. What IS shown: the
// contractor's real portfolio figures, computed from assigned projects.

export default function Performance() {
  const { projects } = useStore();
  const { session } = useAuth();

  const completed = projects.filter((p) => p.status === 'Completed');
  const active = projects.filter((p) => p.status !== 'Completed');
  const totalValue = projects.reduce((s, p) => s + p.value, 0);
  const avgProgress = projects.length > 0 ? Math.round(projects.reduce((s, p) => s + p.progress, 0) / projects.length) : 0;
  const behind = active.filter((p) => p.progress < p.planned).length;

  return (
    <div className="p-4 lg:p-6 lg:py-8 max-w-[1600px] mx-auto space-y-6">
      <PageHeader title="My Performance" subtitle={session?.organization?.name || 'Organization not available'} />

      <Card className="p-6">
        <SectionTitle icon={Gauge} title="Department Evaluation" />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No verified performance evaluation has been published for your organization. When the department records an
          evaluation (score, grade or rating) against your contracts, it will appear here — this portal does not
          generate its own score.
        </p>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Assigned contracts', value: String(projects.length) },
          { label: 'Completed', value: String(completed.length) },
          { label: 'In execution', value: String(active.length) },
          { label: 'Behind schedule', value: String(behind) },
          { label: 'Total contract value', value: cr(totalValue) },
          { label: 'Average progress', value: `${avgProgress}%` },
          { label: 'Amount spent (dept. records)', value: cr(projects.reduce((s, p) => s + p.spent, 0)) },
          { label: 'Open complaints', value: String(projects.reduce((s, p) => s + p.openComplaints, 0)) },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{s.label}</p>
            <p className="font-display font-bold text-xl text-slate-800 mt-1 dark:text-slate-100">{s.value}</p>
          </div>
        ))}
      </div>

      {projects.length > 0 && (
        <Card className="p-5">
          <SectionTitle icon={Gauge} title="Computed Health by Project" />
          <p className="text-[11px] text-slate-500 font-medium mb-3 dark:text-slate-400">
            100 − schedule shortfall (max 60) − open-complaints load (max 20) − overdue penalty (20). A transparent calculation, not a department rating.
          </p>
          <HBars
            items={projects.map((p) => {
              const score = projectHealth(p).score;
              return { label: p.name, value: score, num: score, color: score >= 75 ? 'bg-green-600' : score >= 50 ? 'bg-amber-500' : 'bg-red-600' };
            })}
            showNum
            labelWidth="w-48 sm:w-64"
          />
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="p-5 pb-4 flex items-center gap-2 text-blue-900 dark:text-blue-300">
          <History className="w-5 h-5" />
          <h3 className="font-bold text-[15px]">Contract History (your assigned projects)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Department</th>
                <th>Value</th>
                <th>Progress</th>
                <th>Deadline</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id}>
                  <td className="font-bold text-slate-800 dark:text-slate-100">{p.name}</td>
                  <td className="text-xs font-semibold">{p.department || '—'}</td>
                  <td className="text-xs tabular-nums font-semibold">{cr(p.value)}</td>
                  <td className="text-xs font-bold tabular-nums">{p.progress}%</td>
                  <td className="text-xs">{fmtDate(p.deadline)}</td>
                  <td><StatusBadge status={p.status} /></td>
                </tr>
              ))}
              {projects.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-sm text-slate-500">No assigned projects on record.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
