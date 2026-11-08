import React, { useEffect, useState } from 'react';
import { supabase } from '@/core/supabase/client';
import { Database, Activity, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

interface LiveMetrics {
  projectsMonitored: number;
  activeProjects: number;
  verifiedProgressUpdates: number;
  openPublicIssues: number;
  lastUpdated: string;
}

export const ReportsSection: React.FC = () => {
  // DF-11: metrics exist only after a successful query — no hard-coded
  // starting numbers.
  const [metrics, setMetrics] = useState<LiveMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchLiveMetrics = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const [totalRes, activeRes, verifiedRes, complaintsRes] = await Promise.all([
        supabase.from('public_projects_view').select('id', { count: 'exact', head: true }),
        supabase.from('public_projects_view').select('id', { count: 'exact', head: true }).neq('normalized_status', 'COMPLETED'),
        supabase.from('public_projects_view').select('id', { count: 'exact', head: true }).eq('current_status_verified', true),
        // Open public issues: public complaints view, excluding resolved/closed.
        supabase.from('public_complaints_view' as any).select('id', { count: 'exact', head: true }).not('status', 'in', '("RESOLVED","CLOSED")')
      ]);

      const failed = [totalRes, activeRes, verifiedRes, complaintsRes].find((r: any) => r.error);
      if (failed) throw (failed as any).error;

      setMetrics({
        projectsMonitored: totalRes.count ?? 0,
        activeProjects: activeRes.count ?? 0,
        verifiedProgressUpdates: verifiedRes.count ?? 0,
        openPublicIssues: (complaintsRes as any).count ?? 0,
        lastUpdated: new Date().toLocaleDateString('en-IN', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        })
      });
    } catch (err) {
      console.error('Failed to fetch live Supabase metrics:', err);
      setLoadError('Live metrics could not be loaded right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveMetrics();
  }, []);

  const fmt = (n: number | undefined): string =>
    metrics && n != null ? n.toLocaleString('en-IN') : '—';

  const stats = [
    {
      label: 'PROJECTS MONITORED',
      value: fmt(metrics?.projectsMonitored),
      desc: 'Total public infrastructure projects cataloged across state and central jurisdictions.',
      icon: Database,
      color: 'text-[#eefc55]'
    },
    {
      label: 'ACTIVE PROJECTS',
      value: fmt(metrics?.activeProjects),
      desc: 'Ongoing works currently in planning, tendering, or active site execution.',
      icon: Activity,
      color: 'text-white'
    },
    {
      label: 'VERIFIED PROGRESS UPDATES',
      value: fmt(metrics?.verifiedProgressUpdates),
      desc: 'Milestone submissions formally inspected and certified by designated government officers.',
      icon: CheckCircle2,
      color: 'text-emerald-400'
    },
    {
      label: 'OPEN PUBLIC ISSUES',
      value: fmt(metrics?.openPublicIssues),
      desc: 'Citizen ground complaints currently being processed through government redressal.',
      icon: AlertCircle,
      color: 'text-amber-400'
    }
  ];

  return (
    <section id="reports-section" className="min-h-screen py-24 bg-gradient-to-r from-neutral-950/90 via-neutral-950/60 to-transparent text-white relative flex flex-col justify-center">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-14">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-400 mb-2 font-display">
              <Database className="w-4 h-4 text-amber-400" />
              <span>LIVE DATABASE TELEMETRY</span>
            </div>
            <h2 className="text-4xl sm:text-6xl font-extrabold text-white font-display tracking-tight leading-tight">
              Live counts, <br />
              <span className="text-[#eefc55]">queried on page load.</span>
            </h2>
            <p className="text-base sm:text-lg text-slate-200 mt-3 leading-relaxed">
              Every count below is queried directly from active NIRIKSHAK PostgreSQL tables when this page loads.
            </p>
            {loadError ? <p className="text-sm text-red-300 mt-2">{loadError}</p> : null}
          </div>

          <button
            onClick={fetchLiveMetrics}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-semibold text-slate-200 self-start md:self-auto transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Refreshing...' : 'Refresh Live DB'}</span>
          </button>
        </div>

        {/* 4 Large Metric Blocks */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {stats.map((st, idx) => (
            <div
              key={idx}
              className="p-8 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-sm relative flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
                    {st.label}
                  </span>
                  <st.icon className="w-4 h-4 text-slate-400" />
                </div>
                <div className={`text-5xl sm:text-6xl font-black font-display tracking-tight mb-2 ${st.color}`}>
                  {st.value}
                </div>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed pt-3 border-t border-white/10 mt-2">
                {st.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Database Origin & Verification Metadata */}
        <div className="p-6 rounded-2xl bg-black/50 border border-white/10 backdrop-blur-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6 text-xs text-slate-300">
          <div className="space-y-1">
            <div>
              <span className="text-slate-400 font-medium">Data Source: </span>
              <span className="font-mono text-white font-bold">NIRIKSHAK PostgreSQL</span>
            </div>
            <div>
              <span className="text-slate-400 font-medium">Verification Model: </span>
              <span className="text-[#eefc55] font-semibold">Government / Public projection</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <div>
              <span className="text-slate-400">Last Synced: </span>
              <span className="font-mono text-white font-bold">{metrics?.lastUpdated ?? '—'}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
