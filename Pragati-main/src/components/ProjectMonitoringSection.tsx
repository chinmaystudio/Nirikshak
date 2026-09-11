import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';

export const ProjectMonitoringSection: React.FC = () => {
  const [verificationMode, setVerificationMode] = useState<'drone' | 'satellite' | 'sensor'>('drone');

  const monitoringCards = [
    { title: 'Milestones', count: '100% Traceable', desc: 'Critical path milestone tracking with CPM/PERT automated variance recalculation.' },
    { title: 'Progress Updates', count: 'Daily DPR Verification', desc: 'Mandatory daily digital geo-tagged submissions with equipment & manpower logs.' },
    { title: 'Resources', count: 'Equipment Telemetry', desc: 'GPS-tracked heavy earthmovers, concrete batching plants, and skilled workforce.' },
    { title: 'Materials', count: 'Batch Lab Certs', desc: 'Automated test certificate reconciliation for cement, steel rebars, and aggregates.' },
    { title: 'Compliance', count: 'Statutory Permits', desc: 'Right-of-Way clearance logs, forest permits, utility shifting approvals, and safety audits.' }
  ];

  return (
    <section id="monitoring-section" className="py-20 bg-transparent text-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-12">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>Ground Truth Telemetry Architecture</span>
          </div>
          <h2 className="text-4xl sm:text-6xl font-extrabold text-white font-display tracking-tight leading-tight">
            See What Is Actually Happening.
          </h2>
          <p className="text-base sm:text-lg text-slate-200 mt-3 leading-relaxed">
            Track milestones, digital progress submissions, resources, materials, and contract compliance through a single project view.
          </p>
        </div>

        {/* Plain Text Metrics Spread (No cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 mb-14 pb-10 border-b border-white/15">
          {monitoringCards.map((card, idx) => (
            <div key={idx} className="pt-3 border-t border-white/20">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-1">
                {card.title}
              </div>
              <div className="text-xl font-extrabold text-white font-display mb-2">
                {card.count}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {card.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Plain Text Verification Deep Dive (No cards) */}
        <div>
          <div className="flex flex-col lg:flex-row items-start lg:items-end justify-between gap-6 pb-6 border-b border-white/10 mb-8">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-1">
                AI Progress Verification Protocol
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-white font-display">
                Compare submitted progress with available project evidence before accepting reported completion.
              </h3>
              <p className="text-sm text-slate-300 mt-2 max-w-2xl leading-relaxed">
                Prevents premature billing and Measurement Book inflation by comparing contractor claims against volumetric drone models and satellite sensors.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {[
                { id: 'drone', label: 'UAV Drone' },
                { id: 'satellite', label: 'SAR Satellite' },
                { id: 'sensor', label: 'IoT Batching' }
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setVerificationMode(m.id as any)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    verificationMode === m.id
                      ? 'bg-[#eefc55] text-neutral-950 font-extrabold'
                      : 'bg-transparent text-slate-300 hover:text-white border border-white/20'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="pt-3 border-t border-white/20">
              <div className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">
                Telemetry Mode
              </div>
              <div className="text-lg font-bold text-white mb-2">
                {verificationMode === 'drone' ? 'High-Resolution 3D Drone Orthomosaics' : verificationMode === 'satellite' ? 'Synthetic Aperture Radar (SAR) Ground Scans' : 'Automated Plant SCADA / IoT Telemetry'}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Autonomous algorithmic calculation of physical cubic meters executed vs contractual specifications.
              </p>
            </div>

            <div className="pt-3 border-t border-white/20">
              <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
                Measurement Book Protection
              </div>
              <div className="text-lg font-bold text-white mb-2">
                Zero Over-Claim Verification
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Digital e-MB locked until multi-spectral sensor verification confirms reported layer completion.
              </p>
            </div>

            <div className="pt-3 border-t border-white/20">
              <div className="text-xs font-bold text-[#eefc55] uppercase tracking-wider mb-1">
                Officer Authority
              </div>
              <div className="text-lg font-bold text-white mb-2">
                100% Signed Approval
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Engineer-in-Charge conducts final physical inspection before releasing milestone certificate.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
