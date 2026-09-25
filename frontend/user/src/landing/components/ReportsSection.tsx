import React, { useState } from 'react';
import { Download, BarChart2, PieChart, ShieldAlert, Users, Layers } from 'lucide-react';

export const ReportsSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'executive' | 'project' | 'financial' | 'risk' | 'contractor'>('executive');
  const [levelView, setLevelView] = useState<'national' | 'department' | 'state' | 'project'>('national');
  const [downloadNotice, setDownloadNotice] = useState(false);

  const handleDownload = () => {
    setDownloadNotice(true);
    setTimeout(() => setDownloadNotice(false), 3000);
  };

  return (
    <section id="reports-section" className="py-20 bg-transparent text-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
              Standardized Public Disclosures
            </div>
            <h2 className="text-4xl sm:text-6xl font-extrabold text-white font-display tracking-tight leading-tight">
              Reports &amp; Analytics
            </h2>
            <p className="text-base sm:text-lg text-slate-200 mt-3 leading-relaxed">
              Consolidated real-time reporting across all public infrastructure portfolios. Download certified audit dockets and executive summaries.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold">
            {(['national', 'department', 'state', 'project'] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setLevelView(lvl)}
                className={`px-3 py-1.5 rounded-full capitalize transition-all cursor-pointer ${
                  levelView === lvl
                    ? 'bg-[#eefc55] text-neutral-950 font-bold'
                    : 'text-slate-300 hover:text-white border border-white/20'
                }`}
              >
                {lvl} View
              </button>
            ))}
          </div>
        </div>

        {/* Tab Selection (Plain text tabs) */}
        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-3 mb-8 border-b border-white/15">
          {[
            { id: 'executive', label: 'Executive Dashboard', icon: BarChart2 },
            { id: 'project', label: 'Project Reports', icon: Layers },
            { id: 'financial', label: 'Financial Reports', icon: PieChart },
            { id: 'risk', label: 'Risk Reports', icon: ShieldAlert },
            { id: 'contractor', label: 'Contractor Reports', icon: Users }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-bold shrink-0 transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-[#eefc55] text-neutral-950 font-bold'
                  : 'text-slate-300 hover:text-white border border-white/20'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content (Plain text layout) */}
        <div className="pt-4">
          {activeTab === 'executive' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 pb-8 border-b border-white/15">
                <div className="pt-3 border-t border-white/20">
                  <div className="text-xs uppercase text-amber-400 font-bold">Total Monitored Capex</div>
                  <div className="text-2xl font-extrabold text-white font-display mt-1">Portfolio Scale</div>
                  <div className="text-xs text-emerald-400 font-semibold mt-1">Multi-Ministry National Pipeline</div>
                </div>

                <div className="pt-3 border-t border-white/20">
                  <div className="text-xs uppercase text-amber-400 font-bold">Schedule Variance Tracking</div>
                  <div className="text-2xl font-extrabold text-white font-display mt-1">Continuous Audit</div>
                  <div className="text-xs text-slate-300 mt-1">S-Curve CPM/PERT Comparison</div>
                </div>

                <div className="pt-3 border-t border-white/20">
                  <div className="text-xs uppercase text-amber-400 font-bold">Critical Risk Diagnostics</div>
                  <div className="text-2xl font-extrabold text-rose-400 font-display mt-1">Early Warnings</div>
                  <div className="text-xs text-rose-300 mt-1">60-Day Prior Bottle-neck Alerts</div>
                </div>

                <div className="pt-3 border-t border-white/20">
                  <div className="text-xs uppercase text-amber-400 font-bold">Verified Bill Sanctions</div>
                  <div className="text-2xl font-extrabold text-white font-display mt-1">Milestone Linked</div>
                  <div className="text-xs text-emerald-400 font-semibold mt-1">Satellite &amp; Drone Authenticated</div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div>
                  <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-widest">
                    National Executive Summary • {levelView.toUpperCase()} LEVEL
                  </span>
                  <h3 className="text-2xl font-bold font-display text-white mt-1">
                    Quarterly Infrastructure Performance Index Framework
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
                    Comprehensive synthesis of physical milestone delivery, expenditure reconciliation, and AI risk forecasts submitted to Cabinet Secretariat.
                  </p>
                </div>

                <div className="shrink-0 flex flex-col items-start md:items-end gap-2">
                  <button
                    onClick={handleDownload}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#eefc55] text-neutral-950 text-xs font-extrabold hover:bg-white transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Executive Docket (PDF)</span>
                  </button>
                  {downloadNotice && (
                    <span className="text-xs font-bold text-emerald-400">
                      ✓ Generating official certified summary...
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab !== 'executive' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="pt-3 border-t border-white/20">
                <h3 className="text-lg font-bold text-white font-display mb-2">Project Status Framework</h3>
                <p className="text-xs text-slate-300 mb-4">Complete breakdown of Active, Delayed, High-Value, and Completed works across all state departments.</p>
                <div className="text-xs font-bold text-amber-400">Status Matrix Architecture →</div>
              </div>

              <div className="pt-3 border-t border-white/20">
                <h3 className="text-lg font-bold text-white font-display mb-2">Milestone Progress Reports</h3>
                <p className="text-xs text-slate-300 mb-4">Audited timeline performance against approved CPM/PERT baseline schedules.</p>
                <div className="text-xs font-bold text-amber-400">Milestone Graph Generation →</div>
              </div>

              <div className="pt-3 border-t border-white/20">
                <h3 className="text-lg font-bold text-white font-display mb-2">Commissioning &amp; Handover</h3>
                <p className="text-xs text-slate-300 mb-4">Formal handover dockets, defect liability punch lists, and operational commissioning records.</p>
                <div className="text-xs font-bold text-amber-400">Commissioning Certificates →</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
