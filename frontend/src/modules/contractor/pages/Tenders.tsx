import { useEffect, useMemo, useState } from 'react';
import { Bookmark, BookmarkCheck, ArrowRight } from 'lucide-react';
import { PageHeader, Card, Tabs, StatusBadge, Select, SearchInput, EmptyState } from '../components/ui';
import { DataTable } from '../components/DataTable';
import { Link } from '../lib/router';
import { useStore } from '../lib/store';
import type { Tender } from '../lib/data';
import { eligibilityStatus, useContractorProfile } from '../lib/eligibility';
import { cls, cr, daysUntil, fmtDate, timeAgo } from '../lib/utils';
import { ContractorTenderService } from '../services/tender.service';
import type { DbBid } from '../services/tender.service';

// One merged row for the My Bids / Past Bids tabs. Server rows
// (ContractorTenderService.getMyBids) are the truth; local store bids are
// only a fallback for tender ids the server has no row for.
interface MyBidRow {
  id: string; // DataTable row key: server bid id, or `local-<tenderId>`
  tenderId: string;
  serverId?: string;
  serverStatus?: DbBid['status'];
  title: string;
  code: string;
  ref?: string;
  // ₹ Cr — server bid_amount and local bidValue are BOTH already in ₹ Cr
  // end to end (a value of 41.75 means ₹41.75 Cr). Display directly; never
  // rescale (the old code divided by 1e7 and showed ₹41.75 Cr as ~₹0.00 Cr).
  bidValue?: number;
  updatedAt: string;
  submittedAt?: string | null;
  status: string;
}

const SERVER_BID_STATUS_LABEL: Record<DbBid['status'], string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under Evaluation',
  QUALIFIED: 'Under Evaluation',
  DISQUALIFIED: 'Rejected',
  SELECTED: 'Awarded',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
};

