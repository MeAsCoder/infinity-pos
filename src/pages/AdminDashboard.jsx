// AdminDashboard.jsx
// Mobile-responsiveness pass. Key fixes:
// 1. Tab bar had the same bug as WaiterDashboard.jsx — buttons had no
//    shrink-0, so flex compressed them into overlapping text on narrow
//    screens instead of letting the row scroll. Fixed.
// 2. Header controls (date-range select, refresh, export) and the custom
//    date range row had no wrap/stacking behavior for mobile — added.
// 3. Small action buttons (View Details, Mark Paid, Write Off, View Stock)
//    were sized for a mouse (~28px tall) — bumped to real touch targets.
// 4. Debt-by-waiter cards and the debt resolution modal's per-debt rows
//    now stack vertically on narrow screens instead of cramming info and
//    buttons into one row.
// Tables are left as horizontally-scrolling (overflow-x-auto) — a
// reasonable tradeoff for dense admin data rather than a full rebuild
// into mobile card lists.
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, apiFetch } from '../api/client';
import {
  IconArrowLeft,
  IconCalendar,
  IconDownload,
  IconRefresh,
  IconUsers,
  IconUser,
  IconPhone,
  IconCredit,
  IconAlert,
  IconChart,
  IconCheck,
  IconClose
} from '../components/Icons';
import StockReconciliationModal from '../components/StockReconciliationModal';

function money(n) { return `KES ${Number(n || 0).toLocaleString()}`; }

