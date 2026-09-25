import React from 'react';
import { AI_ENGINES } from '../data/platformFeatures';
import { CheckCircle2 } from 'lucide-react';

export const AIIntelligenceSection: React.FC = () => {
  return (
    <section id="ai-framework-section" className="py-20 bg-transparent text-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-14">
          <span className="text-xs font-bold uppercase tracking-widest text-amber-400 font-display">
            ✦ ASSISTED DECISION ARCHITECTURE
          </span>
          <h2 className="text-4xl sm:text-6xl font-extrabold text-white font-display tracking-tight mt-2 mb-4 leading-tight">
            AI That Assists.<br />
            <span className="text-[#eefc55]">Government That Decides.</span>
          </h2>
          <p className="text-lg text-slate-300 leading-relaxed">
            PRAGATI applies algorithmic intelligence across multi-source project data while keeping designated government officers at the center of every legal and financial decision.
          </p>
        </div>

        {/* 3 Plain Text Architecture Columns (No card containers) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 pb-16 border-b border-white/15">
          {/* 01 — DATA */}
          <div>
            <div className="text-xs font-mono font-bold text-amber-400 mb-2">
              01 / EVIDENCE INGESTION
            </div>
            <h3 className="text-2xl font-bold text-white mb-3 font-display">
              Project Evidence Layer
            </h3>
            <p className="text-sm text-slate-300 mb-4 leading-relaxed">
              Multi-source authoritative telemetry ingested across tamper-evident feeds:
            </p>
            <div className="space-y-2.5">
              {[
                'Tender data & pre-bid specifications',
                'Contract agreements & clause baselines',
                'Site telemetry (drone UAV surveys, IoT, geotagged photos)',
                'Financial data (RA bills, escrows, e-invoices)',
                'Historical contractor delivery performance records'
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-slate-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 text-xs text-slate-400">
              Zero manual tampering • Tamper-evident digital ledger
            </div>
          </div>

          {/* 02 — AI */}
          <div>
            <div className="text-xs font-mono font-bold text-[#eefc55] mb-2">
              02 / ALGORITHMIC ANALYSIS
            </div>
            <h3 className="text-2xl font-bold text-white mb-3 font-display">
              AI Intelligence Layer
            </h3>
            <p className="text-sm text-slate-300 mb-4 leading-relaxed">
              6 flagship predictive engines generating objective evidence-based assessments:
            </p>
            <div className="space-y-3">
              {[
                { name: 'Contractor Intelligence', role: 'Pre-award capacity & liquidity risk analysis' },
                { name: 'Progress Verification', role: 'Survey-grade drone photogrammetry vs reported MB' },
                { name: 'Delay Prediction', role: '60-day critical path forecasting & weather simulation' },
                { name: 'Risk Prediction', role: 'Cost overrun & material shortage alerts' },
                { name: 'Claim Analysis', role: 'Contractual liability & time-impact triage' }
              ].map((engine, idx) => (
                <div key={idx} className="border-l-2 border-amber-400/60 pl-3">
                  <div className="text-xs font-bold text-amber-400">{engine.name}</div>
                  <div className="text-xs text-slate-300">{engine.role}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 03 — DECISION */}
          <div>
            <div className="text-xs font-mono font-bold text-emerald-400 mb-2">
              03 / CONSTITUTIONAL AUTHORITY
            </div>
            <h3 className="text-2xl font-bold text-white mb-3 font-display">
              Human Approval Layer
            </h3>
            <p className="text-sm text-slate-300 mb-4 leading-relaxed">
              Strict constitutional delegation: algorithms provide mathematical evidence; officers sign sanctions:
            </p>
            <div className="space-y-2 text-xs text-slate-200">
              <div className="flex items-center justify-between py-1 border-b border-white/10">
                <span className="font-bold text-white">1. Evidence</span>
                <span className="text-slate-400">Multi-source data captured</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-white/10">
                <span className="font-bold text-white">2. AI Recommendation</span>
                <span className="text-slate-400">Objective risk calculation</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-white/10">
                <span className="font-bold text-white">3. Government Review</span>
                <span className="text-slate-400">Officer examination &amp; audit</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-white/10">
                <span className="font-bold text-white">4. Approval</span>
                <span className="text-slate-400">Digital signature sanction</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-white/10">
                <span className="font-bold text-white">5. Action</span>
                <span className="text-slate-400">Treasury fund release or notice</span>
              </div>
            </div>
            <div className="mt-6 text-xs font-bold text-emerald-400">
              🛡️ 100% Officer Accountability Maintained
            </div>
          </div>
        </div>

        {/* 6 Plain Text Engines Breakdown (No card boxes) */}
        <div className="pt-14">
          <div className="mb-8">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
              ✦ CORE PREDICTIVE ENGINES
            </span>
            <h3 className="text-3xl font-extrabold text-white font-display mt-1">
              The 6 Flagship Intelligence Engines
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {AI_ENGINES.map((e) => (
              <div key={e.id} className="pt-4 border-t border-white/20">
                <div className="text-xs font-mono font-bold text-[#eefc55] mb-1">
                  {e.id} DECISION ENGINE
                </div>
                <h4 className="text-xl font-bold text-white mb-1">
                  {e.title}
                </h4>
                <div className="text-xs font-bold uppercase text-amber-400 tracking-wider mb-2">
                  {e.subtitle}
                </div>
                <p className="text-sm text-slate-300 leading-relaxed mb-3">
                  {e.desc}
                </p>
                <div className="text-xs font-semibold text-emerald-400">
                  ✦ Standard: {e.metric}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
