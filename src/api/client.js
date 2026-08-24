// api/client.js
import { db } from '../db/offlineDb';

export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

export class OfflineError extends Error {
  constructor() { super('offline'); this.name = 'OfflineError'; }
}

async function getToken() {
  const session = await db.session.get(1);
  return session?.token;
}

/**
 * Calls the server. If the browser is offline, or the fetch itself fails
 * (DNS/connection refused/timeout), throws OfflineError so the caller can
 * fall back to the local outbox instead of showing a hard failure.
 */
export async function apiFetch(path, { method = 'GET', body, skipAuth = false } = {}) {
  if (!navigator.onLine) throw new OfflineError();

  const headers = { 'Content-Type': 'application/json' };
  if (!skipAuth) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10000),
    });
  } catch (e) {
    throw new OfflineError();
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  // Auth
  login: (username, password, deviceId, deviceName) =>
    apiFetch('/api/auth/login', { method: 'POST', body: { username, password, deviceId, deviceName }, skipAuth: true }),
  me: () => apiFetch('/api/auth/me'),

  // Products
  products: (params = '') => apiFetch(`/api/products${params}`),
  product: (id) => apiFetch(`/api/products/${id}`),
  createProduct: (body) => apiFetch('/api/products', { method: 'POST', body }),
  updateProduct: (id, body) => apiFetch(`/api/products/${id}`, { method: 'PUT', body }),
  setPrice: (productId, unitId, body) => apiFetch(`/api/products/${productId}/units/${unitId}/price`, { method: 'PUT', body }),
  addUnit: (productId, body) => apiFetch(`/api/products/${productId}/units`, { method: 'POST', body }),

  // Shifts
  currentShift: () => apiFetch('/api/shifts/current'),
  shiftReport: (id) => apiFetch(`/api/shifts/${id}/report`),
  shifts: (params = '') => apiFetch(`/api/shifts${params}`),
  startShift: (body) => apiFetch('/api/shifts/start', { method: 'POST', body }),
  endShift: (shiftId, body) => apiFetch(`/api/shifts/${shiftId}/end`, { method: 'POST', body }),

  // Sales
  mySales: (shiftId) => apiFetch(`/api/sales/my-shift/${shiftId}`),
  sales: (params = '') => apiFetch(`/api/sales${params}`),
  refund: (saleId, body) => apiFetch(`/api/sales/${saleId}/refund`, { method: 'POST', body }),

  // Tabs
  openTabs: (shiftId) => apiFetch(`/api/sales/open${shiftId ? `?shiftId=${shiftId}` : ''}`),
  openTab: (body) => apiFetch('/api/sales/tabs', { method: 'POST', body }),
  addTabItems: (saleId, body) => apiFetch(`/api/sales/${saleId}/items`, { method: 'POST', body }),
  settleTab: (saleId, body) => apiFetch(`/api/sales/${saleId}/settle`, { method: 'POST', body }),
  voidTab: (saleId, body) => apiFetch(`/api/sales/${saleId}/void`, { method: 'POST', body }),
  transferTab: (saleId, body) => apiFetch(`/api/sales/${saleId}/transfer`, { method: 'POST', body }),

  // Customers
  customers: (params = '') => apiFetch(`/api/customers${params}`),
  createCustomer: (body) => apiFetch('/api/customers', { method: 'POST', body }),
  customer: (id) => apiFetch(`/api/customers/${id}`),
  writeOff: (id, body) => apiFetch(`/api/customers/${id}/writeoff`, { method: 'POST', body }),

  // Inventory
  receipts: () => apiFetch('/api/inventory/receipts'),
  ledger: (productId) => apiFetch(`/api/inventory/ledger/${productId}`),
  lowStock: () => apiFetch('/api/inventory/low-stock'),
  suppliers: () => apiFetch('/api/expenses/suppliers'),
  createSupplier: (body) => apiFetch('/api/expenses/suppliers', { method: 'POST', body }),
  receiveStock: (body) => apiFetch('/api/inventory/receive', { method: 'POST', body }),
  adjustStock: (body) => apiFetch('/api/inventory/adjust', { method: 'POST', body }),
  stocktake: (body) => apiFetch('/api/inventory/stocktake', { method: 'POST', body }),
  stocktakeCount: (id, body) => apiFetch(`/api/inventory/stocktake/${id}/count`, { method: 'POST', body }),
  stocktakeApprove: (id) => apiFetch(`/api/inventory/stocktake/${id}/approve`, { method: 'POST', body }),
  stocktakeDiscrepancies: (limit = 200) => apiFetch(`/api/inventory/stocktake/discrepancies?limit=${limit}`),

  // Expenses
  expenses: (params = '') => apiFetch(`/api/expenses${params}`),

  // Users
  users: () => apiFetch('/api/users'),
  roles: () => apiFetch('/api/users/roles'),
  createUser: (body) => apiFetch('/api/users', { method: 'POST', body }),
  updateUser: (id, body) => apiFetch(`/api/users/${id}`, { method: 'PUT', body }),

  // Reports
  dashboard: () => apiFetch('/api/reports/dashboard'),
  operations: () => apiFetch('/api/reports/operations'),
  salesReport: (params = '') => apiFetch(`/api/reports/sales${params}`),
  productReport: (params = '') => apiFetch(`/api/reports/products${params}`),
  waiterReport: (params = '') => apiFetch(`/api/reports/waiters${params}`),
  profitReport: (params = '') => apiFetch(`/api/reports/profit${params}`),
  stockReport: () => apiFetch('/api/reports/stock'),
  creditReport: () => apiFetch('/api/reports/credit'),
  exportReport: (params = '') => apiFetch(`/api/reports/export${params}`),

  // Stock Reconciliation (NEW)
  getStockReconciliation: (shiftId) => 
    apiFetch(`/api/stock-reconciliation/shift/${shiftId}`),
  
  saveReconciliationNotes: (data) => 
    apiFetch('/api/stock-reconciliation/save-notes', { method: 'POST', body: data }),
  
  getRecentReconciliations: (limit = 20) => 
    apiFetch(`/api/stock-reconciliation/recent?limit=${limit}`),
  
  updateReconciliationStatus: (data) => 
    apiFetch('/api/stock-reconciliation/update-status', { method: 'POST', body: data }),

  // Audit
  auditLog: (params = '') => apiFetch(`/api/audit${params}`),
  requestCorrection: (body) => apiFetch('/api/audit/corrections', { method: 'POST', body }),
  corrections: (params = '') => apiFetch(`/api/audit/corrections${params}`),
  resolveCorrection: (id, body) => apiFetch(`/api/audit/corrections/${id}/resolve`, { method: 'POST', body }),

  // Settings
  settings: () => apiFetch('/api/settings'),
  updateSetting: (key, value) => apiFetch(`/api/settings/${key}`, { method: 'PUT', body: { value } }),

  // Sync
  ping: () => apiFetch('/api/sync/ping'),
};