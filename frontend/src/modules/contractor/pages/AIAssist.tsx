import { useEffect, useRef, useState } from 'react';
import { ClipboardList, Send, RotateCcw, ShieldCheck, Banknote, Gavel, AlertTriangle, CalendarClock } from 'lucide-react';
import { PageHeader, Card, SectionTitle, StatusBadge } from '../components/ui';
import { Link } from '../lib/router';
import { useStore } from '../lib/store';
import { cls, cr, daysLeftLabel, daysUntil, fmtDate, money } from '../lib/utils';
import { ContractorTenderService } from '../services/tender.service';
import type { DbBid, DbTender } from '../services/tender.service';
import { eligibilityStatus, useContractorProfile } from '../lib/eligibility';

// ─── Bid Assistant ───────────────────────────────────────────────────────────
// NOT an AI model and never presented as one: every answer below is computed
// synchronously from live data — the open tenders list, the contractor's own
// server bids, the assigned-projects view and department financial updates.
// (The previous "AI Assist" matched keywords against a canned answer table
// with invented figures, behind a fake thinking spinner. Both are gone.)

interface AnswerItem {
  label: string;
  value?: string;
  link?: string;
  tone?: 'ok' | 'warn' | 'bad' | 'info';
}

interface Answer {
  title: string;
  text?: string;
  items?: AnswerItem[];
}

interface Msg {
  role: 'user' | 'assistant';
  text?: string;
  answer?: Answer;
}

const SUGGESTIONS = [
  { icon: CalendarClock, q: 'What is the nearest tender deadline?' },
  { icon: Gavel, q: 'Which tenders can I bid for?' },
  { icon: ShieldCheck, q: 'Am I eligible for the open tenders?' },
  { icon: ClipboardList, q: 'What is the status of my bids?' },
  { icon: AlertTriangle, q: 'Which of my projects are behind schedule?' },
  { icon: Banknote, q: 'How much has been spent on my projects?' },
];

