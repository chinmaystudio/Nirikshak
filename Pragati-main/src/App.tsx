import React, { useState } from 'react';
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

export default function App() {
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

  return (
    <div className="min-h-screen flex flex-col bg-neutral-950/60 text-white selection:bg-[#eefc55] selection:text-black relative">
      {/* 300-Frame Scroll Canvas Animation in Fixed Background */}
      <ScrollCanvasBackground />

      <main className="flex-grow relative z-10">
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
