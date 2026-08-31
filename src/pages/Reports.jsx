import React, { useEffect, useState, useMemo } from 'react';
import { api, apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  TrendingUp,
  Package,
  Users,
  Wallet,
  Boxes,
  Calendar,
  ChevronDown,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Inbox,
} from 'lucide-react';

// Mobile-responsiveness pass:
// 1. Tab bar relied on overflow-x-auto for scrolling but the buttons had no
//    shrink-0 — same bug found in WaiterDashboard.jsx and AdminDashboard.jsx.
//    Flex compressed the 5 tabs to fit instead of letting the row overflow,
//    so labels would overlap/clip on a narrow phone. Fixed.
// 2. The custom date-range row (two native date inputs side by side) had no
//    wrap behavior and could get tight on a 320-375px screen. Now wraps and
//    goes full-width on mobile.
// 3. Stock report filter buttons bumped to a real touch target.
// This file was already in decent shape otherwise (consistent text sizing,
// horizontally-scrolling tables with whitespace-nowrap) so the rest is
// left as-is.

function money(n) { return `KES ${Number(n || 0).toLocaleString()}`; }

const TABS = [
  { key: 'Sales', label: 'Sales', icon: TrendingUp },
  { key: 'Products', label: 'Products', icon: Package },
  { key: 'Waiters', label: 'Waiters', icon: Users },
  { key: 'Profit', label: 'Profit', icon: Wallet },
  { key: 'Stock', label: 'Stock', icon: Boxes },
];

