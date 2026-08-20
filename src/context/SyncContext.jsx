import React, { createContext, useContext, useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/offlineDb';
import { startAutoSync, onSyncEvent } from '../db/sync';

const SyncContext = createContext(null);

export function SyncProvider({ children }) {
  const [online, setOnline] = useState(navigator.onLine);
  const [lastSync, setLastSync] = useState(null);

  const pendingCount = useLiveQuery(() => db.outbox.where('status').equals('pending').count(), [], 0);
  const conflictCount = useLiveQuery(() => db.outbox.where('status').equals('conflict').count(), [], 0);

  useEffect(() => {
    startAutoSync();
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    const unsub = onSyncEvent((evt) => { if (evt.type === 'cycle-complete') setLastSync(new Date()); });
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); unsub(); };
  }, []);

  let status = 'offline';
  if (online && pendingCount === 0 && conflictCount === 0) status = 'synced';
  else if (online && pendingCount > 0) status = 'syncing';
  else if (online && conflictCount > 0) status = 'conflict';

  return (
    <SyncContext.Provider value={{ online, pendingCount, conflictCount, status, lastSync }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  return useContext(SyncContext);
}