export default function BidAssistant() {
  const { projects, financialUpdates, contractorOrganization } = useStore();
  const profile = useContractorProfile();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [openTenders, setOpenTenders] = useState<DbTender[]>([]);
  const [myBids, setMyBids] = useState<DbBid[]>([]);
  const [loaded, setLoaded] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [tenders, bids] = await Promise.all([
          ContractorTenderService.getOpenTenders(),
          ContractorTenderService.getMyBids(),
        ]);
        if (!active) return;
        setOpenTenders(tenders);
        setMyBids(bids);
      } catch { /* lists stay empty — answers say so honestly */ }
      if (active) setLoaded(true);
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs]);

  const active = projects.filter((p) => p.status !== 'Completed');

  const resolve = (question: string): Answer => {
    const q = question.toLowerCase();
    const tendersByDeadline = [...openTenders].sort((a, b) => String(a.bid_due_date).localeCompare(String(b.bid_due_date)));

    if (q.includes('deadline') || q.includes('close') || q.includes('when')) {
      if (tendersByDeadline.length === 0) return { title: 'Tender deadlines', text: 'There are no open tenders right now, so there is no upcoming bid deadline.' };
      return {
        title: 'Open tender deadlines (live)',
        items: tendersByDeadline.map((t) => ({
          label: `${t.title} (${t.tender_number})`,
          value: `${fmtDate(t.bid_due_date)} — ${daysLeftLabel(t.bid_due_date)}`,
          link: `/tenders/${t.id}`,
          tone: daysUntil(t.bid_due_date) < 0 ? 'bad' : daysUntil(t.bid_due_date) <= 7 ? 'warn' : 'info',
        })),
      };
    }

    if (q.includes('eligible') || q.includes('eligibility') || q.includes('qualify')) {
      if (tendersByDeadline.length === 0) return { title: 'Eligibility', text: 'There are no open tenders to check eligibility against right now.' };
      return {
        title: 'Indicative eligibility — from each tender’s published criteria',
        text: 'This is an indicative check against the criteria recorded on the tender and the profile on your organization record. The department makes the final determination.',
        items: tendersByDeadline.map((t) => {
          const ui = ContractorTenderService.toTender(t);
          const status = eligibilityStatus(ui, profile);
          return {
            label: `${t.title} — ${cr(Number(t.estimated_value_inr_crore) || 0)}`,
            value: status === 'Eligible' ? 'Indicative: eligible' : status === 'Review' ? 'Indicative: manual review needed' : 'Indicative: not eligible',
            link: `/tenders/${t.id}/bid/ai-assist`,
            tone: status === 'Eligible' ? 'ok' : status === 'Review' ? 'warn' : 'bad',
          };
        }),
      };
    }

    if (q.includes('bid') || q.includes('status')) {
      if (myBids.length === 0) return { title: 'Your bids', text: 'You have no bids on record with the server yet. Submitted and draft bids will appear here with their server-issued reference.' };
      return {
        title: 'Your bids (server record)',
        items: myBids.map((b) => ({
          label: `${b.tenders?.title ?? 'Tender'} — ${b.bid_reference}`,
          value: `${b.status}${b.bid_amount != null ? ` • ${cr(Number(b.bid_amount))}` : ''}${b.submitted_at ? ` • submitted ${fmtDate(b.submitted_at)}` : ''}`,
          link: '/tenders',
          tone: b.status === 'SELECTED' ? 'ok' : b.status === 'REJECTED' || b.status === 'WITHDRAWN' ? 'bad' : 'info',
        })),
      };
    }

    if (q.includes('risk') || q.includes('behind') || q.includes('delay') || q.includes('schedule')) {
      const ranked = [...active]
        .map((p) => ({ p, variance: p.progress - p.planned }))
        .sort((a, b) => a.variance - b.variance);
      if (ranked.length === 0) return { title: 'Schedule position', text: 'You have no active projects on record.' };
      return {
        title: 'Schedule position — progress vs schedule elapsed',
        text: '“Schedule elapsed” is the share of the planned duration (start → deadline) already gone. A project is behind when its physical progress is below that figure.',
        items: ranked.map(({ p, variance }) => ({
          label: p.name,
          value: `${p.progress}% complete vs ${p.planned}% schedule elapsed (${variance > 0 ? '+' : ''}${variance}%) • deadline ${fmtDate(p.deadline)}`,
          link: `/projects/${p.id}/details`,
          tone: variance < -10 ? 'bad' : variance < 0 ? 'warn' : 'ok',
        })),
      };
    }

    if (q.includes('payment') || q.includes('spent') || q.includes('money') || q.includes('finance')) {
      if (projects.length === 0) return { title: 'Project finance', text: 'No assigned projects on record, so there is no finance data to report.' };
      return {
        title: 'Amount spent — department financial records',
        text: 'Figures are the latest amount_spent recorded by the department in financial_updates for each project. This portal has no payment-receipt feed, so “amount received” is not shown.',
        items: projects.map((p) => {
          const latest = financialUpdates.find((f) => f.projectId === p.id);
          return {
            label: p.name,
            value: latest?.amountSpentCr != null ? `${cr(latest.amountSpentCr)} spent of ${cr(p.value)} contract value (recorded ${fmtDate(latest.date)})` : `No department finance record yet • contract value ${cr(p.value)}`,
            link: `/projects/${p.id}/finance`,
            tone: 'info' as const,
          };
        }),
      };
    }

    if (q.includes('document') || q.includes('docs')) {
      const t = tendersByDeadline[0];
      if (!t) return { title: 'Bid documents', text: 'There are no open tenders, so no bid document list applies right now.' };
      const ui = ContractorTenderService.toTender(t);
      return {
        title: `Documents listed for ${t.title}`,
        text: ui.docs.length > 0
          ? 'These are the documents named on the published tender record. The bid wizard checks your attached file names against the required list.'
          : 'The published tender record does not name a document list. Check the tender’s technical and financial requirements on its detail page.',
        items: ui.docs.map((d) => ({ label: d, tone: 'info' as const })),
      };
    }

    return {
      title: 'Your current standing (live data)',
      text: loaded
        ? `${active.length} active project${active.length === 1 ? '' : 's'} on record, ${openTenders.length} open tender${openTenders.length === 1 ? '' : 's'}, and ${myBids.length} bid${myBids.length === 1 ? '' : 's'} on the server. Ask about a deadline, eligibility, your bid status, schedule position or project finance for the computed answer.`
        : 'Live tender and bid data is still loading — ask again in a moment.',
      items: tendersByDeadline.slice(0, 1).map((t) => ({
        label: `Nearest deadline: ${t.title}`,
        value: `${fmtDate(t.bid_due_date)} — ${daysLeftLabel(t.bid_due_date)}`,
        link: `/tenders/${t.id}`,
        tone: 'info' as const,
      })),
    };
  };

  const ask = (question: string) => {
    if (!question.trim()) return;
    // Answers are computed immediately from the loaded data — no fake delay.
    setMsgs((m) => [...m, { role: 'user', text: question }, { role: 'assistant', answer: resolve(question) }]);
    setInput('');
  };

  return (
    <div className="p-4 lg:p-6 lg:py-8 max-w-[1600px] mx-auto space-y-5">
      <PageHeader
        title="Bid Assistant"
        subtitle="Answers from live tender data — computed from your real tenders, bids and projects, not generated by an AI model"
        actions={
          <button className="btn btn-secondary" onClick={() => setMsgs([])} disabled={msgs.length === 0}>
            <RotateCcw className="w-4 h-4" />
            Clear Conversation
          </button>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-6 items-start">
        {/* Context panel */}
        <div className="space-y-6">
          <Card className="p-5">
            <SectionTitle icon={Gavel} title="Your Context (live)" />
            <div className="flex flex-col gap-3">
              {active.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate dark:text-slate-200">{p.name}</p>
                    <p className="text-[10px] text-slate-500 font-semibold">{p.progress}% complete • {cr(p.value)}</p>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
              ))}
              {active.length === 0 && <p className="text-xs text-slate-500 font-medium">No active projects on record.</p>}
            </div>
            <div className="grid grid-cols-2 gap-2.5 mt-4">
              <div className="rounded-lg border border-slate-200 p-2.5 dark:border-slate-700">
                <p className="text-[9px] uppercase tracking-wider font-bold text-slate-500">Open Tenders</p>
                <p className="text-sm font-display font-bold text-blue-800 dark:text-blue-300">{openTenders.length}</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-2.5 dark:border-slate-700">
                <p className="text-[9px] uppercase tracking-wider font-bold text-slate-500">My Bids (server)</p>
                <p className="text-sm font-display font-bold text-blue-800 dark:text-blue-300">{myBids.length}</p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle icon={ClipboardList} title="Suggested Questions" />
            <div className="flex flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.q}
                  className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 text-left text-[13px] font-semibold text-slate-700 hover:border-blue-400 hover:bg-blue-50/50 transition-colors cursor-pointer dark:border-slate-700 dark:text-slate-300 dark:hover:bg-blue-950/30"
                  onClick={() => ask(s.q)}
                >
                  <s.icon className="w-4 h-4 text-blue-700 shrink-0 dark:text-blue-400" />
                  {s.q}
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Conversation */}
        <Card className="flex flex-col h-[calc(100vh-13rem)] min-h-[520px]">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center dark:bg-blue-950 dark:border-blue-800">
                <ClipboardList className="w-4 h-4 text-blue-700 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Bid Assistant</p>
                <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  {contractorOrganization ? contractorOrganization.name : 'Organization not linked'} • answers computed from live portal data
                </p>
              </div>
            </div>
          </div>

          <div ref={threadRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
            {msgs.length === 0 && (
              <div className="max-w-xl mx-auto text-center pt-10">
                <div className="w-14 h-14 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center mx-auto mb-4 dark:bg-blue-950 dark:border-blue-800">
                  <ClipboardList className="w-7 h-7 text-blue-700 dark:text-blue-400" />
                </div>
                <p className="font-display font-bold text-lg text-slate-800 dark:text-slate-100">Ask about your tenders and projects</p>
                <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto leading-relaxed dark:text-slate-400">
                  Deadlines, indicative eligibility, your bid status, schedule position and department finance figures —
                  each answer is computed on the spot from the live records shown on the left.
                </p>
              </div>
            )}

            {msgs.map((m, i) =>
              m.role === 'user' ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] rounded-lg rounded-br-sm bg-blue-700 text-white px-4 py-2.5 text-sm font-medium shadow-sm">
                    {m.text}
                  </div>
                </div>
              ) : (
                <AnswerCard key={i} answer={m.answer!} />
              )
            )}
          </div>

          <div className="border-t border-slate-200 p-4 dark:border-slate-800">
            <div className="flex gap-2.5">
              <input
                className="input flex-1"
                placeholder="Ask about deadlines, eligibility, bids, schedule, finance…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && ask(input)}
                aria-label="Ask the bid assistant"
              />
              <button className="btn btn-primary" onClick={() => ask(input)} disabled={!input.trim()} aria-label="Send question">
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">
              Answers are computed from your live portal data and are indicative. Verify with official records before submissions.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

