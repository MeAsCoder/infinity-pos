// src/components/SyncBadge.jsx
import React from 'react';
import { useSync } from '../context/SyncContext';

const CONFIG = {
  synced: { color: 'bg-emerald-400', label: 'Online' },
  syncing: { color: 'bg-gold-500', label: 'Syncing' },
  conflict: { color: 'bg-orange-500', label: 'Conflict' },
  offline: { color: 'bg-rose-500', label: 'Offline' },
};

export default function SyncBadge({ compact = false }) {
  const { status, pendingCount, conflictCount } = useSync();
  const cfg = CONFIG[status];

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.color} ${status === 'syncing' ? 'animate-pulse' : ''}`} />
        {(pendingCount > 0 || conflictCount > 0) && (
          <span className="text-[9px] text-white/70">{pendingCount + conflictCount}</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs text-white/80 bg-white/[0.04] rounded-lg px-3 py-1.5">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.color} ${status === 'syncing' ? 'animate-pulse' : ''}`} />
      <span className="flex-1 text-[11px]">{cfg.label}</span>
      {pendingCount > 0 && <span className="bg-white/10 rounded-full px-1.5 py-0.5 text-[9px] font-medium">{pendingCount}</span>}
      {conflictCount > 0 && <span className="bg-orange-500/90 rounded-full px-1.5 py-0.5 text-[9px] font-medium">{conflictCount}</span>}
    </div>
  );
}