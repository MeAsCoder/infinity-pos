import React from 'react';

/**
 * The mark: an infinity loop rendered as two stemmed glasses meeting at the
 * base — reads as "∞" from a distance, reads as a pair of wine glasses up
 * close. Pure SVG, no image asset, so it stays crisp at any size and themes
 * with currentColor / the two fill props.
 */
export function LogoMark({ className = 'w-8 h-8', ringColor = '#c9a227', accentColor = '#f3e2ab' }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M24 24c-3.5-6-8-9-12-9-5 0-8 3.8-8 9s3 9 8 9c4 0 8.5-3 12-9Z"
        stroke={ringColor} strokeWidth="2.6" strokeLinejoin="round"
      />
      <path
        d="M24 24c3.5-6 8-9 12-9 5 0 8 3.8 8 9s-3 9-8 9c-4 0-8.5-3-12-9Z"
        stroke={ringColor} strokeWidth="2.6" strokeLinejoin="round"
      />
      <circle cx="24" cy="24" r="2.1" fill={accentColor} />
    </svg>
  );
}

export default function Logo({ variant = 'full', className = '' }) {
  if (variant === 'mark') return <LogoMark className={className || 'w-8 h-8'} />;
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark className="w-8 h-8 shrink-0" />
      <div className="leading-none">
        <div className="font-display text-[17px] tracking-[0.14em] text-white font-semibold">INFINITY</div>
        <div className="text-[9px] tracking-[0.35em] text-gold-400/90 mt-0.5">LIQUOR&nbsp;&amp;&nbsp;LOUNGE</div>
      </div>
    </div>
  );
}
