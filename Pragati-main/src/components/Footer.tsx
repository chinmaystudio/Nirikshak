import React from 'react';
import { ArrowUp, Lock } from 'lucide-react';

interface FooterProps {
  onNavigateSection: (sectionId: string) => void;
  onOpenLogin: (role?: 'officer' | 'contractor') => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigateSection, onOpenLogin }) => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-black/60 backdrop-blur-md text-white border-t border-white/15 pt-16 pb-12 relative z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 pb-12 border-b border-white/10">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#eefc55] text-neutral-950 font-black text-xl flex items-center justify-center font-display shadow-md">
                P
              </div>
              <div>
                <div className="font-extrabold text-xl font-display text-white tracking-wider">
                  PRAGATI
                </div>
                <div className="text-xs text-amber-400 font-medium">
                  Project Intelligence &amp; Monitoring
                </div>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-md">
              Connecting government officers, contractors, project data, and AI-powered intelligence across the complete public infrastructure lifecycle — enabling transparent monitoring, evidence-based decisions, and early action.
            </p>

            <div className="flex items-center gap-3 pt-2 text-xs font-bold text-amber-400">
              <span>✓ Gov.in Verified</span>
              <span>•</span>
              <span>✓ ISO 27001 Certified</span>
            </div>
          </div>

          <div>
            <div className="text-xs uppercase font-bold text-amber-400 tracking-wider mb-4">
              Lifecycle &amp; Portfolios
            </div>
            <ul className="space-y-2.5 text-xs text-slate-300">
              {['All Projects', 'Active Highways & Metros', 'High-Value Rail Packages', '10-Stage Pipeline', 'Milestone Verifications'].map((link) => (
                <li key={link}>
                  <button
                    onClick={() => onNavigateSection('projects-section')}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    {link}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-xs uppercase font-bold text-amber-400 tracking-wider mb-4">
              AI Decision Engines
            </div>
            <ul className="space-y-2.5 text-xs text-slate-300">
              {['Contractor Intelligence', 'Drone Verification', 'Delay Prediction', 'Responsibility Matrix', 'Claim Analysis'].map((link) => (
                <li key={link}>
                  <button
                    onClick={() => onNavigateSection('ai-framework-section')}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    {link}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-xs uppercase font-bold text-amber-400 tracking-wider mb-4">
              Official Portals
            </div>
            <div className="space-y-3">
              <button
                onClick={() => onOpenLogin('officer')}
                className="text-xs font-bold text-[#eefc55] hover:text-white transition-colors block text-left cursor-pointer"
              >
                Government Officer SSO ↗
              </button>
              <button
                onClick={() => onOpenLogin('contractor')}
                className="text-xs font-bold text-slate-300 hover:text-white transition-colors block text-left cursor-pointer"
              >
                Contractor Portal ↗
              </button>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pt-2">
                <Lock className="w-3 h-3 text-slate-400" />
                <span>256-bit TLS Encrypted Gov Gateway</span>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div>© 2026 PRAGATI. Designed for transparent public infrastructure delivery. Government of India.</div>
          <button
            onClick={scrollToTop}
            className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-white transition-colors font-bold cursor-pointer"
          >
            <span>Back to Top</span>
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </footer>
  );
};