export default function Reports() {
  const [tab, setTab] = useState('Sales');
  const [dateRange, setDateRange] = useState('today');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    setStartDate(weekAgo.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
  }, []);

  const getDateRangeLabel = () => {
    const labels = {
      today: 'Today',
      yesterday: 'Yesterday',
      week: 'Last 7 days',
      month: 'Last 30 days',
      custom: `${startDate} – ${endDate}`,
    };
    return labels[dateRange] || 'Today';
  };

  return (
    <div className="min-h-full bg-slate-50 p-3 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:justify-between sm:items-end gap-3 mb-5">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Reports</h1>
            <p className="flex items-center gap-1.5 text-sm text-slate-500 mt-0.5">
              <Calendar size={14} className="text-slate-400" />
              {getDateRangeLabel()}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
            <div className="relative">
              <select
                value={dateRange}
                onChange={(e) => {
                  setDateRange(e.target.value);
                  setShowDatePicker(e.target.value === 'custom');
                }}
                className="w-full sm:w-auto appearance-none border border-slate-200 rounded-lg pl-3 pr-8 py-2.5 text-base text-slate-700 bg-white shadow-sm focus:border-slate-400 focus:ring-2 focus:ring-slate-200 outline-none transition cursor-pointer min-h-[44px]"
              >
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="week">Last 7 days</option>
                <option value="month">Last 30 days</option>
                <option value="custom">Custom range</option>
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>

            {showDatePicker && (
              <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-lg px-2 py-2 shadow-sm">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-base text-slate-700 outline-none bg-transparent min-h-[36px] flex-1 min-w-0"
                />
                <span className="text-slate-300 text-sm shrink-0">–</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="text-base text-slate-700 outline-none bg-transparent min-h-[36px] flex-1 min-w-0"
                />
              </div>
            )}
          </div>
        </div>

        {/* Tabs — shrink-0 on each button is the key fix: without it, flex
            compresses the 5 tabs to fit the screen and their labels overlap
            instead of the row scrolling horizontally. */}
        <div className="flex flex-nowrap gap-1 mb-4 bg-white rounded-xl border border-slate-200 shadow-sm p-1 overflow-x-auto">
          {TABS.map(({ key, label, icon: Icon }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition min-h-[40px] ${
                  active
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                <Icon size={15} className={active ? 'text-white' : 'text-slate-400'} />
                {label}
              </button>
            );
          })}
        </div>

        {/* Report Content */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {tab === 'Sales' && <SalesReport dateRange={dateRange} startDate={startDate} endDate={endDate} />}
          {tab === 'Products' && <ProductReport dateRange={dateRange} startDate={startDate} endDate={endDate} />}
          {tab === 'Waiters' && <WaiterReport dateRange={dateRange} startDate={startDate} endDate={endDate} />}
          {tab === 'Profit' && <ProfitReport dateRange={dateRange} startDate={startDate} endDate={endDate} />}
          {tab === 'Stock' && <StockReport />}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TABLE COMPONENT
// ============================================================================
function Table({ cols, rows, renderRow, summary, loading, emptyMessage = 'No data available' }) {
  if (loading) {
    return (
      <div className="p-10 text-center text-slate-400 text-sm">
        <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-slate-200 border-t-slate-500 mr-2 align-middle"></div>
        Loading…
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-12 text-center">
        <Inbox size={22} className="text-slate-300" />
        <p className="text-sm text-slate-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr className="text-left text-slate-500">
            {cols.map((c, i) => (
              <th key={i} className="p-3 text-xs font-medium uppercase tracking-wide whitespace-nowrap">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => renderRow(row, i))}
        </tbody>
        {summary && (
          <tfoot className="bg-slate-50 border-t border-slate-200">
            <tr>
              {summary.map((item, i) => (
                <td key={i} className="p-3 text-xs text-slate-500 whitespace-nowrap" colSpan={item.colSpan || 1}>
                  {item.label}: <span className="font-semibold text-slate-800 tabular-nums">{item.value}</span>
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

// ============================================================================
// SALES REPORT
// ============================================================================
function SalesReport({ dateRange, startDate, endDate }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [dateRange, startDate, endDate]);

  async function loadData() {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateRange === 'today') {
      params.append('date', new Date().toISOString().split('T')[0]);
    } else if (dateRange === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      params.append('date', yesterday.toISOString().split('T')[0]);
    } else if (dateRange === 'week' || dateRange === 'month' || dateRange === 'custom') {
      params.append('startDate', startDate);
      params.append('endDate', endDate);
    }
    try {
      const data = await apiFetch(`/api/reports/sales?${params.toString()}`);
      setRows(data || []);
    } catch (e) {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  const totalRevenue = rows.reduce((s, r) => s + (r.revenue || 0), 0);
  const totalTransactions = rows.reduce((s, r) => s + (r.transactions || 0), 0);
  const totalDiscounts = rows.reduce((s, r) => s + (r.discounts || 0), 0);

  const summary = [
    { label: 'Revenue', value: money(totalRevenue), colSpan: 2 },
    { label: 'Transactions', value: totalTransactions, colSpan: 1 },
    { label: 'Discounts', value: money(totalDiscounts), colSpan: 1 },
  ];

  const cols = ['Date', 'Transactions', 'Revenue', 'Discounts'];

  return (
    <Table
      cols={cols}
      rows={rows}
      loading={loading}
      summary={summary}
      emptyMessage="No sales data for this period"
      renderRow={(r, i) => (
        <tr key={i} className="hover:bg-slate-50 transition">
          <td className="p-3 font-medium text-slate-700 whitespace-nowrap">{r.day}</td>
          <td className="p-3 text-slate-600 tabular-nums whitespace-nowrap">{r.transactions}</td>
          <td className="p-3 font-semibold text-slate-900 tabular-nums whitespace-nowrap">{money(r.revenue)}</td>
          <td className="p-3 text-slate-500 tabular-nums whitespace-nowrap">{money(r.discounts)}</td>
        </tr>
      )}
    />
  );
}

// ============================================================================
// PRODUCT REPORT
// ============================================================================
function ProductReport({ dateRange, startDate, endDate }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [dateRange, startDate, endDate]);

  async function loadData() {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateRange === 'today') {
      params.append('date', new Date().toISOString().split('T')[0]);
    } else if (dateRange === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      params.append('date', yesterday.toISOString().split('T')[0]);
    } else if (dateRange === 'week' || dateRange === 'month' || dateRange === 'custom') {
      params.append('startDate', startDate);
      params.append('endDate', endDate);
    }
    try {
      const data = await apiFetch(`/api/reports/products?${params.toString()}`);
      setRows(data || []);
    } catch (e) {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  const totalRevenue = rows.reduce((s, r) => s + (r.revenue || 0), 0);
  const totalCogs = rows.reduce((s, r) => s + (r.cogs || 0), 0);
  const totalProfit = totalRevenue - totalCogs;

  const summary = [
    { label: 'Revenue', value: money(totalRevenue), colSpan: 2 },
    { label: 'COGS', value: money(totalCogs), colSpan: 1 },
    { label: 'Profit', value: money(totalProfit), colSpan: 2 },
  ];

  const cols = ['Product', 'Units', 'Revenue', 'COGS', 'Profit', 'Margin'];

  return (
    <Table
      cols={cols}
      rows={rows}
      loading={loading}
      summary={summary}
      emptyMessage="No product sales data"
      renderRow={(r, i) => (
        <tr key={i} className="hover:bg-slate-50 transition">
          <td className="p-3 font-medium text-slate-700 truncate max-w-[140px]">{r.name}</td>
          <td className="p-3 text-slate-600 tabular-nums whitespace-nowrap">{r.unitsSold || 0}</td>
          <td className="p-3 text-slate-800 tabular-nums whitespace-nowrap">{money(r.revenue)}</td>
          <td className="p-3 text-slate-500 tabular-nums whitespace-nowrap">{money(r.cogs)}</td>
          <td className={`p-3 font-medium tabular-nums whitespace-nowrap ${r.grossProfit > 0 ? 'text-slate-900' : 'text-slate-500'}`}>
            {money(r.grossProfit)}
          </td>
          <td className="p-3 whitespace-nowrap">
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
              r.marginPct > 30 ? 'bg-emerald-50 text-emerald-700' :
              r.marginPct > 15 ? 'bg-amber-50 text-amber-700' :
              'bg-slate-100 text-slate-600'
            }`}>
              {r.marginPct ? r.marginPct.toFixed(1) : '0'}%
            </span>
          </td>
        </tr>
      )}
    />
  );
}

// ============================================================================
// WAITER REPORT
// ============================================================================
function WaiterReport({ dateRange, startDate, endDate }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [dateRange, startDate, endDate]);

  async function loadData() {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateRange === 'today') {
      params.append('date', new Date().toISOString().split('T')[0]);
    } else if (dateRange === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      params.append('date', yesterday.toISOString().split('T')[0]);
    } else if (dateRange === 'week' || dateRange === 'month' || dateRange === 'custom') {
      params.append('startDate', startDate);
      params.append('endDate', endDate);
    }
    try {
      const data = await apiFetch(`/api/reports/waiters?${params.toString()}`);
      setRows(data || []);
    } catch (e) {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  const totalRevenue = rows.reduce((s, r) => s + (r.revenue || 0), 0);
  const totalTransactions = rows.reduce((s, r) => s + (r.transactions || 0), 0);
  const totalShortages = rows.reduce((s, r) => s + (r.shortages || 0), 0);

  const summary = [
    { label: 'Revenue', value: money(totalRevenue), colSpan: 2 },
    { label: 'Transactions', value: totalTransactions, colSpan: 1 },
    { label: 'Shortages', value: money(totalShortages), colSpan: 1 },
  ];

  const cols = ['Waiter', 'Txn', 'Revenue', 'Avg', 'Cash', 'Mobile', 'Card', 'Credit', 'Short', 'Surplus'];

  return (
    <Table
      cols={cols}
      rows={rows}
      loading={loading}
      summary={summary}
      emptyMessage="No waiter data for this period"
      renderRow={(r, i) => (
        <tr key={i} className="hover:bg-slate-50 transition">
          <td className="p-3 font-medium text-slate-700 whitespace-nowrap">{r.name}</td>
          <td className="p-3 text-slate-600 tabular-nums whitespace-nowrap">{r.transactions || 0}</td>
          <td className="p-3 font-semibold text-slate-900 tabular-nums whitespace-nowrap">{money(r.revenue)}</td>
          <td className="p-3 text-slate-500 tabular-nums whitespace-nowrap">{money(r.avgTransaction)}</td>
          <td className="p-3 text-slate-600 tabular-nums whitespace-nowrap">{money(r.cashRevenue)}</td>
          <td className="p-3 text-slate-600 tabular-nums whitespace-nowrap">{money(r.mobileRevenue)}</td>
          <td className="p-3 text-slate-600 tabular-nums whitespace-nowrap">{money(r.cardRevenue)}</td>
          <td className="p-3 text-slate-500 tabular-nums whitespace-nowrap">{money(r.creditRevenue)}</td>
          <td className={`p-3 font-medium tabular-nums whitespace-nowrap ${r.shortages > 0 ? 'text-rose-600' : 'text-slate-300'}`}>
            {money(r.shortages)}
          </td>
          <td className={`p-3 font-medium tabular-nums whitespace-nowrap ${r.surpluses > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>
            {money(r.surpluses)}
          </td>
        </tr>
      )}
    />
  );
}

// ============================================================================
// PROFIT REPORT
// ============================================================================
function ProfitReport({ dateRange, startDate, endDate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [dateRange, startDate, endDate]);

  async function loadData() {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateRange === 'today') {
      params.append('date', new Date().toISOString().split('T')[0]);
    } else if (dateRange === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      params.append('date', yesterday.toISOString().split('T')[0]);
    } else if (dateRange === 'week' || dateRange === 'month' || dateRange === 'custom') {
      params.append('startDate', startDate);
      params.append('endDate', endDate);
    }
    try {
      const result = await apiFetch(`/api/reports/profit?${params.toString()}`);
      setData(result);
    } catch (e) {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-10 text-center text-slate-400 text-sm">
        <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-slate-200 border-t-slate-500 mr-2 align-middle"></div>
        Loading…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-12 text-center">
        <Inbox size={22} className="text-slate-300" />
        <p className="text-sm text-slate-400">No profit data available</p>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="rounded-lg px-4 py-3 border border-slate-200 bg-slate-50">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Revenue</p>
          <p className="text-lg font-semibold text-slate-900 tabular-nums mt-0.5">{money(data.revenue)}</p>
        </div>
        <div className="rounded-lg px-4 py-3 border border-slate-200 bg-slate-50">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Gross profit</p>
          <p className={`text-lg font-semibold tabular-nums mt-0.5 ${data.grossProfit > 0 ? 'text-slate-900' : 'text-rose-600'}`}>
            {money(data.grossProfit)}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">{data.grossMarginPct?.toFixed(1) || 0}% margin</p>
        </div>
        <div className="rounded-lg px-4 py-3 border border-emerald-200 bg-emerald-50">
          <p className="text-xs font-medium text-emerald-700 uppercase tracking-wide">Net profit</p>
          <p className={`text-lg font-semibold tabular-nums mt-0.5 ${data.netProfit > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
            {money(data.netProfit)}
          </p>
          <p className="text-xs text-emerald-600/70 mt-0.5">{data.netMarginPct?.toFixed(1) || 0}% margin</p>
        </div>
      </div>

      {/* Breakdown */}
      <div className="border border-slate-200 rounded-lg overflow-hidden text-sm">
        <div className="flex justify-between px-3 sm:px-4 py-2.5 border-b border-slate-200 bg-slate-50">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Line item</span>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Amount</span>
        </div>
        <div className="flex justify-between px-3 sm:px-4 py-2.5 border-b border-slate-100">
          <span className="text-slate-600">Revenue</span>
          <span className="font-medium text-slate-900 tabular-nums">{money(data.revenue)}</span>
        </div>
        <div className="flex justify-between px-3 sm:px-4 py-2.5 border-b border-slate-100">
          <span className="text-slate-600">Cost of goods sold</span>
          <span className="text-slate-500 tabular-nums">−{money(data.cogs)}</span>
        </div>
        <div className="flex justify-between px-3 sm:px-4 py-2.5 border-b border-slate-100 bg-slate-50">
          <span className="font-medium text-slate-700">Gross profit</span>
          <span className="font-medium text-slate-900 tabular-nums">{money(data.grossProfit)}</span>
        </div>
        <div className="flex justify-between px-3 sm:px-4 py-2.5 border-b border-slate-100">
          <span className="text-slate-600">Expenses</span>
          <span className="text-slate-500 tabular-nums">−{money(data.expenses)}</span>
        </div>
        <div className="flex justify-between px-3 sm:px-4 py-2.5 bg-slate-50">
          <span className="font-semibold text-slate-900">Net profit</span>
          <span className={`font-semibold tabular-nums ${data.netProfit > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
            {money(data.netProfit)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// STOCK REPORT
// ============================================================================
function StockReport() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const data = await api.stockReport();
      setRows(data || []);
    } catch (e) {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  const filteredRows = useMemo(() => {
    if (filter === 'low') {
      return rows.filter(r => r.lowStock && r.stockUnits > 0);
    }
    if (filter === 'out') {
      return rows.filter(r => r.stockUnits === 0);
    }
    return rows;
  }, [rows, filter]);

  const totalStockValue = rows.reduce((s, r) => s + (r.stockValue || 0), 0);
  const lowStockCount = rows.filter(r => r.lowStock && r.stockUnits > 0).length;
  const outOfStockCount = rows.filter(r => r.stockUnits === 0).length;

  const summary = [
    { label: 'Total value', value: money(totalStockValue), colSpan: 2 },
    { label: 'Low stock', value: lowStockCount, colSpan: 1 },
    { label: 'Out of stock', value: outOfStockCount, colSpan: 1 },
  ];

  const cols = ['Product', 'Stock', 'Avg cost', 'Value', 'Status'];

  const FILTERS = [
    { key: 'all', label: 'All', count: rows.length },
    { key: 'low', label: 'Low', count: lowStockCount },
    { key: 'out', label: 'Out', count: outOfStockCount },
  ];

  if (loading) {
    return (
      <div className="p-10 text-center text-slate-400 text-sm">
        <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-slate-200 border-t-slate-500 mr-2 align-middle"></div>
        Loading…
      </div>
    );
  }

  return (
    <div>
      {/* Filter */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 border-b border-slate-100">
        <span className="text-xs text-slate-400 mr-0.5">Filter</span>
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`text-xs font-medium px-3 py-1.5 rounded-md transition min-h-[32px] ${
              filter === f.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {f.label} ({f.count})
          </button>
        ))}
        {filter !== 'all' && (
          <button
            onClick={() => setFilter('all')}
            className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2 min-h-[32px] px-1"
          >
            clear
          </button>
        )}
      </div>

      <Table
        cols={cols}
        rows={filteredRows}
        loading={false}
        summary={summary}
        emptyMessage={filter !== 'all' ? 'No products match this filter' : 'No stock data'}
        renderRow={(r, i) => {
          let statusText = 'OK';
          let statusColor = 'bg-emerald-50 text-emerald-700';
          let StatusIcon = CheckCircle2;
          if (r.stockUnits === 0) {
            statusText = 'Out';
            statusColor = 'bg-rose-50 text-rose-700';
            StatusIcon = XCircle;
          } else if (r.lowStock) {
            statusText = 'Low';
            statusColor = 'bg-amber-50 text-amber-700';
            StatusIcon = AlertTriangle;
          }
          return (
            <tr key={i} className="hover:bg-slate-50 transition">
              <td className="p-3 font-medium text-slate-700 truncate max-w-[140px]">{r.name}</td>
              <td className={`p-3 font-medium tabular-nums whitespace-nowrap ${r.stockUnits === 0 ? 'text-slate-400' : 'text-slate-700'}`}>
                {r.stockUnits}
              </td>
              <td className="p-3 text-slate-500 tabular-nums whitespace-nowrap">{r.avgCostPerMl ? r.avgCostPerMl.toFixed(2) : '0.00'}</td>
              <td className="p-3 font-medium text-slate-700 tabular-nums whitespace-nowrap">{money(r.stockValue)}</td>
              <td className="p-3 whitespace-nowrap">
                <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
                  <StatusIcon size={11} />
                  {statusText}
                </span>
              </td>
            </tr>
          );
        }}
      />
    </div>
  );
}
