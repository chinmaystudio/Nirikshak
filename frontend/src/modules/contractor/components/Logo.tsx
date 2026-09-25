export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 96" className={className} role="img" aria-label="NIRIKSHAK logo">
      <defs>
        <linearGradient id="nrkN" x1="0" y1="0" x2="0.25" y2="1">
          <stop offset="0%" stopColor="#3b7ce0" />
          <stop offset="45%" stopColor="#1d4c9e" />
          <stop offset="100%" stopColor="#0e2a60" />
        </linearGradient>
        <linearGradient id="nrkHandle" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1b4bb5" />
          <stop offset="100%" stopColor="#0c2450" />
        </linearGradient>
        <clipPath id="nrkLensClip">
          <circle cx="50" cy="54" r="21.5" />
        </clipPath>
      </defs>

      {/* N letterform */}
      <path
        d="M30 12 L45 12 L60 34.5 L60 12 L75 12 L75 84 L60 84 L60 61.5 L45 84 L30 84 Z"
        fill="url(#nrkN)"
        stroke="#0e2a60"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />

      {/* tricolor sweep */}
      <path d="M32 6 C16 17 12 33 20 48 C28 62 26 76 16 90" fill="none" stroke="#f97316" strokeWidth="6.5" strokeLinecap="round" />
      <path d="M27 9 C13 20 10 34 17 48 C25 61 23 74 13 88" fill="none" stroke="#ffffff" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M22 12 C10 22 9 35 15 48 C23 60 21 72 11 85" fill="none" stroke="#199a49" strokeWidth="6.5" strokeLinecap="round" />

      {/* monitoring lens */}
      <circle cx="50" cy="54" r="27" fill="none" stroke="#0d2a63" strokeWidth="2" />
      <circle cx="50" cy="54" r="24" fill="#0f2f6b" stroke="#2e7ce4" strokeWidth="5" />
      <g clipPath="url(#nrkLensClip)">
        {/* skyline */}
        <rect x="38" y="42" width="6" height="16" rx="0.8" fill="#7ea9ea" />
        <rect x="46" y="37" width="8" height="21" rx="0.8" fill="#9cc0f6" />
        <rect x="56" y="42" width="6" height="16" rx="0.8" fill="#7ea9ea" />
        {/* bridge */}
        <path d="M33 58 Q50 46 67 58" stroke="#cfe0f8" strokeWidth="1.8" fill="none" />
        <rect x="41.2" y="53" width="2.4" height="12" rx="0.6" fill="#cfe0f8" />
        <rect x="56.4" y="53" width="2.4" height="12" rx="0.6" fill="#cfe0f8" />
        <path d="M31 64 H69" stroke="#cfe0f8" strokeWidth="2.2" />
        {/* road */}
        <path d="M30 70 C40 66 54 60 69 50" stroke="#e9f1fd" strokeWidth="6" strokeLinecap="round" fill="none" />
        <path d="M31 71 C41 67 55 61 69 51" stroke="#0f2f6b" strokeWidth="1.3" strokeDasharray="3.5 3" fill="none" />
      </g>
      {/* handle */}
      <path d="M66.5 70.5 L83 87" stroke="url(#nrkHandle)" strokeWidth="9.5" strokeLinecap="round" />
    </svg>
  );
}

export default function Logo({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 min-w-max">
      <LogoMark className="h-10 w-10 shrink-0" />
      <div className="flex flex-col leading-none">
        <span className="font-display font-extrabold tracking-tight text-[17px] text-[#14336e] dark:text-slate-100">NIRIKSHAK</span>
        {!compact && (
          <span className="text-[9px] font-bold tracking-[0.22em] text-blue-700 mt-0.5 dark:text-blue-400">CONTRACTOR PORTAL</span>
        )}
      </div>
    </div>
  );
}
