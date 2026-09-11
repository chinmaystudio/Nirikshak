import React from 'react';

export const AboutSection: React.FC = () => {
  const pillars = [
    {
      title: 'Why PRAGATI',
      desc: 'Public infrastructure projects historically operated in silos: tenders separated from site execution, progress disjointed from payments, and delays unresolved until cost overruns peaked. PRAGATI connects the full spectrum into one synchronized national ecosystem.'
    },
    {
      title: 'How PRAGATI Works',
      desc: 'Through real-time telemetry from drones, satellites, and digital Measurement Books, PRAGATI converts raw ground activity into actionable evidence, structured recommendations, and verified milestone certifications.'
    },
    {
      title: 'Government ↔ Contractor Portal',
      desc: 'A unified single-source-of-truth portal where contractors upload Daily Progress Reports and invoices, while government officers evaluate, sanction, and release milestone funds transparently without intermediary delays.'
    },
    {
      title: 'Evidence-Led Decision Making',
      desc: 'Decisions are grounded in authenticated photogrammetric and sensor data rather than subjective paper reports, eliminating inflated completion figures and unwarranted claims.'
    },
    {
      title: 'AI as an Intelligence Layer',
      desc: 'Machine learning algorithms continuously scan for contractor capacity bottlenecks, weather-induced schedule slippages, and payment anomalies, surfacing proactive early warnings 60-90 days in advance.'
    },
    {
      title: 'Human Approval at Every Decision Point',
      desc: 'AI operates strictly as an assistive advisory layer. Final sanctioning, financial release, and contract amendments remain solely in the hands of competent constitutional government officers.'
    }
  ];

  return (
    <section id="about-section" className="py-20 bg-transparent text-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-14">
          <span className="text-xs font-bold uppercase tracking-widest text-amber-400 font-display">
            ✦ INSTITUTIONAL FOUNDATION
          </span>
          <h2 className="text-4xl sm:text-6xl font-extrabold text-white font-display tracking-tight mt-2 mb-4 leading-tight">
            About PRAGATI Platform
          </h2>
          <p className="text-lg text-slate-200 leading-relaxed">
            PRAGATI is a government-led digital project intelligence platform designed to connect the complete public infrastructure project lifecycle.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {pillars.map((pillar, idx) => (
            <div key={idx} className="pt-4 border-t border-white/20">
              <div className="text-xs font-mono font-bold text-amber-400 mb-1">
                PRINCIPLE 0{idx + 1}
              </div>
              <h3 className="text-xl font-bold text-white mb-2 font-display">
                {pillar.title}
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                {pillar.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
