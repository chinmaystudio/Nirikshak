import React, { useState } from 'react';
import { ShieldCheck, CheckCircle2, ArrowRight } from 'lucide-react';

interface UnifiedGovernanceSummaryProps {
  onNavigateSection?: (sectionId: string) => void;
}

export const UnifiedGovernanceSummary: React.FC<UnifiedGovernanceSummaryProps> = ({ onNavigateSection }) => {
  const [activePillar, setActivePillar] = useState<number>(0);

  const handleJumpToSection = (sectionId: string) => {
    if (onNavigateSection) {
      onNavigateSection(sectionId);
    } else {
      const el = document.getElementById(sectionId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const governancePillars = [
    {
      id: 'PIL-01',
      sectionId: 'contractor-section',
      category: 'Pre-Award Vetting',
      title: 'Contractor Intelligence & Solvency Radar',
      tagline: 'Empirical Scoring Across 15-Year Infrastructure Track Records',
      keyMetric: '0-100 Normalized Rating',
      summary:
        'Audits past project handover speed, quality test lab certificates, statutory EPFO/GSTN filings, and real-time plant machinery saturation to ensure public tenders are awarded only to solvent, capable concessionaires.',
      subFeatures: [
        'Contractor Performance Score (40% Milestones + 30% Quality + 20% Financials + 10% Safety)',
        'Peer Benchmarking across CPWD, NHAI, Railways, and State PWD registries',
        'Bid-vs-Actual Variance tracking identifying predatory low-ball pricing patterns',
        'Dynamic Machinery & Equipment Capacity Radar preventing over-commitment (>1.75x asset base)'
      ],
      governanceImpact: 'Eliminates subjective appraisal; blocks over-leveraged bids before tender finalization.'
    },
    {
      id: 'PIL-02',
      sectionId: 'monitoring-section',
      category: 'Ground Telemetry',
      title: 'Digital Ground Monitoring & AI Progress Verification',
      tagline: 'Evidence-Led Inspection Replacing Paper Measurement Books',
      keyMetric: 'Volumetric Drone Audits',
      summary:
        'Continuous cross-verification of daily contractor claims against volumetric 3D drone models, SAR satellite imagery, and automated concrete batching plant telemetry.',
      subFeatures: [
        'Mandatory geo-tagged Daily Progress Reports (DPR) with equipment & manpower logs',
        'Photogrammetric computer-vision earthwork & structural element extraction',
        'Automated discrepancy alerts comparing physical progress against contractor billing',
        'Direct synchronization with digital Measurement Book (e-MB) sign-off workflows'
      ],
      governanceImpact: 'Prevents ghost work claims and prevents unverified milestone billing.'
    },
    {
      id: 'PIL-03',
      sectionId: 'financial-section',
      category: 'Fiscal Integrity',
      title: 'Milestone-Linked Escrows & Fraud-Proof Disbursements',
      tagline: 'Direct Treasury Release Strictly Upon Verified Physical Delivery',
      keyMetric: '100% Milestone-Gated',
      summary:
        'Eliminates capital lockup and diversion by linking every interim payment certificate (IPC) directly to verified physical completion milestones.',
      subFeatures: [
        'Tripartite escrow account management with direct sub-contractor fund splits',
        'Automated statutory deduction audit (GST-TDS, labor cess, retention money)',
        'Price adjustment formula engine tracking official RBI/wholesale commodity indices',
        'Audit-ready electronic payment vouchers with tamper-proof digital signatures'
      ],
      governanceImpact: 'Protects public funds from diversion while ensuring steady contractor cash-flow.'
    },
    {
      id: 'PIL-04',
      sectionId: 'risk-section',
      category: 'Early Intervention',
      title: 'Predictive Risk & S-Curve Delay Forecaster',
      tagline: '60–90 Day Early Warnings Before Critical Path Disruption',
      keyMetric: '60-Day Lead Time',
      summary:
        'Multi-factor predictive model synthesizing weather forecasts, Right of Way (RoW) acquisition delays, and supply chain lead times to predict schedule slips.',
      subFeatures: [
        'Real-time CPM/PERT critical path schedule variance analysis (Earned Value Analysis)',
        'Monsoon seasonality & heavy rainfall disruption forecasting',
        'Material supply chain alert engine for bulk cement, structural steel, and bitumen',
        'Automated catch-up schedule recommendation with resource reallocation models'
      ],
      governanceImpact: 'Transitions administrative governance from post-mortem reviews to proactive recovery.'
    },
    {
      id: 'PIL-05',
      sectionId: 'claims-section',
      category: 'Dispute Resolution',
      title: 'Evidence-Based Claims & Arbitration Triage',
      tagline: 'Structured Clause Adjudication Preventing Multi-Year Litigation',
      keyMetric: '90-Day Triage Speed',
      summary:
        'Transforms disputed Extension of Time and cost claims into structured, evidence-backed adjudications using real-time site weather logs, court stays, and contractual clause matching.',
      subFeatures: [
        'Standardized FIDIC / CPWD / NHAI contract clause alignment for all submitted claims',
        'Evidence verification engine linking claims to geotagged rainfall and RoW handover notices',
        'Fair compensation recommendation minimizing protracted arbitral tribunals',
        'Audit-ready claims docket generated for statutory CAG and vigilance scrutiny'
      ],
      governanceImpact: 'Reduces stalled public investments and avoids compounding arbitral interest liabilities.'
    },
    {
      id: 'PIL-06',
      sectionId: 'projects-section',
      category: 'Portfolio Oversight',
      title: 'Executive Portfolio Analytics & Tiered Governance',
      tagline: 'Standardized Oversight Across ₹1,000 Cr+ Megaprojects',
      keyMetric: 'Multi-Tier Pipeline',
      summary:
        'Consolidated executive reporting across high-value strategic megaprojects, active workfronts, critical-path interventions, and handed-over infrastructure assets.',
      subFeatures: [
        'High-Value Mega Projects (₹1,000 Cr+) synced directly with Cabinet Secretariat reviews',
        'Active Pipeline tracking S-Curves, resource telemetry, and statutory permits',
        'Critical Intervention triage applying liquidated damages and mandatory catch-up schedules',
        'Defect Liability Period (DLP) 3-5 year digital warranty monitoring post-commissioning'
      ],
      governanceImpact: 'Enables high-level ministerial visibility and standardized compliance across all states.'
    }
  ];

  const current = governancePillars[activePillar];

  return (
    <section id="governance-summary-section" className="py-20 bg-transparent text-white relative">
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
            A unified governance suite synthesizing contractor prequalification, ground drone telemetry, milestone payments, delay risk prediction, dispute resolution, and portfolio compliance into one coherent digital architecture.
          </p>
        </div>

        {/* Pillar Switcher (Plain text buttons) */}
        <div className="flex flex-wrap gap-2 sm:gap-3 mb-10 pb-6 border-b border-white/15">
          {governancePillars.map((p, idx) => {
            const isSelected = activePillar === idx;
            return (
              <button
                key={p.id}
                onClick={() => setActivePillar(idx)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#eefc55] text-neutral-950 font-extrabold shadow-md'
                    : 'bg-transparent text-slate-300 hover:text-white border border-white/20'
                }`}
              >
                {p.id} • {p.category}
              </button>
            );
          })}
        </div>

        {/* Selected Pillar Plain Text Deep Dive (No card containers) */}
        <div className="pb-12 border-b border-white/15">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-white/10 mb-8">
            <div>
              <div className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">
                {current.id} — {current.category} • Core Architecture
              </div>
              <h3 className="text-3xl sm:text-4xl font-extrabold text-white font-display">
                {current.title}
              </h3>
              <p className="text-sm text-slate-300 mt-1">
                {current.tagline}
              </p>
            </div>

            <div className="shrink-0 max-w-sm">
              <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                Benchmark Standard
              </div>
              <div className="text-xl font-extrabold text-[#eefc55] font-display mt-0.5">
                {current.keyMetric}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Standardized algorithmic protocol across central and state departments.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5 space-y-6">
              <div>
                <div className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">
                  Functional Overview
                </div>
                <p className="text-sm text-slate-200 leading-relaxed">
                  {current.summary}
                </p>
              </div>

              <div>
                <div className="text-xs font-bold text-[#eefc55] uppercase tracking-wider mb-2">
                  Public Governance Safeguard
                </div>
                <p className="text-sm text-slate-200 leading-relaxed">
                  {current.governanceImpact}
                </p>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-4">
                Key Verification Capabilities
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {current.subFeatures.map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{feat}</span>
                  </div>
                ))}
              </div>

              <div className="mt-8 pt-4 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Methodology and interactive diagnostics:
                </span>
                <button
                  onClick={() => handleJumpToSection(current.sectionId)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#eefc55] hover:text-white transition-colors cursor-pointer"
                >
                  <span>Explore In-Depth Module</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-slate-300">
          <div>
            <strong className="text-white">Statutory Audit Standard: </strong>
            Audited monthly by Project Implementation Units (PIU) and Chief Vigilance Officers. Preserves immutable digital verification records across all works.
          </div>
          <span className="font-mono text-amber-400 shrink-0">
            Verified against General Financial Rules (GFR)
          </span>
        </div>
      </div>
    </section>
  );
};
