import React from 'react';
import { Scale } from 'lucide-react';

export const ClaimsDisputesSection: React.FC = () => {
  const claimCards = [
    {
      title: 'Contractor Claims',
      stat: 'Digital Intake',
      desc: 'Digital registration of claims under FIDIC/CPWD clauses with mandatory document evidence attachments.'
    },
    {
      title: 'Vendor Grievances',
      stat: 'Direct Triage',
      desc: 'Sub-contractor and vendor payment grievances logged through the portal for prompt administrative intervention.'
    },
    {
      title: 'AI Claim Assessment',
      stat: 'Clause Alignment',
      desc: 'Autonomous comparison of claimed delay events against rainfall records, RoW release dates, and site logs.'
    },
    {
      title: 'Extension Analysis',
      stat: 'EoT Matrix',
      desc: 'Mathematical quantification of non-compensable versus compensable time extension requests.'
    },
    {
      title: 'Dispute Conciliation',
      stat: 'Pre-Litigation Resolution',
      desc: 'Structured Dispute Avoidance & Adjudication Board (DAAB) evidence packets to avoid court backlogs.'
    }
  ];

  return (
    <section id="claims-section" className="py-20 bg-transparent text-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-12">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
            <Scale className="w-4 h-4 text-amber-400" />
            <span>Structured Dispute Prevention</span>
          </div>
          <h2 className="text-4xl sm:text-6xl font-extrabold text-white font-display tracking-tight leading-tight">
            Resolve With Evidence.
          </h2>
          <p className="text-base sm:text-lg text-slate-200 mt-3 leading-relaxed">
            Connect contracts, progress records, delays, communications, and financial information to support structured claim and dispute assessment.
          </p>
        </div>

        {/* Plain Text Claims Grid (No cards) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 pt-4 border-t border-white/15">
          {claimCards.map((card, idx) => (
            <div key={idx} className="pt-3 border-t border-white/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono font-bold text-amber-400">
                  {card.stat}
                </span>
                <span className="text-xs text-slate-400">
                  0{idx + 1}
                </span>
              </div>

              <h3 className="text-xl font-bold text-white font-display mb-2">
                {card.title}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                {card.desc}
              </p>
              <div className="text-xs font-semibold text-emerald-400">
                ✓ Rule-based arbitration docket
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
