import { useEffect } from 'react';
import { usePath, navigate, match } from './lib/router';
import { StoreProvider } from './lib/store';
import Layout from './components/Layout';

import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import Performance from './pages/Performance';
import CalendarPage from './pages/CalendarPage';
import AIAssist from './pages/AIAssist';
import Notifications from './pages/Notifications';
import Tenders from './pages/Tenders';
import TenderDetails from './pages/TenderDetails';
import BidSubmission from './pages/BidSubmission';
import BidAIAssist from './pages/BidAIAssist';
import ProjectLayout from './pages/project/ProjectLayout';

const PROJECT_SECTIONS = ['details', 'resources', 'finance', 'ai-guide', 'bills', 'analytics', 'inspection', 'update', 'ai-analysis', 'ai-completion', 'communication'];

function Router() {
  const path = usePath();

  useEffect(() => {
    if (path === '/' || path === '') navigate('/dashboard');
  }, [path]);

  const activePath = path === '/' || path === '' ? '/dashboard' : path;

  // Tender routes
  let m = match('/tenders/:tenderId/bid/ai-assist', activePath);
  if (m) return <Layout><BidAIAssist tenderId={m.tenderId} /></Layout>;
  m = match('/tenders/:tenderId/bid', activePath);
  if (m) return <Layout><BidSubmission tenderId={m.tenderId} /></Layout>;
  m = match('/tenders/:tenderId', activePath);
  if (m) return <Layout><TenderDetails tenderId={m.tenderId} /></Layout>;
  m = match('/tenders', activePath);
  if (m) return <Layout><Tenders /></Layout>;

  // Project workspace routes
  m = match('/projects/:projectId/:section', activePath);
  if (m && PROJECT_SECTIONS.includes(m.section)) {
    return <Layout><ProjectLayout projectId={m.projectId} section={m.section} /></Layout>;
  }
  m = match('/projects/:projectId', activePath);
  if (m) return <Layout><ProjectLayout projectId={m.projectId} section="details" /></Layout>;
  m = match('/projects', activePath);
  if (m) return <Layout><Projects /></Layout>;

  // Top-level routes
  switch (activePath) {
    case '/dashboard':
      return <Layout><Dashboard /></Layout>;
    case '/performance':
      return <Layout><Performance /></Layout>;
    case '/calendar':
      return <Layout><CalendarPage /></Layout>;
    case '/ai-assist':
      return <Layout><AIAssist /></Layout>;
    case '/notifications':
      return <Layout><Notifications /></Layout>;
  }

  return (
    <Layout>
      <div className="p-6 max-w-2xl mx-auto pt-16 text-center">
        <p className="font-display font-extrabold text-6xl text-slate-200 dark:text-slate-800">404</p>
        <h1 className="font-display font-bold text-2xl text-slate-800 mt-2 dark:text-slate-100">Page not found</h1>
        <p className="text-sm text-slate-500 mt-2 dark:text-slate-400">
          The page <code className="font-mono text-xs bg-slate-100 rounded px-1.5 py-0.5 dark:bg-slate-800">{path}</code> does not exist in the Contractor Portal.
        </p>
        <div className="flex justify-center gap-2.5 mt-6">
          <a href="#/dashboard" className="btn btn-primary">Go to Dashboard</a>
          <a href="#/projects" className="btn btn-secondary">My Projects</a>
        </div>
      </div>
    </Layout>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Router />
    </StoreProvider>
  );
}
