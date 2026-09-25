import React from 'react';
import { ArrowRight, Shield, Play } from 'lucide-react';

interface HeroSectionProps {
  onExploreProjects: () => void;
  onHowItWorks: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onExploreProjects,
  onHowItWorks
}) => {
  return (
    <div className="relative pt-12 sm:pt-20 pb-16">
      <section id="hero" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative z-10 max-w-4xl">
          {/* Plain Top Badge */}
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400 mb-6 drop-shadow-md">
            <Shield className="w-4 h-4 text-amber-400" />
            <span>Government of India • Project Intelligence Infrastructure</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>

          {/* Plain Text Hero Title */}
          <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black tracking-tight font-display leading-[1.04] mb-6 drop-shadow-2xl">
            <span className="text-[#eefc55]">FROM TENDER</span>
            <br />
            <span className="text-[#eefc55]">TO COMPLETION.</span>
            <br />
            <span className="text-white">WITH EVIDENCE.</span>
          </h1>

          {/* Plain Description */}
          <p className="text-lg sm:text-xl lg:text-2xl text-slate-100 font-normal leading-relaxed max-w-3xl mb-10 drop-shadow-lg">
            PRAGATI connects government officers, contractors, project data, and AI-powered intelligence across the complete public infrastructure lifecycle — enabling transparent monitoring, evidence-based decisions, and early action.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-4 mb-16">
            <button
              id="hero-btn-explore-projects"
              onClick={onExploreProjects}
              className="group inline-flex items-center gap-2.5 px-8 py-4 rounded-full font-extrabold text-base bg-[#eefc55] hover:bg-white text-neutral-950 shadow-xl hover:shadow-2xl transition-all duration-200 active:scale-95 cursor-pointer"
            >
              <span>Explore Portfolios</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              id="hero-btn-how-it-works"
              onClick={onHowItWorks}
              className="inline-flex items-center gap-2.5 px-7 py-4 rounded-full font-bold text-base bg-white/10 hover:bg-white/20 text-white border border-white/30 backdrop-blur-sm transition-all active:scale-95 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span>How PRAGATI Works</span>
            </button>

            <a
              id="hero-btn-citizen-portal"
              href="#/home"
              className="inline-flex items-center gap-2.5 px-7 py-4 rounded-full font-bold text-base bg-emerald-400 hover:bg-emerald-300 text-neutral-950 shadow-xl hover:shadow-2xl transition-all active:scale-95 cursor-pointer"
            >
              <span>Citizen Portal &amp; Grievances</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          {/* Plain Text Highlight Spread across screen (No card containers) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-white/20">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
                ✦ Public Infrastructure Framework
              </div>
              <h2 className="text-lg font-bold text-white mb-1">
                Continuous Governance &amp; Multi-Agency Oversight
              </h2>
              <p className="text-sm text-slate-200 leading-relaxed">
                Autonomous monitoring across milestone baselines, financial sanctions, S-curve schedule variance, and statutory compliance without bureaucratic silos.
              </p>
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-[#eefc55] mb-2">
                ✦ 10 Stages • 06 AI Decision Engines
              </div>
              <h2 className="text-lg font-bold text-white mb-1">
                Synced Government ↔ Contractor Telemetry
              </h2>
              <p className="text-sm text-slate-200 leading-relaxed">
                Direct integration of drone UAV photogrammetry, satellite GIS, IoT batching sensors, and digitized contract clauses with constitutional officer approval.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
