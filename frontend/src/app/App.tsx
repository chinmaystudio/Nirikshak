import React, { useState, useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';

const GovernmentModule = React.lazy(() => import('../modules/government/App'));
const ContractorModule = React.lazy(() => import('../modules/contractor/App'));
const UserModule = React.lazy(() => import('../modules/user/app/App').then((m) => ({ default: m.App })));

function detectPortal(): 'government' | 'contractor' | 'user' {
  const p = window.location.pathname.toLowerCase().replace(/\\/g, '/');
  const h = window.location.hash.toLowerCase().replace(/\\/g, '/');

  if (p.includes('government') || h.includes('government')) {
    return 'government';
  }
  if (p.includes('contractor') || h.includes('contractor')) {
    return 'contractor';
  }
  return 'user';
}

export function App() {
  const [currentPortal, setCurrentPortal] = useState<'government' | 'contractor' | 'user'>(detectPortal);

  useEffect(() => {
    const handleLocation = () => {
      setCurrentPortal(detectPortal());
    };

    window.addEventListener('popstate', handleLocation);
    window.addEventListener('hashchange', handleLocation);
    return () => {
      window.removeEventListener('popstate', handleLocation);
      window.removeEventListener('hashchange', handleLocation);
    };
  }, []);

  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-white">
          <div className="w-10 h-10 border-4 border-[#eefc55] border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-xs font-bold tracking-widest uppercase text-neutral-400">Loading NIRIKSHAK...</p>
        </div>
      }
    >
      {currentPortal === 'government' && (
        <BrowserRouter>
          <GovernmentModule />
        </BrowserRouter>
      )}
      {currentPortal === 'contractor' && <ContractorModule />}
      {currentPortal === 'user' && <UserModule />}
    </React.Suspense>
  );
}

export default App;
