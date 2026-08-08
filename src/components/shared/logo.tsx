export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1000 1000"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="logo-blue" x1="150" y1="280" x2="900" y2="420" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--brand-400, #60a5fa)" />
          <stop offset="1" stopColor="var(--brand-700, #1d4ed8)" />
        </linearGradient>
        <linearGradient id="logo-navy" x1="340" y1="330" x2="650" y2="850" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--navy-900, #0a1428)" />
          <stop offset="1" stopColor="#000000" />
        </linearGradient>
        <mask id="logo-p-hole">
          <rect width="1000" height="1000" fill="#fff" />
          <ellipse cx="705" cy="475" rx="88" ry="88" fill="#000" />
        </mask>
      </defs>

      {/* speed lines */}
      <circle cx="118" cy="562" r="16" fill="url(#logo-blue)" />
      <rect x="150" y="548" width="80" height="26" rx="13" fill="url(#logo-blue)" />
      <rect x="185" y="600" width="130" height="26" rx="13" fill="url(#logo-blue)" />
      <rect x="220" y="652" width="170" height="26" rx="13" fill="url(#logo-blue)" />

      {/* F */}
      <polygon points="330,330 860,330 780,430 330,430" fill="url(#logo-blue)" />
      <polygon points="330,430 620,430 540,530 330,530" fill="url(#logo-blue)" />
      <polygon points="330,530 400,530 260,700 190,700" fill="url(#logo-blue)" />

      {/* P */}
      <g mask="url(#logo-p-hole)">
        <rect x="560" y="330" width="330" height="290" rx="145" fill="url(#logo-navy)" />
        <polygon points="560,430 660,430 440,850 340,850" fill="url(#logo-navy)" />
      </g>
    </svg>
  );
}
