import { db, OUTBOX_KINDS } from './offlineDb';
import { API_BASE } from '../api/client';

let syncing = false;
const listeners = new Set();

export function onSyncEvent(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(evt) { listeners.forEach(fn => fn(evt)); }

async function patchDependentIds(field, localId, realId) {
  const dependents = await db.outbox.where('status').equals('pending').toArray();
  for (const dep of dependents) {
    if (dep.payload?.[field] === localId) {
      await db.outbox.update(dep.id, { payload: { ...dep.payload, [field]: realId } });
    }
  }
}

/**
 * Pushes every pending outbox item to the server IN ORDER (oldest first),
 * so a shift-start always lands before the sales that depend on it, etc.
 * Each request is idempotent server-side (keyed on the client uuid), so a
 * retried/duplicated push is always safe — the duplicate-sync acceptance
 * test (TEST 9) depends on this.
 */
export async function runSync() {
  if (syncing || !navigator.onLine) return { pushed: 0, failed: 0 };
  syncing = true;
  let pushed = 0, failed = 0;
  try {
    const session = await db.session.get(1);
    if (!session?.token) return { pushed: 0, failed: 0 };

    const pending = await db.outbox.where('status').equals('pending').sortBy('id');
    for (const item of pending) {
      const kindDef = OUTBOX_KINDS[item.kind];
      if (!kindDef) continue;
      const path = typeof kindDef.endpoint === 'function' ? kindDef.endpoint(item.payload) : kindDef.endpoint;
      try {
        const res = await fetch(`${API_BASE}${path}`, {
          method: kindDef.method,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
          body: JSON.stringify(item.payload),
          signal: AbortSignal.timeout(15000),
        });
        const data = await res.json().catch(() => null);
        if (res.ok) {
          await db.outbox.update(item.id, { status: 'synced', serverResponse: data });
          pushed++;
          emit({ type: 'item-synced', item });

          // A shift OR a tab opened offline is stored under a temporary
          // "local-<uuid>" id. Once the server assigns the real numeric id,
          // patch every other still-pending outbox item that referenced the
          // temporary id (sales/expenses/shift-end for shifts; add-items/
          // settle for tabs), and patch the relevant local cache too —
          // otherwise those items would sync against an id the server has
          // never heard of.
          if (item.kind === 'SHIFT_START' && data?.id) {
            await patchDependentIds('shiftId', `local-${item.uuid}`, data.id);
            const cached = await db.currentShift.get(1);
            if (cached?.shift?.id === `local-${item.uuid}`) {
              await db.currentShift.put({ id: 1, shift: data });
            }
          }
          if (item.kind === 'OPEN_TAB' && data?.id) {
            await patchDependentIds('saleId', `local-${item.uuid}`, data.id);
            // Rekey the local tabs cache entry from the temporary id to the
            // real one, keeping whatever optimistic state (added items etc.)
            // has accumulated on it since it was opened.
            const localTab = await db.openTabs.get(`local-${item.uuid}`);
            if (localTab) {
              await db.openTabs.delete(`local-${item.uuid}`);
              await db.openTabs.put({ ...localTab, ...data, localId: String(data.id) });
            }
          }
          if (item.kind === 'SETTLE_TAB') {
            // The tab is no longer open — drop it from the local cache.
            const key = String(item.payload.saleId);
            await db.openTabs.delete(key);
          }
        } else if (res.status >= 400 && res.status < 500) {
          // Validation/authorization error — will not succeed on retry without a
          // human resolving it. Flagged, never silently dropped.
          await db.outbox.update(item.id, { status: 'conflict', lastError: data?.error || `HTTP ${res.status}`, attempts: (item.attempts || 0) + 1 });
          failed++;
          emit({ type: 'item-conflict', item, error: data?.error });
        } else {
          await db.outbox.update(item.id, { attempts: (item.attempts || 0) + 1, lastError: `HTTP ${res.status}` });
          failed++;
        }
      } catch (e) {
        // Network dropped mid-sync — leave as pending, try again next cycle.
        await db.outbox.update(item.id, { attempts: (item.attempts || 0) + 1, lastError: e.message });
        failed++;
        break; // stop this cycle; connectivity likely gone again
      }
    }
  } finally {
    syncing = false;
    emit({ type: 'cycle-complete', pushed, failed });
  }
  return { pushed, failed };
}

let intervalHandle = null;
export function startAutoSync(intervalMs = 8000) {
  if (intervalHandle) return;
  window.addEventListener('online', runSync);
  intervalHandle = setInterval(runSync, intervalMs);
  runSync();
}
export function stopAutoSync() {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
  window.removeEventListener('online', runSync);
}
