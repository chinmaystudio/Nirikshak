import { Activity, CheckCircle2, CircleAlert, XCircle } from 'lucide-react';
import { Card, SectionTitle, StatusBadge } from '../../components/ui';
import { Link } from '../../lib/router';
import { ProgressRing, HBars } from '../../components/charts';
import type { Project } from '../../lib/types';
import { projectHealth } from '../../lib/health';
import { fmtDate } from '../../lib/utils';

// ─── Project Health (computed) ───────────────────────────────────────────────
// NOT an AI analysis. The score is computed by projectHealth() from three
// real inputs — physical progress, schedule elapsed and the count of open
// complaints assigned to the contractor — and the formula is printed on this
// page. (The previous version rendered the same numbers behind a fake
// "AI analyzing…" spinner, with health.score simply equal to progress %.)

export default function ProjectHealthPage({ project }: { project: Project }) {
  const health = projectHealth(project);
  const overallColor = health.overall === 'GOOD' ? 'var(--ch-green)' : health.overall === 'FAIR' ? 'var(--ch-amber)' : 'var(--ch-red)';
  const variance = project.progress - project.planned;

  const signals = [
    {
      area: 'Schedule',
      level: variance < -10 ? 'High' : variance < 0 ? 'Medium' : 'Low',
      explanation: `Physical progress is ${project.progress}% while ${project.planned}% of the planned duration (start ${fmtDate(project.start)} → deadline ${fmtDate(project.deadline)}) has elapsed — a variance of ${variance > 0 ? '+' : ''}${variance}%.`,
      action: variance < 0 ? 'Recover the shortfall against the remaining milestones, or formally seek an extension before the deadline.' : 'Maintain the current pace and keep progress reporting current.',
    },
    {
      area: 'Citizen complaints',
      level: project.openComplaints >= 3 ? 'High' : project.openComplaints > 0 ? 'Medium' : 'Low',
      explanation: project.openComplaints > 0
        ? `${project.openComplaints} complaint${project.openComplaints === 1 ? '' : 's'} assigned to your organization on this project are still open.`
        : 'No open complaints are assigned to your organization on this project.',
      action: project.openComplaints > 0 ? 'Resolve or respond to the open complaints through the department channel.' : 'No action required.',
    },
    {
      area: 'Deadline',
      level: health.overdue ? 'High' : 'Low',
      explanation: health.overdue
        ? `The contract deadline (${fmtDate(project.deadline)}) has passed and the project is not marked completed.`
        : `Contract deadline is ${fmtDate(project.deadline)}.`,
      action: health.overdue ? 'Agree a revised completion date with the department and record it on the project.' : 'No action required.',
    },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-blue-900 dark:text-blue-300">
        <Activity className="w-5 h-5" />
        <h3 className="font-bold text-[15px]">Project Health (computed) — {project.name}</h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 flex flex-col items-center justify-center text-center">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-3">Computed Health</p>
          <ProgressRing value={health.score} size={140} color={overallColor} label={health.overall} sub={`${health.score}/100`} />
          <p className="text-xs text-slate-500 mt-4 font-medium dark:text-slate-400">
            100 − schedule shortfall ({health.scheduleShortfall}) − open-complaints load ({health.complaintsPenalty}) − overdue penalty ({health.overduePenalty}).
          </p>
        </Card>
        <Card className="p-5 lg:col-span-2">
          <SectionTitle icon={Activity} title="Inputs (real project data)" />
          <HBars
            items={[
              { label: 'Physical progress %', value: project.progress, color: 'bg-blue-700' },
              { label: 'Schedule elapsed %', value: project.planned, color: 'bg-slate-400' },
              { label: 'Health score', value: health.score, color: health.score >= 75 ? 'bg-green-600' : health.score >= 50 ? 'bg-amber-500' : 'bg-red-600' },
            ]}
          />
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 text-center">
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Progress</p>
              <p className="font-display font-bold text-lg text-slate-800 dark:text-slate-100">{project.progress}%</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Schedule elapsed</p>
              <p className="font-display font-bold text-lg text-slate-800 dark:text-slate-100">{project.planned}%</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Open complaints</p>
              <p className="font-display font-bold text-lg text-slate-800 dark:text-slate-100">{project.openComplaints}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Deadline</p>
              <p className="font-display font-bold text-lg text-slate-800 dark:text-slate-100">{fmtDate(project.deadline)}</p>
            </div>
          </dl>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {signals.map((r) => (
          <Card key={r.area} className="p-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                {r.level === 'High' ? (
                  <XCircle className="w-5 h-5 text-red-600" />
                ) : r.level === 'Medium' ? (
                  <CircleAlert className="w-5 h-5 text-amber-500" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                )}
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">{r.area}</h4>
              </div>
              <StatusBadge status={r.level} />
            </div>
            <p className="text-sm text-slate-700 leading-relaxed dark:text-slate-300">{r.explanation}</p>
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-900 dark:bg-blue-950/30">
              <p className="text-[10px] uppercase tracking-wider font-bold text-blue-800 mb-1 dark:text-blue-300">Suggested Action</p>
              <p className="text-xs font-semibold text-slate-700 leading-relaxed dark:text-slate-300">{r.action}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap justify-center gap-2.5">
        <Link to={`/projects/${project.id}/ai-completion`} className="btn btn-secondary btn-sm">Schedule Outlook</Link>
        <Link to={`/projects/${project.id}/ai-guide`} className="btn btn-secondary btn-sm">Project Guide</Link>
      </div>

      <p className="text-[11px] text-slate-400 text-center">
        Computed from the project register (progress, contract dates) and complaints assigned to your organization. This is a transparent calculation, not an AI prediction.
      </p>
    </div>
  );
}
