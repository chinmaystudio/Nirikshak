import React from 'react';

export const ConnectedViewSection: React.FC = () => {
  const domains = [
    { num: '01', name: 'Central Ministries', sub: 'PMO, Cabinet Secretariat & Line Ministries' },
    { num: '02', name: 'State Governments', sub: 'State PWDs & Urban Infrastructure Secretariats' },
    { num: '03', name: 'Implementing Agencies', sub: 'NHAI, DFCCIL, NCRTC, CPWD & RVNL' },
    { num: '04', name: 'Project Authorities', sub: 'Chief Project Managers & Engineers-in-Charge' },
    { num: '05', name: 'EPC Concessionaires', sub: 'Primary Contractors, Joint Ventures & Vendors' },
    { num: '06', name: 'Field Engineers', sub: 'On-Site Quality Supervision & UAV Photogrammetry' }
  ];

  return (
    <section id="connected-view-section" className="relative z-20 px-4 sm:px-6 lg:px-8 py-16">
      <div className="max-w-7xl mx-auto border-t border-b border-white/15 py-12">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400 font-display mb-2">
            ✦ A CONNECTED VIEW FOR PUBLIC PROJECT DELIVERY
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            Unified Stakeholder Network
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-8">
          {domains.map((item, idx) => (
            <div key={idx} className="flex flex-col">
              <span className="text-xs font-bold text-amber-400 font-display mb-1">
                {item.num} / SECTOR
              </span>
              <span className="text-base font-bold text-white mb-1">
                {item.name}
              </span>
              <span className="text-xs text-slate-300 leading-relaxed">
                {item.sub}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