export default function AdminDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dateRange, setDateRange] = useState('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showFullReport, setShowFullReport] = useState(false);
  const [activeTab, setActiveTab] = useState('operations');
  const [debtsByWaiter, setDebtsByWaiter] = useState([]);
  const [selectedWaiter, setSelectedWaiter] = useState(null);
  const [waiterDebts, setWaiterDebts] = useState([]);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [waiterPerformance, setWaiterPerformance] = useState([]);
  const [loadingDebts, setLoadingDebts] = useState(false);
  const [operations, setOperations] = useState({ activeShifts: [], recentClosedShifts: [], flaggedWaiters: [] });

  // Stock Reconciliation State
  const [reconciliationData, setReconciliationData] = useState(null);
  const [showReconciliationModal, setShowReconciliationModal] = useState(false);
  const [reconciliationLoading, setReconciliationLoading] = useState(false);

  // Check if user has admin permissions
  const isAdmin = user?.permissions?.includes('sales.view_all') || user?.permissions?.includes('*');

  useEffect(() => {
    loadDashboard();
  }, [selectedDate, dateRange]);

  useEffect(() => {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    setCustomStartDate(weekAgo.toISOString().split('T')[0]);
    setCustomEndDate(today.toISOString().split('T')[0]);
  }, []);

  async function loadDashboard() {
    setLoading(true);
    setErr('');
    try {
      let params = new URLSearchParams();

      if (dateRange === 'today') {
        params.append('date', selectedDate);
      } else if (dateRange === 'yesterday') {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        params.append('date', yesterday.toISOString().split('T')[0]);
      } else if (dateRange === 'week') {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        params.append('startDate', startDate.toISOString().split('T')[0]);
        params.append('endDate', endDate.toISOString().split('T')[0]);
      } else if (dateRange === 'month') {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
        params.append('startDate', startDate.toISOString().split('T')[0]);
        params.append('endDate', endDate.toISOString().split('T')[0]);
      } else if (dateRange === 'custom') {
        if (customStartDate && customEndDate) {
          params.append('startDate', customStartDate);
          params.append('endDate', customEndDate);
        }
      }

      const result = await apiFetch(`/api/reports/dashboard?${params.toString()}`);
      setData(result);

      await Promise.all([
        loadDebtsByWaiter(),
        loadWaiterPerformance(),
        loadOperations()
      ]);

    } catch (e) {
      console.error('Error loading dashboard:', e);
      setErr(e.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }

  async function loadOperations() {
    try {
      const result = await apiFetch('/api/reports/operations');
      setOperations(result || { activeShifts: [], recentClosedShifts: [], flaggedWaiters: [] });
    } catch (e) {
      console.log('Could not load operations data:', e.message);
      setOperations({ activeShifts: [], recentClosedShifts: [], flaggedWaiters: [] });
    }
  }

  async function loadDebtsByWaiter() {
    setLoadingDebts(true);
    try {
      if (!isAdmin) {
        console.log('User does not have permission to view debts');
        setDebtsByWaiter([]);
        setLoadingDebts(false);
        return;
      }

      const waiters = await apiFetch('/api/users?role=WAITER');
      const debtsData = [];

      for (const waiter of waiters) {
        try {
          const debts = await apiFetch(`/api/sales/waiter/${waiter.id}/debts`);
          const total = debts.reduce((sum, d) => sum + (d.amount || 0), 0);

          if (total > 0) {
            debtsData.push({
              waiter,
              debts,
              total,
              count: debts.length
            });
          }
        } catch (e) {
          console.log(`Could not fetch debts for waiter ${waiter.id}:`, e.message);
        }
      }

      setDebtsByWaiter(debtsData);
    } catch (e) {
      console.error('Error loading debts by waiter:', e);
      setDebtsByWaiter([]);
    } finally {
      setLoadingDebts(false);
    }
  }

  async function loadWaiterPerformance() {
    try {
      if (!isAdmin) {
        const waiters = await apiFetch('/api/users?role=WAITER');
        const performanceData = waiters.map(w => ({
          id: w.id,
          name: w.name,
          transactions: 0,
          revenue: 0,
          avgTransaction: 0,
          outstandingDebt: 0,
          debtCount: 0,
          shortages: 0
        }));
        setWaiterPerformance(performanceData);
        return;
      }

      try {
        const performance = await apiFetch('/api/reports/waiters-performance');
        setWaiterPerformance(performance || []);
      } catch (e) {
        console.error('Error loading waiter performance:', e);
        const waiters = await apiFetch('/api/users?role=WAITER');
        const performanceData = waiters.map(w => ({
          id: w.id,
          name: w.name,
          transactions: 0,
          revenue: 0,
          avgTransaction: 0,
          outstandingDebt: 0,
          debtCount: 0,
          shortages: 0
        }));
        setWaiterPerformance(performanceData);
      }
    } catch (e) {
      console.error('Error in loadWaiterPerformance:', e);
      setWaiterPerformance([]);
    }
  }

  // Stock Reconciliation Functions
  async function loadReconciliation(shiftId) {
    setReconciliationLoading(true);
    try {
      const data = await apiFetch(`/api/stock-reconciliation/shift/${shiftId}`);
      setReconciliationData(data);
      setShowReconciliationModal(true);
    } catch (e) {
      console.error('Error loading reconciliation:', e);
      alert('Error loading stock reconciliation data: ' + (e.message || ''));
    } finally {
      setReconciliationLoading(false);
    }
  }

  async function saveReconciliationNotes(shiftId, notes) {
    try {
      await apiFetch('/api/stock-reconciliation/save-notes', {
        method: 'POST',
        body: { shift_id: shiftId, notes }
      });
      alert('Notes saved successfully!');
      await loadReconciliation(shiftId);
    } catch (e) {
      alert('Error saving notes: ' + e.message);
    }
  }

  async function resolveDebt(debtId, action, notes) {
    try {
      await apiFetch(`/api/sales/debts/${debtId}/resolve`, {
        method: 'POST',
        body: { action, notes }
      });
      await loadDebtsByWaiter();
      await loadDashboard();
      setShowDebtModal(false);
      setSelectedWaiter(null);
      setWaiterDebts([]);
    } catch (e) {
      setErr('Failed to resolve debt: ' + e.message);
    }
  }

  function getDateRangeLabel() {
    const labels = {
      today: 'Today',
      yesterday: 'Yesterday',
      week: 'Last 7 Days',
      month: 'Last 30 Days',
      custom: `${customStartDate} to ${customEndDate}`
    };
    return labels[dateRange] || 'Today';
  }

  if (err) {
    return (
      <div className="p-4 sm:p-6">
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-rose-700">
          <p className="font-medium">Error loading dashboard</p>
          <p className="text-sm mt-1">{err}</p>
          <button
            onClick={loadDashboard}
            className="mt-3 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-lg text-sm transition min-h-[44px]"
          >
            Retry
          </button>
        </div>
        {!navigator.onLine && (
          <div className="mt-3 text-amber-600 text-sm">
            ⚠️ You are offline. Please check your connection.
          </div>
        )}
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="p-8 text-center text-neutral-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand mx-auto"></div>
        <p className="mt-3">Loading dashboard data...</p>
      </div>
    );
  }

  const cards = [
    { label: "Revenue", value: money(data.todayRevenue || 0), sub: `${data.todayTransactionCount || 0} transactions` },
    { label: "Gross Profit", value: money(data.todayGrossProfit || 0) },
    { label: 'Stock Value', value: money(data.stockValue || 0) },
    { label: 'Credit Outstanding', value: money(data.creditOutstanding || 0), warn: (data.creditOutstanding || 0) > 0 },
    { label: 'Low Stock Items', value: data.lowStockCount || 0, warn: (data.lowStockCount || 0) > 0 },
    { label: 'Out of Stock', value: data.outOfStockCount || 0, warn: (data.outOfStockCount || 0) > 0 },
    { label: 'Open Shifts', value: data.openShifts || 0 },
    { label: 'Cash Shortages', value: money(data.todayShortages || 0), warn: (data.todayShortages || 0) > 0 },
    { label: 'Cash Surpluses', value: money(data.todaySurpluses || 0) },
    { label: 'Pending Sync', value: data.pendingSync || 0, warn: (data.pendingSync || 0) > 0 },
  ];

  return (
    <div className="p-3 sm:p-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="mb-3">
          <h1 className="text-xl sm:text-2xl font-bold text-ink-950">Dashboard</h1>
          <p className="text-sm text-neutral-500">
            {getDateRangeLabel()} - Updated: {new Date().toLocaleString()}
          </p>
        </div>

        {/* Header controls — stack full-width on mobile instead of one
            crowded flex-wrap row */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => {
              setDateRange(e.target.value);
              if (e.target.value === 'custom') {
                setShowDatePicker(true);
              } else {
                setShowDatePicker(false);
                loadDashboard();
              }
            }}
            className="border border-neutral-200 rounded-lg px-3 py-2.5 text-base focus:border-brand focus:ring-1 focus:ring-brand outline-none transition bg-white w-full sm:w-auto min-h-[44px]"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="custom">Custom Range</option>
          </select>

          {showDatePicker && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="border border-neutral-200 rounded-lg px-2 py-2.5 text-base focus:border-brand focus:ring-1 focus:ring-brand outline-none transition flex-1 min-w-0 min-h-[44px]"
                />
                <span className="text-neutral-400 text-sm shrink-0">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="border border-neutral-200 rounded-lg px-2 py-2.5 text-base focus:border-brand focus:ring-1 focus:ring-brand outline-none transition flex-1 min-w-0 min-h-[44px]"
                />
              </div>
              <button
                onClick={loadDashboard}
                className="bg-brand hover:bg-brand-dark text-white px-4 py-2.5 rounded-lg text-sm font-medium transition min-h-[44px] w-full sm:w-auto"
              >
                Apply
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={loadDashboard}
              className="border border-neutral-200 hover:bg-neutral-50 p-2.5 rounded-lg transition min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Refresh"
            >
              <IconRefresh className="w-4 h-4 text-neutral-600" />
            </button>

            <button
              onClick={() => {
                alert('Export functionality will be implemented here');
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-1.5 min-h-[44px] flex-1 sm:flex-none"
            >
              <IconDownload className="w-4 h-4" /> Export
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs — shrink-0 on each button prevents the same
          overlapping-label bug seen on WaiterDashboard's tab bar. */}
      <div className="flex flex-nowrap gap-1.5 sm:gap-2 mb-4 sm:mb-6 bg-white rounded-xl p-1 border border-neutral-200 overflow-x-auto">
        {[
          { id: 'operations', label: 'Operations', icon: IconAlert },
          { id: 'overview', label: 'Overview', icon: IconChart },
          { id: 'debts', label: 'Debt Management', icon: IconCredit },
          { id: 'waiters', label: 'Waiter Performance', icon: IconUsers }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition min-h-[40px] ${
              activeTab === tab.id
                ? 'bg-brand text-white'
                : 'text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            <tab.icon className="w-4 h-4 shrink-0" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Operations Tab */}
      {activeTab === 'operations' && (
        <div className="space-y-3 sm:space-y-4">
          {/* Active Shifts */}
          <div className="bg-white rounded-xl shadow-sm p-3 sm:p-4">
            <div className="flex flex-wrap justify-between items-center gap-2 mb-3 sm:mb-4">
              <h2 className="font-semibold text-ink-950 flex items-center gap-2 text-sm sm:text-base">
                <IconUsers className="w-5 h-5" /> Active Shifts
              </h2>
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-medium">
                {operations.activeShifts.length} on shift
              </span>
            </div>
            {operations.activeShifts.length === 0 ? (
              <p className="text-neutral-400 text-sm text-center py-6">No one is currently on shift.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 text-xs text-neutral-400 font-medium whitespace-nowrap">Waiter</th>
                      <th className="text-left py-2 text-xs text-neutral-400 font-medium whitespace-nowrap">Started</th>
                      <th className="text-right py-2 text-xs text-neutral-400 font-medium whitespace-nowrap">Transactions</th>
                      <th className="text-right py-2 text-xs text-neutral-400 font-medium whitespace-nowrap">Open Tabs</th>
                      <th className="text-right py-2 text-xs text-neutral-400 font-medium whitespace-nowrap">Cash Sales</th>
                      <th className="text-right py-2 text-xs text-neutral-400 font-medium whitespace-nowrap">Expected Cash</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operations.activeShifts.map(sh => (
                      <tr key={sh.shiftId} className="border-t hover:bg-neutral-50 transition">
                        <td className="py-2 font-medium text-ink-950 whitespace-nowrap">{sh.waiterName}</td>
                        <td className="py-2 text-neutral-500 whitespace-nowrap">{sh.startedAt ? new Date(sh.startedAt).toLocaleTimeString() : '-'}</td>
                        <td className="py-2 text-right">{sh.transactionCount}</td>
                        <td className="py-2 text-right">
                          {sh.openTabs > 0 ? (
                            <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full text-xs">{sh.openTabs}</span>
                          ) : sh.openTabs}
                        </td>
                        <td className="py-2 text-right whitespace-nowrap">{money(sh.cashSales)}</td>
                        <td className="py-2 text-right font-semibold whitespace-nowrap">{money(sh.expectedCashSoFar)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Flagged Cash-Variance Patterns */}
          <div className="bg-white rounded-xl shadow-sm p-3 sm:p-4">
            <h2 className="font-semibold text-ink-950 mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base">
              <IconAlert className="w-5 h-5" /> Flagged Cash-Variance Patterns
            </h2>
            {operations.flaggedWaiters.length === 0 ? (
              <p className="text-neutral-400 text-sm text-center py-6">No flagged patterns right now.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {operations.flaggedWaiters.map(fw => (
                  <div key={fw.waiterId} className="border border-neutral-200 rounded-lg p-3">
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-medium text-ink-950 text-sm">{fw.waiterName}</span>
                      <span className="text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-medium shrink-0">
                        score {fw.totalScore}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {fw.patterns.map((p, i) => (
                        <span key={i} className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                          {p.type.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recently Closed Shifts */}
          <div className="bg-white rounded-xl shadow-sm p-3 sm:p-4">
            <h2 className="font-semibold text-ink-950 mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base">
              <IconCheck className="w-5 h-5" /> Recently Closed Shifts
            </h2>
            {operations.recentClosedShifts.length === 0 ? (
              <p className="text-neutral-400 text-sm text-center py-6">No recently closed shifts.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 text-xs text-neutral-400 font-medium whitespace-nowrap">Waiter</th>
                      <th className="text-left py-2 text-xs text-neutral-400 font-medium whitespace-nowrap">Ended</th>
                      <th className="text-right py-2 text-xs text-neutral-400 font-medium whitespace-nowrap">Expected</th>
                      <th className="text-right py-2 text-xs text-neutral-400 font-medium whitespace-nowrap">Actual</th>
                      <th className="text-right py-2 text-xs text-neutral-400 font-medium whitespace-nowrap">Variance</th>
                      <th className="text-center py-2 text-xs text-neutral-400 font-medium whitespace-nowrap">Reconciliation</th>
                      <th className="text-center py-2 text-xs text-neutral-400 font-medium whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operations.recentClosedShifts.map(sh => {
                      const reconStatus = sh.reconciliation_status || 'PENDING';
                      const statusColors = {
                        'RECONCILED': 'text-emerald-600 bg-emerald-50',
                        'DISCREPANCY': 'text-rose-600 bg-rose-50',
                        'PENDING': 'text-yellow-600 bg-yellow-50'
                      };
                      return (
                        <tr key={sh.id} className="border-t hover:bg-neutral-50 transition">
                          <td className="py-2 font-medium text-ink-950 whitespace-nowrap">{sh.waiter_name}</td>
                          <td className="py-2 text-neutral-500 whitespace-nowrap">{sh.ended_at ? new Date(sh.ended_at).toLocaleString() : '-'}</td>
                          <td className="py-2 text-right whitespace-nowrap">{sh.expected_cash != null ? money(sh.expected_cash) : '-'}</td>
                          <td className="py-2 text-right whitespace-nowrap">{sh.actual_cash != null ? money(sh.actual_cash) : '-'}</td>
                          <td className={`py-2 text-right font-semibold whitespace-nowrap ${
                            sh.variance < 0 ? 'text-rose-600' : sh.variance > 0 ? 'text-amber-600' : 'text-emerald-600'
                          }`}>
                            {sh.variance == null ? '-' : `${sh.variance > 0 ? '+' : ''}${money(sh.variance)}`}
                          </td>
                          <td className="py-2 text-center whitespace-nowrap">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[reconStatus] || 'text-neutral-600 bg-neutral-100'}`}>
                              {reconStatus}
                            </span>
                            {sh.variance_units > 0 && (
                              <span className="text-xs text-rose-500 ml-1">
                                ({sh.variance_units} var.)
                              </span>
                            )}
                          </td>
                          <td className="py-2 text-center">
                            <button
                              onClick={() => loadReconciliation(sh.id)}
                              disabled={reconciliationLoading}
                              className="text-xs bg-brand hover:bg-brand-dark text-white px-3 py-2 rounded-lg transition font-medium disabled:opacity-50 min-h-[36px] whitespace-nowrap"
                            >
                              {reconciliationLoading ? 'Loading...' : 'View Stock'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3 mb-4 sm:mb-6">
            {cards.map(c => (
              <div key={c.label} className={`bg-white rounded-xl shadow-sm p-3 sm:p-4 border-l-4 ${c.warn ? 'border-rose-400' : 'border-brand'}`}>
                <div className="text-xs text-neutral-400 truncate" title={c.label}>{c.label}</div>
                <div className="text-lg sm:text-xl font-bold mt-1">{c.value}</div>
                {c.sub && <div className="text-xs text-neutral-400 mt-1">{c.sub}</div>}
              </div>
            ))}
          </div>

          {/* Charts and Reports */}
          <div className="grid md:grid-cols-2 gap-3 sm:gap-4">
            <div className="bg-white rounded-xl shadow-sm p-3 sm:p-4">
              <div className="flex justify-between items-center mb-3">
                <h2 className="font-semibold text-sm sm:text-base">Recent Sales</h2>
                <button
                  onClick={() => setShowFullReport(!showFullReport)}
                  className="text-sm text-brand hover:text-brand-dark font-medium min-h-[36px]"
                >
                  {showFullReport ? 'Show Less' : 'View All'}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 text-xs text-neutral-400 font-medium whitespace-nowrap">Receipt</th>
                      <th className="text-left py-2 text-xs text-neutral-400 font-medium whitespace-nowrap">Table</th>
                      <th className="text-left py-2 text-xs text-neutral-400 font-medium whitespace-nowrap">Date</th>
                      <th className="text-right py-2 text-xs text-neutral-400 font-medium whitespace-nowrap">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(showFullReport ? data.allSales || [] : data.recentSales || []).slice(0, showFullReport ? 100 : 10).map(s => (
                      <tr key={s.id} className="border-t">
                        <td className="py-2 font-medium whitespace-nowrap">{s.receipt_number}</td>
                        <td className="py-2 text-neutral-400 whitespace-nowrap">{s.tab_label || '-'}</td>
                        <td className="py-2 text-neutral-400 whitespace-nowrap">{new Date(s.server_created_at).toLocaleString()}</td>
                        <td className="py-2 text-right font-medium whitespace-nowrap">{money(s.total)}</td>
                      </tr>
                    ))}
                    {(!data.recentSales || data.recentSales.length === 0) && (
                      <tr><td className="py-4 text-neutral-400 text-center" colSpan={4}>No sales for this period</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-3 sm:p-4">
              <h2 className="font-semibold mb-3 text-sm sm:text-base">Recent Stock Movements</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 text-xs text-neutral-400 font-medium whitespace-nowrap">Product</th>
                      <th className="text-left py-2 text-xs text-neutral-400 font-medium whitespace-nowrap">Reason</th>
                      <th className="text-right py-2 text-xs text-neutral-400 font-medium whitespace-nowrap">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.recentStockMoves || []).slice(0, 10).map(m => (
                      <tr key={m.id} className="border-t">
                        <td className="py-2 whitespace-nowrap">{m.product_name}</td>
                        <td className="py-2 text-neutral-400 whitespace-nowrap">{m.reason}</td>
                        <td className={`py-2 text-right font-medium whitespace-nowrap ${m.change_ml < 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                          {m.change_ml > 0 ? '+' : ''}{m.change_ml}ml
                        </td>
                      </tr>
                    ))}
                    {(!data.recentStockMoves || data.recentStockMoves.length === 0) && (
                      <tr><td className="py-4 text-neutral-400 text-center" colSpan={3}>No stock movements</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-3 sm:gap-4 mt-3 sm:mt-4">
            <div className="bg-white rounded-xl shadow-sm p-3 sm:p-4">
              <h2 className="font-semibold mb-3 text-sm sm:text-base">Top Selling Products</h2>
              <div className="space-y-2">
                {(data.topProducts || []).slice(0, 5).map(p => (
                  <div key={p.id} className="flex justify-between items-center gap-2 border-b border-neutral-100 pb-2">
                    <span className="text-sm text-ink-950 truncate">{p.name}</span>
                    <span className="text-sm font-medium shrink-0">{p.quantity_sold} units</span>
                  </div>
                ))}
                {(!data.topProducts || data.topProducts.length === 0) && (
                  <p className="text-neutral-400 text-sm text-center py-4">No data available</p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-3 sm:p-4">
              <h2 className="font-semibold mb-3 text-sm sm:text-base">Payment Methods</h2>
              <div className="space-y-2">
                {(data.paymentMethods || []).map(p => (
                  <div key={p.method} className="flex justify-between items-center gap-2 border-b border-neutral-100 pb-2">
                    <span className="text-sm text-ink-950">{p.method}</span>
                    <span className="text-sm font-medium">{money(p.total)}</span>
                  </div>
                ))}
                {(!data.paymentMethods || data.paymentMethods.length === 0) && (
                  <p className="text-neutral-400 text-sm text-center py-4">No data available</p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-3 sm:p-4">
              <h2 className="font-semibold mb-3 text-sm sm:text-base">Summary</h2>
              <div className="space-y-2">
                <div className="flex justify-between items-center border-b border-neutral-100 pb-2">
                  <span className="text-sm text-neutral-600">Total Transactions</span>
                  <span className="text-sm font-medium">{data.totalTransactions || 0}</span>
                </div>
                <div className="flex justify-between items-center border-b border-neutral-100 pb-2">
                  <span className="text-sm text-neutral-600">Average Transaction</span>
                  <span className="text-sm font-medium">{money(data.averageTransaction || 0)}</span>
                </div>
                <div className="flex justify-between items-center border-b border-neutral-100 pb-2">
                  <span className="text-sm text-neutral-600">Total Discounts</span>
                  <span className="text-sm font-medium">{money(data.totalDiscounts || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-600">Unique Customers</span>
                  <span className="text-sm font-medium">{data.uniqueCustomers || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Debt Management Tab */}
      {activeTab === 'debts' && (
        <div className="bg-white rounded-xl shadow-sm p-3 sm:p-4">
          <h2 className="font-semibold text-ink-950 mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base">
            <IconCredit className="w-5 h-5" /> Debt Management by Waiter
          </h2>

          {!isAdmin ? (
            <div className="text-center py-8 text-amber-600">
              <IconAlert className="w-12 h-12 mx-auto mb-3 text-amber-400" />
              <p className="font-medium">Permission Required</p>
              <p className="text-sm mt-1">You need admin privileges to view debt management.</p>
            </div>
          ) : loadingDebts ? (
            <div className="text-center py-8 text-neutral-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand mx-auto"></div>
              <p className="mt-3">Loading debts...</p>
            </div>
          ) : debtsByWaiter.length === 0 ? (
            <div className="text-center py-8 text-neutral-400">
              <IconCheck className="w-12 h-12 mx-auto mb-3 text-emerald-400" />
              <p>No outstanding debts from any waiter.</p>
              <p className="text-sm mt-1">All customer debts have been settled.</p>
              <button
                onClick={loadDebtsByWaiter}
                className="mt-4 text-brand hover:text-brand-dark text-sm font-medium min-h-[40px]"
              >
                Refresh
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
              {debtsByWaiter.map((item, index) => (
                <div key={item.waiter.id || `waiter-${index}`} className="border border-neutral-200 rounded-lg p-3 sm:p-4 hover:shadow-card transition">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-ink-950 text-sm sm:text-base">{item.waiter.name}</h3>
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                          {item.count} debt(s)
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 mt-1">
                        Total outstanding: <span className="font-semibold text-rose-600">{money(item.total)}</span>
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedWaiter(item.waiter);
                        setWaiterDebts(item.debts);
                        setShowDebtModal(true);
                      }}
                      className="text-sm bg-brand hover:bg-brand-dark text-white px-3 py-2 rounded-lg transition min-h-[40px] w-full sm:w-auto"
                    >
                      View Details
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {item.debts.slice(0, 3).map(debt => (
                      <div key={debt.id || `debt-${debt.sale_id}`} className="flex justify-between items-center gap-2 text-sm border-b border-neutral-100 pb-1.5">
                        <span className="text-neutral-600 truncate">{debt.customer_name}</span>
                        <span className="font-medium text-rose-600 shrink-0">{money(debt.amount)}</span>
                      </div>
                    ))}
                    {item.debts.length > 3 && (
                      <div className="text-xs text-neutral-400 text-center">
                        +{item.debts.length - 3} more debts
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Waiter Performance Tab */}
      {activeTab === 'waiters' && (
        <div className="bg-white rounded-xl shadow-sm p-3 sm:p-4">
          <h2 className="font-semibold text-ink-950 mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base">
            <IconUsers className="w-5 h-5" /> Waiter Performance
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 text-xs text-neutral-400 font-medium whitespace-nowrap">Waiter</th>
                  <th className="text-right py-2 text-xs text-neutral-400 font-medium whitespace-nowrap">Transactions</th>
                  <th className="text-right py-2 text-xs text-neutral-400 font-medium whitespace-nowrap">Revenue</th>
                  <th className="text-right py-2 text-xs text-neutral-400 font-medium whitespace-nowrap">Avg Ticket</th>
                  <th className="text-right py-2 text-xs text-neutral-400 font-medium whitespace-nowrap">Outstanding Debt</th>
                  <th className="text-right py-2 text-xs text-neutral-400 font-medium whitespace-nowrap">Shortages</th>
                </tr>
              </thead>
              <tbody>
                {(waiterPerformance || []).map(w => (
                  <tr key={w.id} className="border-t hover:bg-neutral-50 transition">
                    <td className="py-2 font-medium text-ink-950 whitespace-nowrap">{w.name}</td>
                    <td className="py-2 text-right">{w.transactions || 0}</td>
                    <td className="py-2 text-right font-medium whitespace-nowrap">{money(w.revenue || 0)}</td>
                    <td className="py-2 text-right whitespace-nowrap">{money(w.avgTransaction || 0)}</td>
                    <td className="py-2 text-right font-medium text-rose-600 whitespace-nowrap">
                      {money(w.outstandingDebt || 0)}
                    </td>
                    <td className="py-2 text-right text-rose-600 whitespace-nowrap">{money(w.shortages || 0)}</td>
                  </tr>
                ))}
                {(!waiterPerformance || waiterPerformance.length === 0) && (
                  <tr><td className="py-4 text-neutral-400 text-center" colSpan={6}>No waiter data available</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Debt Resolution Modal */}
      {showDebtModal && selectedWaiter && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-4 sm:p-6">
            <div className="flex justify-between items-start mb-4 gap-2">
              <div>
                <h3 className="font-display text-lg sm:text-xl font-semibold text-ink-950 flex items-center gap-2">
                  <IconUser className="w-5 h-5" /> {selectedWaiter.name}
                </h3>
                <p className="text-sm text-neutral-500 mt-1">
                  {waiterDebts.length} pending debt(s) - Total: {money(waiterDebts.reduce((sum, d) => sum + d.amount, 0))}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowDebtModal(false);
                  setSelectedWaiter(null);
                  setWaiterDebts([]);
                }}
                className="text-neutral-400 hover:text-neutral-700 w-9 h-9 flex items-center justify-center shrink-0"
              >
                <IconClose className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {waiterDebts.map(debt => (
                <div key={debt.id || `debt-${debt.sale_id}`} className="border border-neutral-200 rounded-lg p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-ink-950 text-sm">{debt.customer_name}</span>
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">PENDING</span>
                      </div>
                      {debt.customer_phone && (
                        <p className="text-xs text-neutral-400 flex items-center gap-1 mt-0.5">
                          <IconPhone className="w-3 h-3" /> {debt.customer_phone}
                        </p>
                      )}
                      {debt.receipt_number && (
                        <p className="text-xs text-neutral-400 mt-0.5">
                          Receipt: {debt.receipt_number}
                        </p>
                      )}
                      {debt.notes && (
                        <p className="text-xs text-neutral-400 mt-0.5">{debt.notes}</p>
                      )}
                      <p className="text-xs text-neutral-400 mt-1">
                        {debt.created_at ? new Date(debt.created_at).toLocaleString() : '-'}
                      </p>
                    </div>
                    <div className="flex sm:flex-col sm:text-right items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0">
                      <div className="font-bold text-rose-600 text-sm">{money(debt.amount)}</div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => resolveDebt(debt.id, 'PAID', 'Customer paid in full')}
                          className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg transition min-h-[36px] whitespace-nowrap"
                        >
                          Mark Paid
                        </button>
                        <button
                          onClick={() => resolveDebt(debt.id, 'WRITE_OFF', 'Bad debt written off')}
                          className="text-xs bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-lg transition min-h-[36px] whitespace-nowrap"
                        >
                          Write Off
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  setShowDebtModal(false);
                  setSelectedWaiter(null);
                  setWaiterDebts([]);
                }}
                className="w-full sm:w-auto px-4 py-2.5 border border-neutral-200 rounded-lg text-neutral-600 hover:bg-neutral-50 transition min-h-[44px]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Reconciliation Modal */}
      {showReconciliationModal && reconciliationData && (
        <StockReconciliationModal
          data={reconciliationData}
          onClose={() => {
            setShowReconciliationModal(false);
            setReconciliationData(null);
          }}
          onSaveNotes={saveReconciliationNotes}
          loading={reconciliationLoading}
        />
      )}

      {/* Offline Warning */}
      {!navigator.onLine && (
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-700 text-sm">
          ⚠️ You are offline. Some data may be outdated. Connect to see real-time updates.
        </div>
      )}
    </div>
  );
}
