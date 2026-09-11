import React from 'react';
import { ArrowRight } from 'lucide-react';

interface MainIntroSectionProps {
  onExploreLifecycle: () => void;
  onExploreAI: () => void;
}

export const MainIntroSection: React.FC<MainIntroSectionProps> = ({
  onExploreLifecycle,
  onExploreAI
}) => {
  return (
    <section id="main-intro-section" className="py-20 bg-transparent text-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-4">
          <span className="text-xs font-bold uppercase tracking-widest text-amber-400 font-display">
            ✦ GOVERNANCE ↔ CONTRACTOR SYNCHRONIZATION
          </span>
        </div>

        <div className="mb-14 max-w-5xl">
          <h2 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-white font-display tracking-tight leading-[1.08] mb-6">
            One Project.<br />One Connected Record.
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-slate-200 text-base sm:text-lg leading-relaxed">
            <p className="font-medium text-white">
              PRAGATI brings tender information, contractor performance, contracts, site progress, financial activity, risks, claims, and completion records into a single digital project lifecycle.
            </p>
            <p className="text-slate-300">
              Instead of managing isolated stages, government officers can follow the complete journey of a project — from selection and execution to verification, payment, risk prediction, and resolution.
            </p>
          </div>
        </div>

        {/* 3 Plain Text Feature Columns (No card boxes) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 my-12 border-t border-white/20 pt-10">
          <div className="flex flex-col justify-between">
            <div>
              <div className="text-5xl sm:text-6xl font-black font-display text-[#eefc55] mb-2">
                10
              </div>
              <h3 className="text-2xl font-bold text-white mb-2 font-display">
                Lifecycle Stages
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed mb-4">
                Structured execution pipeline from Notice Inviting Bid to Institutional Knowledge feedback.
              </p>
              <div className="text-xs font-semibold text-amber-400">
                Tender → Select → Contract → Execute → Monitor → Verify → Pay → Predict → Resolve → Learn
              </div>
            </div>
            <button
              onClick={onExploreLifecycle}
              className="inline-flex items-center gap-2 mt-6 text-xs font-bold text-[#eefc55] hover:text-white transition-colors cursor-pointer"
            >
              <span>Explore 10-Stage Pipeline</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col justify-between">
            <div>
              <div className="text-5xl sm:text-6xl font-black font-display text-amber-400 mb-2">
                06
              </div>
              <h3 className="text-2xl font-bold text-white mb-2 font-display">
                AI Decision Engines
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed mb-4">
                Autonomous algorithmic verification cross-referencing satellite telemetry, UAV drone surveys, and digitized clauses.
              </p>
              <div className="text-xs font-semibold text-slate-200">
                Contractor Capacity • Drone Verification • 60-Day Delay Forecast • Fault Matrix • Claim Analysis • Cost Overrun Alerts
              </div>
            </div>
            <button
              onClick={onExploreAI}
              className="inline-flex items-center gap-2 mt-6 text-xs font-bold text-amber-400 hover:text-white transition-colors cursor-pointer"
            >
              <span>Explore Decision Engines</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col justify-between">
            <div>
              <div className="text-5xl sm:text-6xl font-black font-display text-white mb-2">
                100%
              </div>
              <h3 className="text-2xl font-bold text-white mb-2 font-display">
                Officer Accountability
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed mb-4">
                Strict constitutional human-in-the-loop governance: AI computes objective recommendations; designated government officers retain sole statutory sanctioning authority.
              </p>
              <div className="text-xs font-semibold text-emerald-400">
                Evidence Captured → AI Recommendation → Officer Examination → Digital Signature → Treasury Fund Release
              </div>
            </div>
            <div className="mt-6 text-xs font-bold text-slate-400">
              Zero-Tamper Digital Audit Trail
            </div>
          </div>
        </div>

        {/* Plain Text Metrics Spread (No card box) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pt-10 border-t border-white/20">
          <div>
            <div className="text-3xl sm:text-4xl font-extrabold text-[#eefc55] font-display mb-1">
              10
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Pipeline Stages
            </div>
            <div className="text-xs text-slate-300 mt-1">
              From tender issuance to post-completion learning
            </div>
          </div>

          <div>
            <div className="text-3xl sm:text-4xl font-extrabold text-white font-display mb-1">
              06
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
              AI Decision Engines
            </div>
            <div className="text-xs text-slate-300 mt-1">
              Evidence verification &amp; Bayesian risk models
            </div>
          </div>

          <div>
            <div className="text-3xl sm:text-4xl font-extrabold text-[#eefc55] font-display mb-1">
              Human + AI
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Decision Protocol
            </div>
            <div className="text-xs text-slate-300 mt-1">
              Officer retains constitutional sanctioning authority
            </div>
          </div>

          <div>
            <div className="text-3xl sm:text-4xl font-extrabold text-white font-display mb-1">
              Zero-Trust
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Audit Standard
            </div>
            <div className="text-xs text-slate-300 mt-1">
              Standard operating procedure across all ministries
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
