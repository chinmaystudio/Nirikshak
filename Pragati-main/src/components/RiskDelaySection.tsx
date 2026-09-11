import React from 'react';
import { AlertTriangle } from 'lucide-react';

export const RiskDelaySection: React.FC = () => {
  const riskCards = [
    { title: 'Delay Risk Score', desc: 'Predictive score calculating likelihood of missing national completion deadlines.' },
    { title: 'Early Warning System', desc: 'Automated 60-day advance alert notifications sent to Project Director and Secretary.' },
    { title: 'Delay Responsibility', desc: 'Determines whether delays stem from Land RoW handover or contractor plant shortfall.' },
    { title: 'Resource Shortage Prediction', desc: 'Tracks concrete batching volumes, skilled operator count, and cement delivery delays.' },
    { title: 'Extension Analysis', desc: 'Mathematical evaluation of Extension of Time (EoT) applications using weather & site logs.' }
  ];

  return (
    <section id="risk-section" className="py-20 bg-transparent text-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-12">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-400 mb-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>Critical Path Diagnostics</span>
          </div>
          <h2 className="text-4xl sm:text-6xl font-extrabold text-white font-display tracking-tight leading-tight">
            Predict Before Delay Becomes Crisis.
          </h2>
          <p className="text-base sm:text-lg text-slate-200 mt-3 leading-relaxed">
            Identify bottlenecks months before they derail completion timelines. AI cross-examines contractor inputs, weather data, and bureaucratic approvals to pinpoint risk.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 pt-4 border-t border-white/15">
          <div className="lg:col-span-7 space-y-6">
            {riskCards.map((card, idx) => (
              <div key={idx} className="pt-3 border-t border-white/20">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-xs font-mono font-bold text-amber-400">
                    0{idx + 1}
                  </span>
                  <h3 className="text-lg font-bold text-white font-display">
                    {card.title}
                  </h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed pl-7">
                  {card.desc}
                </p>
              </div>
            ))}
          </div>

          <div className="lg:col-span-5 space-y-8 pt-3 border-t border-white/20">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
                Critical Path Bottleneck Forecasting
              </div>
              <p className="text-sm text-slate-200 leading-relaxed">
                Continuous simulation models correlate weather trends, material delivery schedules, and equipment saturation against baseline CPM schedules to identify slippage 60–90 days before milestone deadlines.
              </p>
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-[#eefc55] mb-2">
                Impartial Responsibility Partitioning
              </div>
              <p className="text-sm text-slate-200 leading-relaxed">
                Distinguishes contractor-side obligations (plant shortages, labour deficits, execution delays) from employer-side obligations (Right-of-Way handover, forest clearances, utility shifting approvals) with statutory audit precision.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
