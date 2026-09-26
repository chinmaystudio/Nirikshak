import { useState } from 'react';
import { ScrollCanvasBackground } from './components/ScrollCanvasBackground';
import { HeroSection } from './components/HeroSection';
import { ConnectedViewSection } from './components/ConnectedViewSection';
import { MainIntroSection } from './components/MainIntroSection';
import { LifecycleSection } from './components/LifecycleSection';
import { AIIntelligenceSection } from './components/AIIntelligenceSection';
import { UnifiedGovernanceSummary } from './components/UnifiedGovernanceSummary';
import { ContractorIntelligenceSection } from './components/ContractorIntelligenceSection';
import { ProjectMonitoringSection } from './components/ProjectMonitoringSection';
import { FinancialManagementSection } from './components/FinancialManagementSection';
import { RiskDelaySection } from './components/RiskDelaySection';
import { ClaimsDisputesSection } from './components/ClaimsDisputesSection';
import { ReportsSection } from './components/ReportsSection';
import { ProjectsExplorer } from './components/ProjectsExplorer';
import { AboutSection } from './components/AboutSection';
import { OfficialLoginModal } from './components/OfficialLoginModal';
import { Footer } from './components/Footer';
import { ArrowRight, ShieldCheck, User } from 'lucide-react';
import { navigate } from '@/app/router';
import { ROUTES } from '@/constants/routes';
import './index.css';

export function LandingPage(): JSX.Element {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [loginRole, setLoginRole] = useState<'officer' | 'contractor'>('officer');

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleOpenLogin = (role: 'officer' | 'contractor' = 'officer') => {
    setLoginRole(role);
    setIsLoginOpen(true);
  };

  const goToPortal = () => {
    navigate(ROUTES.HOME);
  };

  return (
    <div className="pragati-landing-scope min-h-screen flex flex-col bg-neutral-950/60 text-white selection:bg-[#eefc55] selection:text-black relative">
      {/* 266-Frame Scroll Canvas Animation in Fixed Background */}
      <ScrollCanvasBackground />

      {/* Top Fixed Navigation Bar */}
      <header
        id="main-nav"
        className="fixed top-0 left-0 right-0 z-50 bg-neutral-950/90 backdrop-blur-xl border-b border-white/10 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-2xl transition-all"
      >
        <div className="flex items-center gap-6">
          <a href="#/" className="flex items-center gap-3 group">
            <img
              src="/nirikshak-logo-light.png"
              alt="NIRIKSHAK Logo"
              className="h-8 sm:h-9 w-auto object-contain transition-transform group-hover:scale-105"
            />
          </a>

          <nav className="hidden lg:flex items-center gap-5 text-xs font-semibold text-neutral-300">
            <button
              onClick={() => scrollToSection('hero')}
              className="hover:text-[#eefc55] transition-colors cursor-pointer"
            >
              Overview
            </button>
            <button
              onClick={() => scrollToSection('lifecycle-section')}
              className="hover:text-[#eefc55] transition-colors cursor-pointer"
            >
              10-Stage Lifecycle
            </button>
            <button
              onClick={() => scrollToSection('ai-framework-section')}
              className="hover:text-[#eefc55] transition-colors cursor-pointer"
            >
              AI Framework
            </button>
            <button
              onClick={() => scrollToSection('projects-section')}
              className="hover:text-[#eefc55] transition-colors cursor-pointer"
            >
              Portfolios
            </button>
            <button
              onClick={() => scrollToSection('about-section')}
              className="hover:text-[#eefc55] transition-colors cursor-pointer"
            >
              About
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <a
            href="/government"
            className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold text-neutral-200 hover:text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-all cursor-pointer"
            title="Government Officer Portal"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            <span>Gov Portal</span>
          </a>

          <a
            href="/contractor"
            className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold text-neutral-200 hover:text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-all cursor-pointer"
            title="Contractor & Vendor Portal"
          >
            <span>Contractor</span>
          </a>

          <button
            id="nav-enter-citizen-portal"
            onClick={goToPortal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-bold bg-[#eefc55] hover:bg-white text-neutral-950 shadow-lg hover:shadow-xl transition-all cursor-pointer active:scale-95"
          >
            <User className="w-3.5 h-3.5" />
            <span>Citizen Portal</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      <main className="flex-grow relative z-10 pt-16">
        <HeroSection
          onExploreProjects={() => scrollToSection('projects-section')}
          onHowItWorks={() => scrollToSection('about-section')}
        />
        <ConnectedViewSection />
        <MainIntroSection
          onExploreLifecycle={() => scrollToSection('lifecycle-section')}
          onExploreAI={() => scrollToSection('ai-framework-section')}
        />
        <LifecycleSection />
        <AIIntelligenceSection />
        <UnifiedGovernanceSummary onNavigateSection={scrollToSection} />
        <ContractorIntelligenceSection />
        <ProjectMonitoringSection />
        <FinancialManagementSection />
        <RiskDelaySection />
        <ClaimsDisputesSection />
        <ReportsSection />
        <ProjectsExplorer />
        <AboutSection />
      </main>

      <Footer
        onNavigateSection={scrollToSection}
        onOpenLogin={handleOpenLogin}
      />

      <OfficialLoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        initialRole={loginRole}
      />
    </div>
  );
}

export default LandingPage;
