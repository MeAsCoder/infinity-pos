// db/offlineDb.js
import Dexie from 'dexie';

// All operational data lives here, NOT in localStorage/sessionStorage/memory.
// This survives app restarts and browser crashes, per the offline-durability
// requirement in the spec.
export const db = new Dexie('infinity_pos');

// Version 1: Core tables
db.version(1).stores({
  session: 'id',
  currentShift: 'id',
  products: 'id, name',
  customers: 'id, name, phone',
  outbox: '++id, uuid, kind, status, createdAt',
});

// Version 2: Local cache of open tabs
db.version(2).stores({
  session: 'id',
  currentShift: 'id',
  products: 'id, name',
  customers: 'id, name, phone',
  outbox: '++id, uuid, kind, status, createdAt',
  openTabs: 'localId, shiftId, status',
});

// Version 3: Add waiterStats and debt_logs
db.version(3).stores({
  session: 'id',
  currentShift: 'id',
  products: 'id, name',
  customers: 'id, name, phone',
  outbox: '++id, uuid, kind, status, createdAt',
  openTabs: 'localId, shiftId, status',
  waiterStats: 'id, updatedAt',
  debt_logs: '++id, sale_id, customer_id, waiter_id, shift_id, status, created_at',
});

export const OUTBOX_KINDS = {
  SALE: { endpoint: '/api/sales', method: 'POST' },
  OPEN_TAB: { endpoint: '/api/sales/tabs', method: 'POST' },
  ADD_TAB_ITEMS: { endpoint: (p) => `/api/sales/${p.saleId}/items`, method: 'POST' },
  SETTLE_TAB: { endpoint: (p) => `/api/sales/${p.saleId}/settle`, method: 'POST' },
  SHIFT_START: { endpoint: '/api/shifts/start', method: 'POST' },
  SHIFT_END: { endpoint: (p) => `/api/shifts/${p.shiftId}/end`, method: 'POST' },
  STOCK_RECEIPT: { endpoint: '/api/inventory/receive', method: 'POST' },
  STOCK_ADJUSTMENT: { endpoint: '/api/inventory/adjust', method: 'POST' },
  EXPENSE: { endpoint: '/api/expenses', method: 'POST' },
  CREDIT_REPAYMENT: { endpoint: (p) => `/api/customers/${p.customerId}/repay`, method: 'POST' },
  RECORD_DEBT: { endpoint: (p) => `/api/sales/${p.saleId}/debt`, method: 'POST' },
};

export async function enqueue(kind, uuid, payload) {
  await db.outbox.add({ uuid, kind, payload, status: 'pending', createdAt: new Date().toISOString(), lastError: null, attempts: 0 });
}

export async function getPendingCount() {
  return db.outbox.where('status').equals('pending').count();
}

export async function replaceOpenTabsCache(shiftId, serverTabs) {
  await db.openTabs.where('shiftId').equals(shiftId).delete();
  await db.openTabs.bulkPut(serverTabs.map(t => ({ ...t, localId: String(t.id), shiftId })));
}

export async function upsertLocalTab(localId, tab) {
  await db.openTabs.put({ ...tab, localId, shiftId: tab.shift_id });
}

export async function removeLocalTab(localId) {
  await db.openTabs.delete(localId);
}

export async function listLocalOpenTabs(shiftId) {
  const rows = await db.openTabs.where('shiftId').equals(shiftId).toArray();
  return rows.filter(r => r.status === 'OPEN');
}

// ============================================================================
// DEBT HELPER FUNCTIONS
// ============================================================================

export async function saveLocalDebt(debtData) {
  try {
    const debt = {
      ...debtData,
      created_at: debtData.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const id = await db.debt_logs.put(debt);
    return { ...debt, id };
  } catch (error) {
    console.error('Failed to save local debt:', error);
    throw error;
  }
}

export async function getLocalDebts(waiterId) {
  try {
    const debts = await db.debt_logs.toArray();
    if (waiterId) {
      return debts.filter(d => d.waiter_id === waiterId);
    }
    return debts;
  } catch (error) {
    console.error('Failed to get local debts:', error);
    return [];
  }
}

export async function updateLocalDebt(id, updates) {
  try {
    await db.debt_logs.update(id, { ...updates, updated_at: new Date().toISOString() });
  } catch (error) {
    console.error('Failed to update local debt:', error);
  }
}

export async function deleteLocalDebt(id) {
  try {
    await db.debt_logs.delete(id);
  } catch (error) {
    console.error('Failed to delete local debt:', error);
  }
}

export async function saveWaiterStats(data) {
  try {
    await db.waiterStats.put({
      id: 'current',
      stats: data.stats || {},
      sales: data.sales || [],
      credits: data.credits || [],
      outstandingDebt: data.outstandingDebt || 0,
      allTimeDebts: data.allTimeDebts || [],
      totalAllTimeDebt: data.totalAllTimeDebt || 0,
      updatedAt: new Date().toISOString()
    });
    return true;
  } catch (error) {
    console.error('Failed to save waiter stats:', error);
    return false;
  }
}

export async function getWaiterStats() {
  try {
    return await db.waiterStats.get('current');
  } catch (error) {
    console.error('Failed to get waiter stats:', error);
    return null;
  }
}

export async function clearWaiterStats() {
  try {
    await db.waiterStats.delete('current');
    return true;
  } catch (error) {
    console.error('Failed to clear waiter stats:', error);
    return false;
  }
}

export function isWaiterStatsFresh(cachedStats, maxAgeMinutes = 5) {
  if (!cachedStats || !cachedStats.updatedAt) return false;
  const age = Date.now() - new Date(cachedStats.updatedAt).getTime();
  return age < maxAgeMinutes * 60 * 1000;
}