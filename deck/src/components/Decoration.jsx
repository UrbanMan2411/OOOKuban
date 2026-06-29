import React from 'react'

/**
 * Decorative SVG layer — soft misty mountains, bamboo silhouettes, sun.
 * Pure CSS/SVG, no external assets. Use `variant` to swap colour scheme.
 */
export function MistyMountains({ className = '', tone = 'light' }) {
  const c1 = tone === 'dark' ? '#0E5C32' : '#94C2A4'
  const c2 = tone === 'dark' ? '#0F3D2E' : '#7BBF95'
  const c3 = tone === 'dark' ? '#0A261C' : '#10743F'
  return (
    <svg
      className={`pointer-events-none absolute inset-0 w-full h-full ${className}`}
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="mountFade1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={c1} stopOpacity="0" />
          <stop offset="100%" stopColor={c1} stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id="mountFade2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={c2} stopOpacity="0" />
          <stop offset="100%" stopColor={c2} stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id="mountFade3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={c3} stopOpacity="0" />
          <stop offset="100%" stopColor={c3} stopOpacity="0.6" />
        </linearGradient>
      </defs>
      {/* Far ridge */}
      <path
        d="M 0 720 L 120 660 L 240 700 L 380 620 L 520 690 L 700 600 L 880 680 L 1080 610 L 1260 690 L 1440 640 L 1600 720 L 1600 900 L 0 900 Z"
        fill="url(#mountFade1)"
      />
      {/* Mid ridge */}
      <path
        d="M 0 780 L 160 740 L 320 770 L 480 700 L 680 760 L 880 700 L 1080 770 L 1280 720 L 1460 780 L 1600 760 L 1600 900 L 0 900 Z"
        fill="url(#mountFade2)"
      />
      {/* Near ridge with tiny pine silhouettes */}
      <path
        d="M 0 840 L 180 800 L 360 830 L 540 780 L 760 830 L 980 790 L 1180 830 L 1380 790 L 1560 830 L 1600 820 L 1600 900 L 0 900 Z"
        fill="url(#mountFade3)"
      />
    </svg>
  )
}

/** Bamboo silhouette strip — vertical, used at left/right edges of slides. */
export function BambooStrip({ side = 'left', tone = 'light' }) {
  const stroke = tone === 'dark' ? '#94C2A4' : '#10743F'
  return (
    <svg
      className={`pointer-events-none absolute top-0 bottom-0 ${side === 'left' ? 'left-0' : 'right-0 -scale-x-100'} w-[140px] opacity-30`}
      viewBox="0 0 140 900"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <g stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <line x1="62" y1="0" x2="62" y2="900" />
        {[120, 290, 460, 630, 800].map((y, i) => (
          <ellipse key={i} cx="62" cy={y} rx="9" ry="3" />
        ))}
        {/* Branch + leaves clusters */}
        <g>
          <path d="M62 180 Q78 174 92 162" />
          <path d="M92 162 C99 154 104 142 102 130 C 96 138 91 148 92 162 Z" fill={stroke} fillOpacity="0.15" />
          <path d="M62 180 Q72 172 78 164 M62 180 Q70 186 76 192" />
        </g>
        <g>
          <path d="M62 360 Q48 354 32 346" />
          <path d="M32 346 C 24 340 17 330 17 318 C 27 324 33 334 32 346 Z" fill={stroke} fillOpacity="0.15" />
        </g>
        <g>
          <path d="M62 520 Q78 514 90 506" />
          <path d="M90 506 C 95 498 97 486 94 476 C 89 485 87 496 90 506 Z" fill={stroke} fillOpacity="0.15" />
        </g>
        <g>
          <path d="M62 700 Q50 694 38 686" />
          <path d="M38 686 C 32 678 28 666 30 656 C 36 665 40 676 38 686 Z" fill={stroke} fillOpacity="0.15" />
        </g>
      </g>
    </svg>
  )
}

/** Big soft sun circle for hero slides */
export function SunOrb({ className = '' }) {
  return (
    <div className={`pointer-events-none absolute rounded-full ${className}`} aria-hidden="true">
      <div className="w-full h-full rounded-full bg-gradient-to-br from-amber-100/80 via-amber-200/40 to-transparent blur-2xl animate-breath" />
    </div>
  )
}
