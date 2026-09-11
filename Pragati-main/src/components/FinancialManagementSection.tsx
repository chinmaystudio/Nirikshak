import React from 'react';
import { ShieldCheck } from 'lucide-react';

export const FinancialManagementSection: React.FC = () => {
  const financialCards = [
    {
      title: 'Payment & Bill Management',
      stat: 'e-Measurement Book Linked',
      desc: 'Digital Running Account (RA) bills directly mapped against authenticated Measurement Book records.',
      tag: 'Zero Leakage'
    },
    {
      title: 'Milestone-Based Payments',
      stat: 'Strict 1:1 Linkage',
      desc: 'Disbursements are released only when key physical milestones satisfy satellite/drone verification.',
      tag: 'Evidence Guarded'
    },
    {
      title: 'Variation Orders',
      stat: 'AI Clause Audit',
      desc: 'Automatic scrutiny of scope additions against original contract limits and standard schedule of rates.',
      tag: 'Rate Analysis'
    },
    {
      title: 'Cost Overrun Analysis',
      stat: 'Predictive Indexing',
      desc: 'Early detection of steel and fuel price indices before they trigger uncontrolled budget revisions.',
      tag: 'Predictive'
    },
    {
      title: 'Penalty / Liquidated Damages',
      stat: 'Auto LD Calculation',
      desc: 'Objective calculation of LD based on contractor-attributable delay days without subjective bias.',
      tag: 'Impartial'
    }
  ];

  return (
    <section id="finance-section" className="py-20 bg-transparent text-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-12">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Fiscal Discipline &amp; Transparency</span>
          </div>
          <h2 className="text-4xl sm:text-6xl font-extrabold text-white font-display tracking-tight leading-tight">
            Connect Progress With Payment.
          </h2>

          <div className="mt-3 text-sm font-bold text-amber-400">
            Verified work → Certified milestone → Payment decision
          </div>
        </div>

        {/* Plain Text Financial Grid (No cards) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 pt-4 border-t border-white/15">
          {financialCards.map((card, idx) => (
            <div key={idx} className="pt-3 border-t border-white/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  {card.tag}
                </span>
                <span className="text-xs font-mono text-emerald-400 font-bold">
                  {card.stat}
                </span>
              </div>

              <div className="text-xl font-bold text-white font-display mb-2">
                {card.title}
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {card.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
