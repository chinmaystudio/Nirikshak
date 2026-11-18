import { useEffect, useState } from 'react';
import { ClipboardList, ArrowRight, CheckCircle2, XCircle, CircleAlert, FileWarning, CalendarClock } from 'lucide-react';
import { Card, SectionTitle, StatusBadge } from '../components/ui';
import { Link } from '../lib/router';
import { getCachedTender, ContractorTenderService } from '../services/tender.service';
import type { DbBid } from '../services/tender.service';
import type { Tender } from '../lib/types';
import { eligibilityRows, eligibilityStatus, useContractorProfile } from '../lib/eligibility';
import { cr, daysLeftLabel, daysUntil, fmtDate } from '../lib/utils';

// ─── Bid Assistant (per tender) ──────────────────────────────────────────────
// Every check on this page is computed from live data: the tender's own
// published criteria/requirements/document list, the contractor's real
// organization profile, and their actual server bid (status, amount and the
// document filenames saved on the draft). There is no AI model, no readiness
// score and no simulated analysis delay — the previous version invented all
// three, including "missing documents" keyed to demo tender ids.

const REQUIRED_DOC_KEYS = ['Experience Certificate', 'Equipment Ownership Proof', 'EMD Bank Guarantee', 'Turnover Certificate'];

export default function BidAssist({ tenderId }: { tenderId: string }) {
  const [tender, setTender] = useState<Tender | undefined>(() => getCachedTender(tenderId));
  const [notFound, setNotFound] = useState(false);
  const [myBid, setMyBid] = useState<DbBid | null>(null);
  const profile = useContractorProfile();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const row = await ContractorTenderService.getTender(tenderId);
        if (!active) return;
        if (row) setTender(ContractorTenderService.toTender(row));
        else if (!getCachedTender(tenderId)) setNotFound(true);
      } catch {
        if (active && !getCachedTender(tenderId)) setNotFound(true);
      }
      try {
        const bids = await ContractorTenderService.getMyBids();
        if (active) setMyBid(bids.find((b) => b.tender_id === tenderId) ?? null);
      } catch { /* bid panel simply reports no server bid */ }
    })();
    return () => { active = false; };
  }, [tenderId]);

  if (!tender) {
    return (
      <div className="p-6 max-w-3xl mx-auto pt-10">
        <Card className="p-8 text-center">
          <p className="font-display font-bold text-xl text-slate-800 dark:text-slate-100">{notFound ? 'Tender not found' : 'Loading tender…'}</p>
          <Link to="/tenders" className="btn btn-primary mt-5 inline-flex">Back to Tender Management</Link>
        </Card>
      </div>
    );
  }

  const rows = eligibilityRows(tender, profile);
  const status = eligibilityStatus(tender, profile);
  const days = daysUntil(tender.deadline);

  // Document check: file NAMES saved on the contractor's real draft bid vs
  // the required list used by the bid wizard. Name-based and indicative.
  const draftDocNames = myBid && Array.isArray(myBid.documents)
    ? (myBid.documents as unknown[]).map((d) => (typeof d === 'string' ? d : d && typeof d === 'object' && 'name' in d ? String((d as { name: unknown }).name) : '')).filter(Boolean)
    : [];
  const missingDocs = myBid
    ? REQUIRED_DOC_KEYS.filter((req) => !draftDocNames.some((n) => n.toLowerCase().includes(req.toLowerCase().split(' ')[0])))
    : REQUIRED_DOC_KEYS;

  return (
    <div className="p-4 lg:p-6 lg:py-8 max-w-[1300px] mx-auto space-y-5">
      <div>
        <Link to={`/tenders/${tender.id}/bid`} className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-700 mb-2 w-max dark:text-slate-400">
          ← Bid Submission
        </Link>
        <div>
          <h1 className="font-display text-2xl text-slate-800 tracking-tight font-bold dark:text-slate-100">Bid Assistant</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium dark:text-slate-400">
            {tender.title} • {tender.code} • Deadline {fmtDate(tender.deadline)} ({daysLeftLabel(tender.deadline)}) • Checks computed from live tender data — not an AI model
          </p>
        </div>
      </div>

      {/* Deadline + own bid status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card className="p-5">
          <SectionTitle icon={CalendarClock} title="Bid Deadline" />
          <p className="font-display font-bold text-xl text-slate-800 dark:text-slate-100">{fmtDate(tender.deadline)}</p>
          <p className={`text-xs font-bold mt-1 ${days < 0 ? 'text-red-600' : days <= 7 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>
            {days < 0 ? `Closed ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago` : days === 0 ? 'Closes today' : `${days} day${days === 1 ? '' : 's'} remaining`}
          </p>
          <p className="text-xs text-slate-500 mt-2 dark:text-slate-400">Estimated value {cr(tender.value)} • {tender.department}</p>
        </Card>

        <Card className="p-5">
          <SectionTitle icon={ClipboardList} title="Your Bid (server record)" />
          {myBid ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-xs text-slate-500 font-semibold">Reference</dt><dd className="text-xs font-bold font-mono text-slate-800 dark:text-slate-200">{myBid.bid_reference}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-xs text-slate-500 font-semibold">Status</dt><dd className="text-xs font-bold text-slate-800 dark:text-slate-200">{myBid.status}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-xs text-slate-500 font-semibold">Amount</dt><dd className="text-xs font-bold text-slate-800 dark:text-slate-200">{myBid.bid_amount != null ? cr(Number(myBid.bid_amount)) : '—'}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-xs text-slate-500 font-semibold">Submitted</dt><dd className="text-xs font-bold text-slate-800 dark:text-slate-200">{myBid.submitted_at ? fmtDate(myBid.submitted_at) : '— (draft)'}</dd></div>
            </dl>
          ) : (
            <p className="text-sm text-slate-500 font-medium dark:text-slate-400">No bid from your organization is on record for this tender yet.</p>
          )}
        </Card>
      </div>

      {/* Document name check */}
      <Card className="p-5">
        <SectionTitle icon={FileWarning} title="Document Check — file names on your draft bid" />
        {!myBid ? (
          <p className="text-sm text-slate-500 font-medium dark:text-slate-400">
            No draft bid exists yet, so there are no attached file names to check. Start the bid and attach documents — the wizard saves their names to your server draft, and this check compares them against the required list.
          </p>
        ) : (
          <>
            <div className="rounded-lg border border-slate-200 divide-y divide-slate-200 dark:border-slate-700 dark:divide-slate-700">
              {REQUIRED_DOC_KEYS.map((req) => {
                const have = !missingDocs.includes(req);
                return (
                  <div key={req} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{req}</span>
                    {have
                      ? <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-700 dark:text-green-400"><CheckCircle2 className="w-3.5 h-3.5" /> Name found</span>
                      : <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600"><XCircle className="w-3.5 h-3.5" /> Not in draft file names</span>}
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-400 mt-3">Name-based check only — it cannot verify a document’s contents. {draftDocNames.length} file name{draftDocNames.length === 1 ? '' : 's'} on your draft.</p>
          </>
        )}
        {tender.docs.length > 0 && (
          <p className="text-xs text-slate-500 mt-3 dark:text-slate-400">Documents named on the tender record: {tender.docs.join(', ')}.</p>
        )}
      </Card>

      {/* Tender requirements, verbatim */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="p-5">
          <SectionTitle title="Tender Summary" />
          <p className="text-sm text-slate-700 leading-relaxed dark:text-slate-300">{tender.summary}</p>
        </Card>

        <Card className="p-5">
          <SectionTitle title="Published Requirements" />
          <div className="space-y-3.5 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Technical</p>
              {tender.techReq.length > 0
                ? <ul className="space-y-1">{tender.techReq.map((r) => <li key={r} className="text-slate-700 dark:text-slate-300">• {r}</li>)}</ul>
                : <p className="text-slate-500 dark:text-slate-400">No technical requirements were included in the published tender.</p>}
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Financial</p>
              {tender.finReq.length > 0
                ? <ul className="space-y-1">{tender.finReq.map((r) => <li key={r} className="text-slate-700 dark:text-slate-300">• {r}</li>)}</ul>
                : <p className="text-slate-500 dark:text-slate-400">No separate financial requirements were included in the published tender.</p>}
            </div>
          </div>
        </Card>
      </div>

      {/* Eligibility table */}
      <Card className="overflow-hidden">
        <div className="p-5 pb-3 flex items-center justify-between">
          <SectionTitle title="Eligibility Check — Profile vs Requirements" className="mb-0" />
          <StatusBadge status={status} />
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Criterion</th>
                <th>Requirement</th>
                <th>Our Profile</th>
                <th>Check</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <td className="font-bold text-slate-800 dark:text-slate-100">{r.label}</td>
                  <td className="text-xs max-w-[280px]">{r.required}</td>
                  <td className="text-xs max-w-[240px] font-semibold">{r.ours}</td>
                  <td>
                    {r.pass === true ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700 dark:text-green-400"><CheckCircle2 className="w-4 h-4" /> Passed</span>
                    ) : r.pass === false ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600"><XCircle className="w-4 h-4" /> Not met</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-400"><CircleAlert className="w-4 h-4" /> Review</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex justify-end">
        {status === 'Not Eligible' ? (
          <button className="btn btn-primary" disabled>Not eligible — cannot bid</button>
        ) : (
          <Link to={`/tenders/${tender.id}/bid`}>
            <button className="btn btn-primary">
              Continue Bid <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
        )}
      </div>

      <p className="text-[11px] text-slate-400 text-center">
        These checks are computed from your contractor profile and the published tender record, and are indicative only. Final evaluation rests with the tendering authority. Estimated value: {cr(tender.value)}.
      </p>
    </div>
  );
}
