import React from 'react';

const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round' };

export const IconDashboard = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>
);
export const IconPOS = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M3 6h18l-1.5 9.5a2 2 0 0 1-2 1.5H6.5a2 2 0 0 1-2-1.5L3 6Z" /><path d="M8 6V4.5A2.5 2.5 0 0 1 10.5 2h3A2.5 2.5 0 0 1 16 4.5V6" /><circle cx="9.5" cy="20" r="1.4" /><circle cx="15.5" cy="20" r="1.4" /></svg>
);
export const IconClock = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></svg>
);
export const IconBottle = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M10 2h4v3.5l1.7 2.3c.5.6.8 1.4.8 2.2V19a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2V10c0-.8.3-1.6.8-2.2L10 5.5V2Z" /><path d="M9.5 12h5" /></svg>
);
export const IconBox = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M21 8 12 3 3 8l9 5 9-5Z" /><path d="M3 8v9l9 5 9-5V8" /><path d="M12 13v9" /></svg>
);
export const IconCredit = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 10h19" /><path d="M6 15h4" /></svg>
);
export const IconChart = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M4 20V10" /><path d="M11 20V4" /><path d="M18 20v-7" /><path d="M3 20h18" /></svg>
);
export const IconReceipt = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M6 2h12v19l-2.5-1.5L13 21l-2.5-1.5L8 21l-2-1.5V2Z" /><path d="M9 7h6M9 11h6M9 15h4" /></svg>
);
export const IconUsers = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20c.7-3.6 3.2-5.8 6.5-5.8s5.8 2.2 6.5 5.8" /><circle cx="17.5" cy="8.5" r="2.6" /><path d="M15.8 14.4c2.6.4 4.4 2.3 5 5.6" /></svg>
);
export const IconShield = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M12 2.5 20 6v6c0 5-3.4 8.4-8 9.5-4.6-1.1-8-4.5-8-9.5V6l8-3.5Z" /><path d="M8.5 12.2l2.3 2.3 4.7-4.9" /></svg>
);
export const IconLogout = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>
);
export const IconMenu = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M3 6h18M3 12h18M3 18h18" /></svg>
);
export const IconClose = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const IconTable = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v12M19 8v12M3 20h18" /></svg>
);
export const IconPlus = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconCash = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.6" /><path d="M6 8v.01M18 16v.01" /></svg>
);
export const IconPhone = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><rect x="7" y="2.5" width="10" height="19" rx="2" /><path d="M11 18.5h2" /></svg>
);
export const IconCard = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><rect x="2.5" y="5" width="19" height="14" rx="2.2" /><path d="M2.5 9.5h19" /></svg>
);
export const IconCheck = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M4 12.5l5.5 5.5L20 7" /></svg>
);
export const IconAlert = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4M12 17v.01" /></svg>
);
export const IconArrowLeft = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
);

export const IconUser = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><circle cx="12" cy="8" r="4" /><path d="M5.5 20c.8-4 3.5-6 6.5-6s5.7 2 6.5 6" /></svg>
);
// NEW: IconSearch for search functionality
export const IconSearch = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15 15l6 6" /></svg>
);
export const IconCalendar = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 10h18M8 2v4M16 2v4" /></svg>
);
export const IconDownload = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
);
export const IconRefresh = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M23 4v6h-6" /><path d="M1 20v-6h6" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
);