function AnswerCard({ answer }: { answer: Answer }) {
  return (
    <div className="max-w-[92%]">
      <div className="rounded-lg border border-blue-200 bg-white overflow-hidden dark:border-blue-900 dark:bg-slate-900">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50/70 border-b border-blue-100 dark:bg-blue-950/40 dark:border-blue-900">
          <ClipboardList className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300">{answer.title}</span>
        </div>
        <div className="p-4 space-y-3.5">
          {answer.text && (
            <p className="text-sm text-slate-700 leading-relaxed dark:text-slate-300">{answer.text}</p>
          )}
          {answer.items && answer.items.length > 0 && (
            <ul className="flex flex-col gap-2.5">
              {answer.items.map((it) => {
                const body = (
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 sm:gap-4 w-full">
                    <span className="text-[13px] font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      {it.link ? <span className="link">{it.label}</span> : it.label}
                    </span>
                    {it.value && (
                      <span
                        className={cls(
                          'text-xs font-semibold sm:text-right sm:max-w-[55%]',
                          it.tone === 'bad' ? 'text-red-600' : it.tone === 'warn' ? 'text-amber-700 dark:text-amber-400' : it.tone === 'ok' ? 'text-green-700 dark:text-green-400' : 'text-slate-600 dark:text-slate-300'
                        )}
                      >
                        {it.value}
                      </span>
                    )}
                  </div>
                );
                return (
                  <li key={it.label} className="border-l-2 border-slate-200 pl-3 dark:border-slate-700">
                    {it.link ? <Link to={it.link} className="block w-full">{body}</Link> : body}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
      <p className="text-[10px] text-slate-400 mt-1.5">Computed from live portal data • verify before acting</p>
    </div>
  );
}
