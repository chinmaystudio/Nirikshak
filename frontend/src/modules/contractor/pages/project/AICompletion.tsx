import { CalendarClock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Card, SectionTitle, ProgressBar } from '../../components/ui';
import { Link } from '../../lib/router';
import type { Project } from '../../lib/types';
import { cls, fmtDate, daysUntil } from '../../lib/utils';

// ─── Schedule Outlook (computed) ─────────────────────────────────────────────
// No completion date is predicted here — the previous "AI forecast" invented
// one (with a fabricated confidence %). This page shows only arithmetic on
// real fields: contract dates, physical progress, schedule elapsed, the
// remaining work and the weekly progress rate the deadline now requires.

export default function ScheduleOutlook({ project }: { project: Project }) {
  const daysLeft = daysUntil(project.deadline);
  const overdue = daysLeft < 0 && project.status !== 'Completed';
  const remaining = Math.max(0, 100 - project.progress);
  const weeksLeft = daysLeft > 0 ? daysLeft / 7 : 0;
  const requiredWeeklyRate = weeksLeft > 0 ? remaining / weeksLeft : null;
  const variance = project.progress - project.planned;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-blue-900 dark:text-blue-300">
        <CalendarClock className="w-5 h-5" />
        <h3 className="font-bold text-[15px]">Schedule Outlook (computed) — {project.name}</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 flex items-center gap-1.5">
            <CalendarClock className="w-3.5 h-3.5" /> Contract Deadline
          </p>
          <p className="font-display font-bold text-xl text-slate-800 mt-2 dark:text-slate-100">{fmtDate(project.deadline)}</p>
          <p className="text-[11px] text-slate-500 font-semibold mt-1">Start {fmtDate(project.start)} • {project.months > 0 ? `${project.months} months` : 'duration not recorded'}</p>
        </Card>
        <Card className={cls('p-5', overdue ? 'border-red-200 dark:border-red-900' : '')}>
          <p className={cls('text-[10px] uppercase tracking-wider font-bold flex items-center gap-1.5', overdue ? 'text-red-600' : 'text-slate-500')}>
            {overdue ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            {overdue ? 'Past Deadline' : 'Time Remaining'}
          </p>
          <p className={cls('font-display font-bold text-xl mt-2', overdue ? 'text-red-600' : 'text-slate-800 dark:text-slate-100')}>
            {project.status === 'Completed' ? 'Completed' : overdue ? `${Math.abs(daysLeft)} days overdue` : `${daysLeft} days left`}
          </p>
          <p className="text-[11px] text-slate-500 font-semibold mt-1">Against the real current date</p>
        </Card>
        <Card className="p-5">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Required Pace</p>
          {requiredWeeklyRate != null ? (
            <>
              <p className="font-display font-bold text-xl text-slate-800 mt-2 dark:text-slate-100">{requiredWeeklyRate.toFixed(1)}% / week</p>
              <p className="text-[11px] text-slate-500 font-semibold mt-1">
                {remaining}% of work remains over {weeksLeft.toFixed(1)} weeks — a straight-line requirement, not a forecast.
              </p>
            </>
          ) : (
            <>
              <p className="font-display font-bold text-xl text-slate-800 mt-2 dark:text-slate-100">—</p>
              <p className="text-[11px] text-slate-500 font-semibold mt-1">{remaining}% of work remains; no time is left on the contract clock.</p>
            </>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <SectionTitle icon={CalendarClock} title="Progress vs Schedule" />
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-xs font-bold text-slate-600 mb-1.5 dark:text-slate-300">
              <span>Physical progress</span><span>{project.progress}%</span>
            </div>
            <ProgressBar value={project.progress} height="h-3" />
          </div>
          <div>
            <div className="flex justify-between text-xs font-bold text-slate-600 mb-1.5 dark:text-slate-300">
              <span>Schedule elapsed (planned duration gone)</span><span>{project.planned}%</span>
            </div>
            <ProgressBar value={project.planned} height="h-3" color="bg-slate-400" />
          </div>
          <p className="text-xs text-slate-500 font-medium dark:text-slate-400">
            Variance: <strong className={variance < 0 ? 'text-red-600' : 'text-green-700 dark:text-green-400'}>{variance > 0 ? '+' : ''}{variance}%</strong>
            {variance < 0 ? ' — progress is behind the share of time consumed.' : ' — progress is at or ahead of the share of time consumed.'}
          </p>
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle icon={CalendarClock} title="Milestones (project record)" />
        {project.milestones.length === 0 ? (
          <p className="text-sm text-slate-500 font-medium dark:text-slate-400">No milestones are recorded for this project.</p>
        ) : (
          <div className="space-y-3.5">
            {project.milestones.map((m) => (
              <div key={m.name} className="flex flex-col sm:flex-row sm:items-center gap-2">
                <span className={cls('text-sm font-semibold w-56 shrink-0', m.state === 'current' ? 'text-blue-800 dark:text-blue-300' : 'text-slate-600 dark:text-slate-400')}>
                  {m.state === 'done' ? '● ' : m.state === 'current' ? '● ' : '○ '}{m.name}
                </span>
                <ProgressBar value={m.state === 'done' ? 100 : m.progress ?? 0} height="h-2.5" className="flex-1" color={m.state === 'done' ? 'bg-green-600' : m.state === 'current' ? 'bg-blue-800 dark:bg-blue-600' : 'bg-slate-300'} />
                <span className="text-xs font-bold text-slate-700 w-28 text-right dark:text-slate-300">{m.date ? fmtDate(m.date) : '—'}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
        <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1 dark:text-slate-300">How to read this page</p>
        <p className="text-xs text-slate-600 leading-relaxed dark:text-slate-400">
          Every figure is arithmetic on the contract dates and the recorded physical progress — no completion date is
          predicted and no confidence is claimed. The contractual deadline remains {fmtDate(project.deadline)} unless the
          department records a revision.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2.5">
        <Link to={`/projects/${project.id}/update`} className="btn btn-primary btn-sm">Update Progress Data</Link>
        <Link to={`/projects/${project.id}/ai-analysis`} className="btn btn-secondary btn-sm">View Project Health</Link>
      </div>
    </div>
  );
}
