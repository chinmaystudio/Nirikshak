import React, { useState } from 'react';
import { ShieldCheck, ArrowRight } from 'lucide-react';

export const ContractorIntelligenceSection: React.FC = () => {
  const [activeDimension, setActiveDimension] = useState(0);

  const dimensions = [
    {
      id: 'DIM-01',
      title: 'Contractor Performance Score',
      category: 'Delivery & Quality Index',
      metricDescription: 'Normalized score (0-100) combining physical milestone speed, structural quality lab reports, and handover punctuality.',
      algorithm: 'Weighted multi-factor score: 40% Milestone Adherence + 30% Third-Party Quality Tests + 20% Financial Billing Discipline + 10% Safety Audit.',
      governanceValue: 'Eliminates subjective officer appraisals with standardized empirical track records across all central and state agencies.'
    },
    {
      id: 'DIM-02',
      title: 'Contractor Benchmarking & Grading',
      category: 'Prequalification Registry',
      metricDescription: 'Dynamic peer comparison against all registered concessionaires across CPWD, NHAI, Railways, and state PWDs.',
      algorithm: 'Percentile-based normalization factoring in complexity tier, project scale (₹500 Cr+ vs ₹5,000 Cr+), and geological terrain difficulty.',
      governanceValue: 'Ensures bids are evaluated against contractors operating under comparable technical and geographical constraints.'
    },
    {
      id: 'DIM-03',
      title: 'Bid vs Actual Variance Index',
      category: 'Cost & Price Integrity',
      metricDescription: 'Historic variance between the initial financial bid submission and the ultimate completed project billing.',
      algorithm: 'Variance delta tracking identifying systematic low-balling patterns designed to recoup profits later through arbitrary variation claims.',
      governanceValue: 'Alerts tender committees if an aggressive quote poses a high probability of future cost escalation or project abandonment.'
    },
    {
      id: 'DIM-04',
      title: 'Historical Delay Profiling',
      category: 'Schedule Variance Analysis',
      metricDescription: 'Net milestone delay patterns logged across the contractor’s past 20 public infrastructure contracts.',
      algorithm: 'Critical-path attribution model calculating median slippage days per kilometer of roadway or square meter of built area.',
      governanceValue: 'Prevents awarding time-critical greenfield corridors to entities with persistent critical-path mobilization bottlenecks.'
    },
    {
      id: 'DIM-05',
      title: 'Disputes & Claims Frequency',
      category: 'Contractual Litigation Risk',
      metricDescription: 'Ratio of submitted Extension of Time (EoT) and cost variation claims versus escalations to arbitral tribunals or courts.',
      algorithm: 'Litigation propensity index based on clause claim volume, average settlement duration, and commercial arbitration records.',
      governanceValue: 'Protects public exchequers from contractors whose operational model relies heavily on protracted legal disputes.'
    },
    {
      id: 'DIM-06',
      title: 'Statutory Compliance History',
      category: 'Labour, Tax & Safety Audit',
      metricDescription: 'Automated verification of EPFO/ESIC labour cess payments, GST returns, and safety compliance audits.',
      algorithm: 'Real-time API reconciliation with Ministry of Labour, EPFO, GSTN, and field safety hazard incident logs.',
      governanceValue: 'Ensures zero liability falls on public authorities for contractor labour defaults, wage withholding, or statutory arrears.'
    }
  ];

  return (
    <section id="contractor-section" className="py-20 bg-transparent text-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-12">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>Pre-Award Intelligence &amp; Active Monitoring</span>
          </div>
          <h2 className="text-4xl sm:text-6xl font-extrabold text-white font-display tracking-tight leading-tight">
            Know the Contractor Before the Project.
          </h2>
          <p className="text-base sm:text-lg text-slate-200 mt-3 leading-relaxed">
            Evaluate contractor capability, historical performance, previous delays, claims, compliance, and project completion records before and during project execution.
          </p>
        </div>

        {/* Plain Text Dimension Grid (No cards) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12 pb-10 border-b border-white/15">
          {dimensions.map((item, idx) => {
            const isSelected = activeDimension === idx;
            return (
              <div
                key={item.id}
                onClick={() => setActiveDimension(idx)}
                className="pt-4 border-t border-white/20 cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-bold text-amber-400">
                    {item.id}
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#eefc55]">
                    {item.category}
                  </span>
                </div>

                <h3 className={`text-lg font-bold font-display mb-2 ${isSelected ? 'text-[#eefc55]' : 'text-white'}`}>
                  {item.title}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed mb-4">
                  {item.metricDescription}
                </p>

                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400">
                  <span>Inspect Methodology</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Dimension Plain Text Breakdown */}
        <div className="pt-6">
          <div className="mb-6">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              Audited Algorithmic Framework
            </span>
            <h4 className="text-2xl font-bold text-white font-display mt-1">
              {dimensions[activeDimension].title} • Methodology &amp; Public Value
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="pt-3 border-t border-white/20">
              <div className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">
                Algorithmic Formulation
              </div>
              <p className="text-xs text-slate-200 leading-relaxed font-mono">
                {dimensions[activeDimension].algorithm}
              </p>
            </div>

            <div className="pt-3 border-t border-white/20">
              <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
                Public Governance Safeguard
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">
                {dimensions[activeDimension].governanceValue}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