export default function Tenders() {
  const { bids, savedTenders, toggleSaveTender, toast } = useStore();
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [serverBids, setServerBids] = useState<DbBid[]>([]);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const contractorProfile = useContractorProfile();
  const [tab, setTab] = useState('open');
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('All Departments');
  const [loc, setLoc] = useState('All Locations');
  const [cat, setCat] = useState('All Categories');
  const [minVal, setMinVal] = useState('Any Value');
  const [elig, setElig] = useState('All');
  const DEPTS = useMemo(() => ['All Departments', ...new Set(tenders.map((t) => t.department))], [tenders]);
  const LOCS = useMemo(() => ['All Locations', ...new Set(tenders.map((t) => t.location))], [tenders]);
  const CATS = useMemo(() => ['All Categories', ...new Set(tenders.map((t) => t.category))], [tenders]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const rows = await ContractorTenderService.getOpenTenders();
        if (active) setTenders(rows.map(ContractorTenderService.toTender));
      } catch (error) {
        console.error('Unable to load tenders:', error);
        if (active) toast('warn', 'Tender data unavailable', 'No database fallback data was substituted.');
      }
      try {
        const myBids = await ContractorTenderService.getMyBids();
        if (active) setServerBids(myBids);
      } catch (error) {
        // Server bids unavailable: My Bids falls back to the local store
        // only — no fabricated rows are substituted.
        console.error('Unable to load contractor bids:', error);
      }
    };
    void load();
    const unsubscribe = ContractorTenderService.subscribeTenderEvents(load);
    return () => { active = false; unsubscribe(); };
  }, [toast]);

  const openFiltered = useMemo(() => {
    return tenders.filter((t) => {
      const term = q.trim().toLowerCase();
      if (term && !((t.title || '').toLowerCase().includes(term) || (t.code || '').toLowerCase().includes(term) || (t.department || '').toLowerCase().includes(term))) return false;
      if (dept !== 'All Departments' && t.department !== dept) return false;
      if (loc !== 'All Locations' && t.location !== loc) return false;
      if (cat !== 'All Categories' && t.category !== cat) return false;
      if (minVal !== 'Any Value' && t.value < Number(minVal)) return false;
      if (elig !== 'All' && eligibilityStatus(t, contractorProfile) !== elig) return false;
      return true;
    });
  }, [tenders, q, dept, loc, cat, minVal, elig, contractorProfile]);

  const saved = tenders.filter((t) => savedTenders.includes(t.id));

  // My Bids: server truth merged over the local store — for any tender the
  // server has a bid row for, the server row wins outright.
  const myBidRows = useMemo<MyBidRow[]>(() => {
    const tenderById = new Map(tenders.map((t) => [t.id, t]));
    const rows: MyBidRow[] = serverBids.map((bid) => {
      const joined = bid.tenders;
      const local = tenderById.get(bid.tender_id);
      return {
        id: bid.id,
        tenderId: bid.tender_id,
        serverId: bid.id,
        serverStatus: bid.status,
        title: joined?.title || local?.title || 'Tender',
        code: joined?.tender_number || local?.code || '',
        ref: bid.bid_reference || undefined,
        bidValue: bid.bid_amount == null ? undefined : Number(bid.bid_amount),
        updatedAt: bid.updated_at || bid.submitted_at || '',
        submittedAt: bid.submitted_at,
        status: SERVER_BID_STATUS_LABEL[bid.status] || bid.status,
      };
    });
    const serverTenderIds = new Set(serverBids.map((b) => b.tender_id));
    for (const [tenderId, localBid] of Object.entries(bids)) {
      if (serverTenderIds.has(tenderId)) continue; // server wins
      const local = tenderById.get(tenderId);
      rows.push({
        id: `local-${tenderId}`,
        tenderId,
        title: local?.title || 'Tender',
        code: local?.code || '',
        ref: localBid.ref,
        bidValue: localBid.bidValue,
        updatedAt: localBid.updatedAt,
        submittedAt: localBid.submittedAt,
        status: localBid.status,
      });
    }
    return rows.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }, [serverBids, bids, tenders]);

  // Past Bids: decided server bids only (SELECTED / REJECTED / WITHDRAWN) —
  // the bundled PAST_BIDS mock is no longer used anywhere in this page.
  const pastBidRows = useMemo(
    () => myBidRows.filter((r) => r.serverStatus === 'SELECTED' || r.serverStatus === 'REJECTED' || r.serverStatus === 'WITHDRAWN'),
    [myBidRows],
  );

  const handleWithdraw = async (row: MyBidRow) => {
    if (!row.serverId) return;
    if (!window.confirm(`Withdraw your submitted bid${row.ref ? ` ${row.ref}` : ''} for "${row.title}"? This cannot be undone.`)) return;
    setWithdrawingId(row.serverId);
    try {
      // DF-08: goes through the withdraw_tender_bid RPC and throws unless
      // the bid was actually withdrawn.
      await ContractorTenderService.withdrawBid(row.serverId);
      toast('success', 'Bid withdrawn', row.ref || row.title);
      const myBids = await ContractorTenderService.getMyBids();
      setServerBids(myBids);
    } catch (error) {
      toast('warn', 'Bid could not be withdrawn', error instanceof Error ? error.message : 'Please retry.');
    } finally {
      setWithdrawingId(null);
    }
  };

  const toggleSave = (t: Tender) => {
    const wasSaved = savedTenders.includes(t.id);
    toggleSaveTender(t.id);
    toast('info', wasSaved ? 'Removed from saved tenders' : 'Tender saved', t.title);
  };

  const tenderCols = [
    {
      key: 'title',
      label: 'Tender',
      sortVal: (t: Tender) => t.title,
      render: (t: Tender) => (
        <div className="max-w-[260px]">
          <Link to={`/tenders/${t.id}`} className="text-sm font-bold text-slate-800 hover:text-blue-700 dark:text-slate-100 dark:hover:text-blue-400">
            {t.title}
          </Link>
          <p className="text-[11px] text-slate-500 font-medium dark:text-slate-400">{t.code}</p>
        </div>
      ),
    },
    { key: 'dept', label: 'Department', sortVal: (t: Tender) => t.department, render: (t: Tender) => <span className="text-xs font-semibold">{t.department}</span> },
    { key: 'loc', label: 'Location', sortVal: (t: Tender) => t.location, render: (t: Tender) => <span className="text-xs font-semibold">{t.location}</span> },
    { key: 'value', label: 'Estimated Value', sortVal: (t: Tender) => t.value, render: (t: Tender) => <span className="text-xs font-bold tabular-nums">{cr(t.value)}</span> },
    {
      key: 'deadline',
      label: 'Deadline',
      sortVal: (t: Tender) => t.deadline,
      render: (t: Tender) => {
        const d = daysUntil(t.deadline);
        return (
          <div>
            <p className="text-xs font-semibold">{fmtDate(t.deadline)}</p>
            <p className={cls('text-[10px] font-bold', d <= 14 ? 'text-red-600' : 'text-slate-500 dark:text-slate-400')}>{d < 0 ? 'Closed' : `${d}d left`}</p>
          </div>
        );
      },
    },
    { key: 'elig', label: 'Eligibility (Indicative)', sortVal: (t: Tender) => eligibilityStatus(t, contractorProfile), render: (t: Tender) => <StatusBadge status={eligibilityStatus(t, contractorProfile)} /> },
    { key: 'status', label: 'Status', render: () => <StatusBadge status="Open" /> },
    {
      key: 'action',
      label: 'Action',
      render: (t: Tender) => (
        <div className="flex items-center gap-1.5">
          <Link to={`/tenders/${t.id}`} className="btn btn-secondary btn-sm">
            View
          </Link>
          {t.status === 'Open' && eligibilityStatus(t, contractorProfile) !== 'Not Eligible' && (
            <Link to={`/tenders/${t.id}/bid`} className="btn btn-primary btn-sm">
              Start Bid
            </Link>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => toggleSave(t)} aria-label={savedTenders.includes(t.id) ? 'Unsave tender' : 'Save tender'}>
            {savedTenders.includes(t.id) ? <BookmarkCheck className="w-4 h-4 text-blue-700 dark:text-blue-400" /> : <Bookmark className="w-4 h-4" />}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 lg:p-6 lg:py-8 max-w-[1600px] mx-auto space-y-5">
      <PageHeader
        title="Tender Management"
        subtitle="Government of Maharashtra procurement marketplace — discover, evaluate and bid for works"
      />

      <Card className="overflow-hidden">
        <Tabs
          tabs={[
            { key: 'open', label: 'Open Tenders', count: tenders.filter((t) => t.status === 'Open').length },
            { key: 'saved', label: 'Saved', count: saved.length },
            { key: 'bids', label: 'My Bids', count: myBidRows.length },
            { key: 'past', label: 'Past Bids', count: pastBidRows.length },
          ]}
          active={tab}
          onChange={setTab}
        />

        {tab === 'open' && (
          <>
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3 border-b border-slate-100 dark:border-slate-800">
              <SearchInput value={q} onChange={setQ} placeholder="Search tender or department…" className="xl:col-span-2" />
              <Select value={dept} onChange={setDept} options={DEPTS.map((v) => ({ value: v, label: v === 'All Departments' ? v : v.replace('Maharashtra Jeevan Pradhikaran', 'MJP') }))} />
              <Select value={loc} onChange={setLoc} options={LOCS.map((v) => ({ value: v, label: v }))} />
              <Select value={cat} onChange={setCat} options={CATS.map((v) => ({ value: v, label: v }))} />
              <Select
                value={minVal}
                onChange={setMinVal}
                options={['Any Value', '5', '15', '25', '50'].map((v) => ({ value: v, label: v === 'Any Value' ? v : `Min ₹${v} Cr` }))}
              />
            </div>
            <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Indicative eligibility:</span>
              {['All', 'Eligible', 'Review', 'Not Eligible'].map((e) => (
                <button key={e} className={cls('pill px-2.5 py-1', elig === e ? 'pill-active' : 'pill-idle')} onClick={() => setElig(e)}>
                  {e}
                </button>
              ))}
            </div>
            <DataTable columns={tenderCols} rows={openFiltered} empty={<EmptyState title="No tenders match your filters" msg="Clear the search or widen eligibility and value filters." />} />
          </>
        )}

        {tab === 'saved' && (
          <DataTable
            columns={tenderCols}
            rows={saved}
            
            empty={
              <EmptyState
                title="No saved tenders"
                msg="Bookmark interesting tenders from the Open Tenders tab to track them here."
              />
            }
          />
        )}

        {tab === 'bids' && (
          <DataTable

            columns={[
              {
                key: 'tender',
                label: 'Tender',
                render: (r: MyBidRow) => (
                  <div className="">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{r.title}</p>
                    <p className="text-[11px] text-slate-500 font-medium dark:text-slate-400">{r.code}</p>
                  </div>
                ),
              },
              { key: 'ref', label: 'Bid Reference', render: (r: MyBidRow) => (r.ref ? <span className="text-xs font-bold font-mono">{r.ref}</span> : <span className="text-xs text-slate-400">— (draft)</span>) },
              // bidValue is already ₹ Cr (see MyBidRow) — display it directly.
              { key: 'value', label: 'Bid Value', render: (r: MyBidRow) => <span className="text-xs font-bold tabular-nums">{r.bidValue != null ? cr(r.bidValue) : '—'}</span> },
              { key: 'updated', label: 'Last Activity', sortVal: (r: MyBidRow) => r.updatedAt, render: (r: MyBidRow) => <span className="text-xs">{r.updatedAt ? timeAgo(r.updatedAt) : '—'}</span> },
              { key: 'status', label: 'Stage', render: (r: MyBidRow) => <StatusBadge status={r.status} /> },
              {
                key: 'action',
                label: 'Action',
                render: (r: MyBidRow) =>
                  r.status === 'Draft' ? (
                    <div className="flex gap-1.5">
                      <Link to={`/tenders/${r.tenderId}/bid`} className="btn btn-primary btn-sm">
                        Continue <ArrowRight className="w-3 h-3" />
                      </Link>
                      <Link to={`/tenders/${r.tenderId}/bid/ai-assist`} className="btn btn-secondary btn-sm">
                        AI Check
                      </Link>
                    </div>
                  ) : (
                    <div className="flex gap-1.5">
                      <Link to={`/tenders/${r.tenderId}`} className="btn btn-secondary btn-sm">
                        View Tender
                      </Link>
                      {r.serverStatus === 'SUBMITTED' && r.serverId && (
                        <button
                          className="btn btn-secondary btn-sm"
                          disabled={withdrawingId === r.serverId}
                          onClick={() => void handleWithdraw(r)}
                        >
                          {withdrawingId === r.serverId ? 'Withdrawing…' : 'Withdraw'}
                        </button>
                      )}
                    </div>
                  ),
              },
            ]}
            rows={myBidRows}
            empty={<EmptyState title="No bids yet" msg="Start a bid from the Open Tenders tab. Drafts are saved automatically." />}
          />
        )}

        {tab === 'past' && (
          <DataTable

            columns={[
              { key: 'tender', label: 'Tender', render: (r: MyBidRow) => <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{r.title}</span> },
              { key: 'code', label: 'Tender No.', render: (r: MyBidRow) => <span className="text-xs font-semibold">{r.code || '—'}</span> },
              { key: 'ref', label: 'Bid Reference', render: (r: MyBidRow) => (r.ref ? <span className="text-xs font-bold font-mono">{r.ref}</span> : <span className="text-xs text-slate-400">—</span>) },
              // bidValue is already ₹ Cr — display directly, no rescaling.
              { key: 'value', label: 'Bid Value', sortVal: (r: MyBidRow) => r.bidValue ?? 0, render: (r: MyBidRow) => <span className="text-xs font-bold tabular-nums">{r.bidValue != null ? cr(r.bidValue) : '—'}</span> },
              { key: 'outcome', label: 'Outcome', sortVal: (r: MyBidRow) => r.status, render: (r: MyBidRow) => <StatusBadge status={r.status} /> },
              { key: 'date', label: 'Submitted', sortVal: (r: MyBidRow) => r.submittedAt || r.updatedAt, render: (r: MyBidRow) => <span className="text-xs">{r.submittedAt ? fmtDate(r.submittedAt) : r.updatedAt ? fmtDate(r.updatedAt) : '—'}</span> },
            ]}
            rows={pastBidRows}
            empty={<EmptyState title="No past bids" msg="Bids that are selected, rejected or withdrawn will appear here." />}
          />
        )}
      </Card>
    </div>
  );
}
