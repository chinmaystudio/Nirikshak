import React, { useState } from 'react';
import { CheckCircle2, Layers } from 'lucide-react';

export const ProjectsExplorer: React.FC = () => {
  const [selectedPortfolio, setSelectedPortfolio] = useState<string>('high-value');

  const portfolioCategories = [
    {
      id: 'high-value',
      title: 'High-Value Infrastructure (₹1,000 Cr+)',
      tag: 'Strategic Mega Projects',
      desc: 'Dedicated oversight pipeline for major national expressways, freight corridors, high-speed rail, ports, and bulk medical institutes.',
      criteria: 'Projects with capital expenditure exceeding ₹1,000 Crore subject to direct inter-ministerial coordination.',
      governanceFeatures: [
        'Direct synchronization with Cabinet Secretariat PRAGATI meetings',
        'Multi-agency Right-of-Way (RoW) and forest clearance escalation matrix',
        'Tripartite escrow account oversight with milestone release triggers',
        'Bi-weekly drone photogrammetry and high-resolution satellite checks'
      ],
      auditNorm: 'Audited monthly by Project Implementation Units (PIU) and Chief Vigilance Officers.'
    },
    {
      id: 'active',
      title: 'Active Execution Pipeline',
      tag: 'Operational Workfronts',
      desc: 'Ongoing civil, electrical, and structural contracts undergoing active daily physical site work.',
      criteria: 'Contracts post-mobilization with active Running Account (RA) billing and ongoing milestones.',
      governanceFeatures: [
        'Mandatory geo-tagged Daily Progress Reports (DPR) with equipment logs',
        'Material quality certificate linkage before concrete pour approval',
        'Labor attendance and statutory cess (EPF/ESIC) automated reconciliation',
        'Automated S-Curve tracking comparing baseline schedule to ground reality'
      ],
      auditNorm: 'Continuous real-time ingest with automatic anomaly flags for variance > 5%.'
    },
    {
      id: 'delayed',
      title: 'Delayed & Critical Path Intervention',
      tag: 'Corrective Action Framework',
      desc: 'Systematic triage and recovery pipeline for packages facing critical path schedule slippage.',
      criteria: 'Packages where actual physical progress lags baseline schedule by more than 21 days.',
      governanceFeatures: [
        'AI Delay Responsibility Attribution separating contractor vs government bottlenecks',
        'Automatic generation of liquidated damages (LD) and penal interest notices',
        'Mandatory submission and milestone-locking of contractor Catch-Up Plans',
        'Extension of Time (EoT) assessment using IMD rainfall and court stay evidence'
      ],
      auditNorm: 'Executive early warning notifications dispatched 60 days before critical milestone disruption.'
    },
    {
      id: 'completed',
      title: 'Completed & Handed-Over Assets',
      tag: 'Defect Liability & Institutional Memory',
      desc: 'Finished assets undergoing operational commissioning, final Measurement Book closure, and audit reconciliation.',
      criteria: 'Projects that have received formal Provisional or Final Completion Certificates.',
      governanceFeatures: [
        'Digital Measurement Book (MB) reconciliation and final bill release',
        'Automated 3-5 year Defect Liability Period (DLP) warranty monitoring',
        'Performance score update permanently recorded in Contractor Intelligence Registry',
        'Post-completion rate analysis feeding into future standardized BOQ norms'
      ],
      auditNorm: 'Complete digital archive preserved for statutory CAG audit and vigilance scrutiny.'
    }
  ];

  const currentCategory = portfolioCategories.find((c) => c.id === selectedPortfolio) || portfolioCategories[0];

  return (
    <section id="projects-section" className="py-20 bg-transparent text-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-10">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
            <Layers className="w-4 h-4 text-amber-400" />
            <span>Infrastructure Portfolio Governance</span>
          </div>
          <h2 className="text-4xl sm:text-6xl font-extrabold text-white font-display tracking-tight leading-tight">
            Portfolio Monitoring Framework
          </h2>
          <p className="text-base sm:text-lg text-slate-200 mt-3 leading-relaxed">
            Standardized multi-tier oversight structured across project scale, execution phase, risk profile, and completion status.
          </p>
        </div>

        {/* Category Switcher (Plain text buttons) */}
        <div className="flex flex-wrap gap-2 sm:gap-3 mb-10 pb-6 border-b border-white/15">
          {portfolioCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedPortfolio(cat.id)}
              className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                selectedPortfolio === cat.id
                  ? 'bg-[#eefc55] text-neutral-950 font-extrabold shadow-md'
                  : 'bg-transparent text-slate-300 hover:text-white border border-white/20'
              }`}
            >
              {cat.title}
            </button>
          ))}
        </div>

        {/* Selected Portfolio Plain Text Deep Dive (No cards) */}
        <div className="pb-8 border-b border-white/15">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-white/10 mb-8">
            <div>
              <div className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">
                {currentCategory.tag}
              </div>
              <h3 className="text-3xl sm:text-4xl font-extrabold text-white font-display">
                {currentCategory.title}
              </h3>
              <p className="text-sm text-slate-200 mt-2 max-w-3xl leading-relaxed">
                {currentCategory.desc}
              </p>
            </div>

            <div className="shrink-0 max-w-sm">
              <div className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">
                Portfolio Threshold
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {currentCategory.criteria}
              </p>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-4">
              Automated Governance Safeguards
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {currentCategory.governanceFeatures.map((feat, idx) => (
                <div key={idx} className="flex items-start gap-3 text-xs text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{feat}</span>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-white/10 text-xs text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span>Statutory Audit Standard: {currentCategory.auditNorm}</span>
              <span className="text-amber-400 font-mono">Verified against General Financial Rules (GFR)</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
