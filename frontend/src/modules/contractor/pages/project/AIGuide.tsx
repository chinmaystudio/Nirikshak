import { useEffect, useRef, useState } from 'react';
import { ClipboardList, Send, RotateCcw, Users, Wallet, CalendarClock, Gauge } from 'lucide-react';
import { Card, SectionTitle } from '../../components/ui';
import { Link } from '../../lib/router';
import type { Project } from '../../lib/types';
import { useStore } from '../../lib/store';
import { projectHealth } from '../../lib/health';
import { cr, fmtDate, daysLeftLabel } from '../../lib/utils';

// ─── Project Guide ───────────────────────────────────────────────────────────
// Rule-based answers computed from THIS project's live record (progress,
// schedule elapsed, milestones, inspections, documents, department finance).
// It is not an AI model: no invented productivity figures, no fabricated
// recovery plans, and no simulated "reading project data…" delay.

interface Msg {
  role: 'user' | 'guide';
  text?: string;
  answer?: GuideAnswer;
}

interface GuideAnswer {
  title: string;
  text?: string;
  list?: { label: string; value?: string }[];
}

const QUESTIONS = [
  'How is this project doing?',
  'Why is my project delayed?',
  'What is the finance position?',
  'What is coming up next?',
  'What should I prioritize this week?',
];

