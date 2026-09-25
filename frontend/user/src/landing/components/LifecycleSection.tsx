import React, { useState } from 'react';
import { LIFECYCLE_STAGES } from '../data/platformFeatures';
import { LifecycleStageInfo } from '../types';

export const LifecycleSection: React.FC = () => {
  const [selectedStage, setSelectedStage] = useState<LifecycleStageInfo>(LIFECYCLE_STAGES[0]);

  return (
    <section id="lifecycle-section" className="py-20 bg-transparent text-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-3xl mb-10">
          <span className="text-xs font-bold uppercase tracking-widest text-amber-400 font-display">
            ✦ CONTINUOUS GOVERNANCE PIPELINE
          </span>
          <h2 className="text-4xl sm:text-6xl font-extrabold text-white font-display tracking-tight mt-2 mb-3">
            The 10-Stage Project Lifecycle
          </h2>
          <p className="text-lg text-slate-300">
            One continuous journey from tender to completion with verified evidence at each step.
          </p>
        </div>

        {/* 10-Stage Interactive Plain Text Switcher (No card containers) */}
        <div className="mb-10 pb-6 border-b border-white/15">
          <div className="flex flex-wrap gap-2 sm:gap-3">
            {LIFECYCLE_STAGES.map((stage) => {
              const isSelected = selectedStage.step === stage.step;
              return (
                <button
                  key={stage.step}
                  id={`lifecycle-step-btn-${stage.step}`}
                  onClick={() => setSelectedStage(stage)}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? 'bg-[#eefc55] text-neutral-950 shadow-md font-extrabold scale-105'
                      : 'bg-transparent text-slate-300 hover:text-white border border-white/20 hover:border-amber-400'
                  }`}
                >
                  {stage.step} {stage.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Stage Plain Text Details (3 columns, NO card boxes) */}
        <div>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/10 mb-8">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-1">
                STAGE {selectedStage.step} — {selectedStage.name}
              </div>
              <h3 className="text-3xl sm:text-4xl font-extrabold text-white font-display">
                {selectedStage.title}
              </h3>
            </div>
            <div className="max-w-md text-sm text-slate-200 leading-relaxed">
              <strong className="text-[#eefc55]">Core Mandate: </strong>
              {selectedStage.objective}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="pt-4 border-t-2 border-blue-500">
              <div className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-3">
                🏛️ Government Oversight Action
              </div>
              <p className="text-sm text-slate-200 leading-relaxed mb-4">
                {selectedStage.governmentAction}
              </p>
              <div className="text-xs text-slate-400 font-semibold">
                Standard Administrative Procedure
              </div>
            </div>

            <div className="pt-4 border-t-2 border-emerald-500">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3">
                ⛑️ Contractor Obligation &amp; Submission
              </div>
              <p className="text-sm text-slate-200 leading-relaxed mb-4">
                {selectedStage.contractorAction}
              </p>
              <div className="text-xs text-slate-400 font-semibold">
                Concessionaire Milestone Deliverable
              </div>
            </div>

            <div className="pt-4 border-t-2 border-amber-400">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-3">
                🧠 AI Algorithmic Verification
              </div>
              <p className="text-sm text-slate-200 leading-relaxed mb-4">
                {selectedStage.aiVerification}
              </p>
              <div className="text-xs text-amber-300 font-semibold">
                Autonomous Discrepancy Cross-Check
              </div>
            </div>
          </div>

          {/* Certified Outputs */}
          <div className="mt-10 pt-6 border-t border-dashed border-white/20 flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              ✓ Certified Artifacts:
            </span>
            {selectedStage.outputs.map((out, idx) => (
              <span
                key={idx}
                className="text-xs text-slate-200 px-3 py-1 rounded-full bg-white/10 border border-white/20"
              >
                ✓ {out}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