export default function ProjectGuide({ project }: { project: Project }) {
  const { invoices, documents, financialUpdates, workers, resources } = useStore();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const threadRef = useRef<HTMLDivElement>(null);

  const health = projectHealth(project);
  const current = project.milestones.find((m) => m.state === 'current');
  const nextMilestone = project.milestones.find((m) => m.state !== 'done');
  const fin = financialUpdates.find((f) => f.projectId === project.id);
  const projectInvoices = invoices.filter((i) => i.projectId === project.id);
  const docCount = documents[project.id]?.length ?? 0;
  const workerCount = workers[project.id]?.length ?? 0;
  const resourceCount = resources[project.id]?.length ?? 0;

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs]);

  const answerFor = (q: string): GuideAnswer => {
    const l = q.toLowerCase();
    const variance = project.progress - project.planned;

    if (l.includes('delay') || l.includes('behind') || l.includes('why')) {
      return {
        title: 'Schedule position',
        text: variance < 0
          ? `${project.name} is ${Math.abs(variance)}% behind: physical progress is ${project.progress}% while ${project.planned}% of the planned duration has elapsed. The portal record does not store a delay cause (the delay-events register is empty for this project), so no cause is invented here — the figures below are everything the record supports.`
          : `${project.name} is not behind on the recorded figures: progress ${project.progress}% vs schedule elapsed ${project.planned}%.`,
        list: [
          { label: 'Progress / schedule elapsed', value: `${project.progress}% / ${project.planned}%` },
          { label: 'Deadline', value: `${fmtDate(project.deadline)} (${daysLeftLabel(project.deadline)})` },
          { label: 'Current milestone', value: current ? `${current.name}${current.progress != null ? ` — ${current.progress}%` : ''}` : 'None in progress on record' },
          { label: 'Open complaints assigned to you', value: String(project.openComplaints) },
        ],
      };
    }
    if (l.includes('cost') || l.includes('budget') || l.includes('finance') || l.includes('spent') || l.includes('payment')) {
      return {
        title: 'Finance position (department records)',
        text: fin
          ? `The department's latest financial update for this project was recorded ${fmtDate(fin.date)}. This portal has no payment-receipt feed, so amounts received are not shown.`
          : 'The department has not recorded any financial update for this project yet, so no spent/received figure can be shown.',
        list: [
          { label: 'Contract value', value: cr(project.value) },
          { label: 'Amount spent (latest department record)', value: fin?.amountSpentCr != null ? cr(fin.amountSpentCr) : '—' },
          { label: 'Budget allocation (latest record)', value: fin?.budgetAllocationCr != null ? cr(fin.budgetAllocationCr) : '—' },
          { label: 'Cost overrun (latest record)', value: fin?.costOverrunCr != null ? cr(fin.costOverrunCr) : '—' },
          { label: 'Your invoices for this project', value: `${projectInvoices.length} on the project record (${projectInvoices.filter((i) => i.status === 'Draft').length} draft)` },
        ],
      };
    }
    if (l.includes('next') || l.includes('coming') || l.includes('upcoming') || l.includes('inspection')) {
      return {
        title: 'Coming up on this project',
        list: [
          { label: 'Next milestone', value: nextMilestone ? `${nextMilestone.name} — ${nextMilestone.date ? fmtDate(nextMilestone.date) : 'date not recorded'}` : 'No pending milestone on record' },
          ...project.upcoming.map((u) => ({ label: `Inspection — ${u.stage}`, value: u.date ? fmtDate(u.date) : '—' })),
          { label: 'Contract deadline', value: `${fmtDate(project.deadline)} (${daysLeftLabel(project.deadline)})` },
        ],
      };
    }
    if (l.includes('prioritize') || l.includes('week') || l.includes('faster') || l.includes('milestone')) {
      const actions: { label: string; value?: string }[] = [];
      if (variance < 0) actions.push({ label: 'Close the schedule gap', value: `${Math.abs(variance)}% behind schedule elapsed — focus crew on ${current?.name ?? 'the current milestone'}` });
      if (project.openComplaints > 0) actions.push({ label: 'Clear open complaints', value: `${project.openComplaints} assigned to your organization` });
      if (project.upcoming.length > 0) actions.push({ label: 'Prepare for scheduled inspection', value: `${project.upcoming[0].stage} — ${project.upcoming[0].date ? fmtDate(project.upcoming[0].date) : 'date not recorded'}` });
      actions.push({ label: 'Keep progress reporting current', value: 'Submit a progress update so the recorded figures stay trustworthy' });
      return {
        title: 'Priorities from the recorded figures',
        text: 'Ranked only by what the record shows — no productivity model is applied.',
        list: actions,
      };
    }
    if (l.includes('resource') || l.includes('worker')) {
      return {
        title: 'Resources (project record)',
        text: 'Workers and resources are recorded on this project\'s database record and are visible to the department.',
        list: [
          { label: 'Workers on record', value: String(workerCount) },
          { label: 'Resource rows on record', value: String(resourceCount) },
        ],
      };
    }
    return {
      title: 'Project snapshot',
      text: `${project.name} is ${project.progress}% complete (${project.status}) with contract value ${cr(project.value)}. Computed health is ${health.score}/100 — see the Project Health page for the formula. Ask about delay, finance, what is coming up, or this week's priorities.`,
      list: [
        { label: 'Progress / schedule elapsed', value: `${project.progress}% / ${project.planned}%` },
        { label: 'Deadline', value: `${fmtDate(project.deadline)} (${daysLeftLabel(project.deadline)})` },
        { label: 'Documents on record', value: String(docCount) },
        { label: 'Open complaints', value: String(project.openComplaints) },
      ],
    };
  };

  const ask = (q: string) => {
    if (!q.trim()) return;
    // Computed immediately from the loaded record — no fake thinking delay.
    setMsgs((m) => [...m, { role: 'user', text: q }, { role: 'guide', answer: answerFor(q) }]);
    setInput('');
  };

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0 dark:bg-blue-950 dark:border-blue-800">
            <ClipboardList className="w-5 h-5 text-blue-700 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="font-display font-bold text-lg text-slate-800 dark:text-slate-100">Project Guide</h2>
            <p className="text-xs text-slate-500 font-medium dark:text-slate-400">
              Answers computed from {project.name}’s live record — progress, schedule, finance, inspections &amp; documents. Not an AI model.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <CtxChip icon={Gauge} label={`${project.progress}% complete`} />
          <CtxChip icon={Wallet} label={`${cr(project.value)} contract`} />
          <CtxChip icon={Users} label={`${workerCount} workers`} />
          <CtxChip icon={CalendarClock} label={`deadline ${fmtDate(project.deadline)}`} />
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6 items-start">
        <div className="space-y-6">
          <Card className="p-5">
            <SectionTitle icon={ClipboardList} title="Project Context (live)" />
            <dl className="space-y-3">
              <CtxRow k="Current milestone" v={current?.name ?? '—'} />
              <CtxRow k="Milestone progress" v={current?.progress != null ? `${current.progress}%` : '—'} />
              <CtxRow k="Progress / schedule elapsed" v={`${project.progress}% / ${project.planned}%`} />
              <CtxRow k="Spent (dept. record)" v={fin?.amountSpentCr != null ? cr(fin.amountSpentCr) : '—'} />
              <CtxRow k="Open complaints" v={`${project.openComplaints}`} />
              <CtxRow k="Computed health" v={`${health.score}/100`} />
            </dl>
          </Card>

          <Card className="p-5">
            <SectionTitle icon={ClipboardList} title="Example Questions" />
            <div className="flex flex-col gap-2">
              {QUESTIONS.map((qq) => (
                <button
                  key={qq}
                  className="text-left text-[13px] font-semibold text-slate-700 rounded-lg border border-slate-200 px-3 py-2.5 hover:border-blue-400 hover:bg-blue-50/50 transition-colors cursor-pointer dark:border-slate-700 dark:text-slate-300 dark:hover:bg-blue-950/30"
                  onClick={() => ask(qq)}
                >
                  {qq}
                </button>
              ))}
            </div>
          </Card>
        </div>

        <Card className="flex flex-col min-h-[560px]">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Guide Thread</p>
            {msgs.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={() => setMsgs([])}>
                <RotateCcw className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
          </div>

          <div ref={threadRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
            {msgs.length === 0 && (
              <div className="text-center pt-10 max-w-md mx-auto">
                <ClipboardList className="w-8 h-8 text-blue-300 mx-auto mb-3 dark:text-blue-700" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Ask a question about this project</p>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed dark:text-slate-400">
                  The guide computes answers from the live project record shown on the left — schedule position,
                  department finance, upcoming inspections and recorded priorities.
                </p>
              </div>
            )}
            {msgs.map((m, i) =>
              m.role === 'user' ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] rounded-lg rounded-br-sm bg-blue-700 text-white px-4 py-2.5 text-sm font-medium shadow-sm">{m.text}</div>
                </div>
              ) : (
                <div key={i} className="rounded-lg border border-blue-200 bg-white overflow-hidden dark:border-blue-900 dark:bg-slate-900">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50/70 border-b border-blue-100 dark:bg-blue-950/40 dark:border-blue-900">
                    <ClipboardList className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300">{m.answer!.title}</span>
                  </div>
                  <div className="p-4 space-y-4">
                    {m.answer!.text && <p className="text-sm text-slate-700 leading-relaxed dark:text-slate-300">{m.answer!.text}</p>}
                    {m.answer!.list && (
                      <ul className="space-y-2.5">
                        {m.answer!.list.map((li) => (
                          <li key={li.label} className="border-l-2 border-slate-200 pl-3 dark:border-slate-700">
                            <p className="text-[13px] font-bold text-slate-800 dark:text-slate-200">{li.label}</p>
                            {li.value && <p className="text-xs text-slate-600 mt-0.5 dark:text-slate-400">{li.value}</p>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )
            )}
          </div>

          <div className="border-t border-slate-200 p-4 dark:border-slate-800">
            <div className="flex gap-2.5">
              <input
                className="input flex-1"
                placeholder="Ask about this project…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && ask(input)}
                aria-label="Ask the project guide"
              />
              <button className="btn btn-primary" onClick={() => ask(input)} disabled={!input.trim()} aria-label="Send">
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">Answers are computed from the project record — cross-check critical actions with site records.</p>
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2.5 justify-center">
        <Link to={`/projects/${project.id}/ai-analysis`} className="btn btn-secondary btn-sm">Project Health (computed)</Link>
        <Link to={`/projects/${project.id}/ai-completion`} className="btn btn-secondary btn-sm">Schedule Outlook</Link>
      </div>
    </div>
  );
}

function CtxChip({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
      <Icon className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
      {label}
    </span>
  );
}

function CtxRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-xs text-slate-500 font-semibold">{k}</dt>
      <dd className="text-xs font-bold text-slate-800 text-right dark:text-slate-200">{v}</dd>
    </div>
  );
}
