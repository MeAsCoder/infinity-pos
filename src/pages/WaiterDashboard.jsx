// pages/WaiterDashboard.jsx - Mobile Responsive
// Fixes vs. previous version:
// 1. StatBlock had a stray `,mnb` after its closing </div> — invalid JSX
//    that would fail to compile. Removed.
// 2. Tab labels used `hidden xs:inline`. `xs:` isn't a real Tailwind
//    breakpoint, so `hidden` applied unconditionally on every screen size —
//    labels never rendered, desktop included. Labels are now always shown;
//    the tab bar already scrolls horizontally (overflow-x-auto) if it's
//    too wide for a narrow phone.
// 3. Legibility/touch-target pass: text below ~12px and buttons/rows under
//    ~36px tall were bumped up — same class of fix as POS.jsx and
//    ShiftScreen.jsx.
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db/offlineDb';
import { api, apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import {
  IconCash, IconCredit, IconUsers, IconChart, IconReceipt,
  IconAlert, IconCheck, IconPhone, IconClose, IconUser
} from '../components/Icons';

function money(n) { return `KES ${Number(n || 0).toLocaleString()}`; }
function toDateInput(d) { return d.toISOString().slice(0, 10); }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d; }
function rangeBounds(fromStr, toStr) { return { from: `${fromStr} 00:00:00`, to: `${toStr} 23:59:59` }; }

const PRESETS = [
  { key: 'today', label: 'Today', from: () => toDateInput(new Date()), to: () => toDateInput(new Date()) },
  { key: 'yesterday', label: 'Yesterday', from: () => toDateInput(daysAgo(1)), to: () => toDateInput(daysAgo(1)) },
  { key: '7d', label: 'Last 7 Days', from: () => toDateInput(daysAgo(6)), to: () => toDateInput(new Date()) },
  { key: '30d', label: 'Last 30 Days', from: () => toDateInput(daysAgo(29)), to: () => toDateInput(new Date()) },
];

export default function WaiterDashboard() {
  const { user } = useAuth();
  const { online } = useSync();
  const navigate = useNavigate();

  const [preset, setPreset] = useState('today');
  const [fromDate, setFromDate] = useState(PRESETS[0].from());
  const [toDate, setToDate] = useState(PRESETS[0].to());

  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [sales, setSales] = useState([]);
  const [shiftRows, setShiftRows] = useState([]);
  const [debts, setDebts] = useState([]);
  const [debtSummary, setDebtSummary] = useState(null);
  const [currentShiftSummary, setCurrentShiftSummary] = useState(null);
  const [patterns, setPatterns] = useState([]);
  const [showPatternModal, setShowPatternModal] = useState(false);
  const [selectedPattern, setSelectedPattern] = useState(null);

  useEffect(() => { loadLive(); }, []);
  useEffect(() => { loadRangeData(); }, [fromDate, toDate]);

  async function loadLive() {
    if (!online) return;
    try {
      const cached = await db.currentShift.get(1);
      const shift = cached?.shift;
      if (shift?.id && !String(shift.id).startsWith('local-')) {
        const summary = await api.shiftReport(shift.id).catch(() => null);
        setCurrentShiftSummary(summary);
      }
      const [list, summary] = await Promise.all([
        apiFetch(`/api/sales/waiter/${user.id}/debts`),
        apiFetch(`/api/sales/waiter/${user.id}/debts/summary`),
      ]);
      setDebts(list);
      setDebtSummary(summary);

      try {
        const patternData = await apiFetch(`/api/waiter/patterns/${user.id}`);
        setPatterns(patternData || []);
      } catch (e) {
        if (e.status === 404) {
          setPatterns([]);
        } else {
          console.error('Error fetching patterns:', e);
          setPatterns([]);
        }
      }
    } catch (e) {
      console.error('Error loading live data:', e);
    }
  }

  async function loadRangeData() {
    setLoading(true); setError('');
    if (!online) { setLoading(false); return; }
    const { from, to } = rangeBounds(fromDate, toDate);
    try {
      const [salesData, reconciliations] = await Promise.all([
        apiFetch(`/api/sales/waiter/history?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
        apiFetch(`/api/shifts/mine/reconciliations?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
      ]);
      setSales(salesData);
      setShiftRows(reconciliations);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function applyPreset(p) { setPreset(p.key); setFromDate(p.from()); setToDate(p.to()); }
  function onCustomDateChange(which, value) { setPreset('custom'); if (which === 'from') setFromDate(value); else setToDate(value); }

  const rangeLabel = useMemo(() => fromDate === toDate ? fromDate : `${fromDate} → ${toDate}`, [fromDate, toDate]);
  const bounds = useMemo(() => rangeBounds(fromDate, toDate), [fromDate, toDate]);

  const stats = useMemo(() => calculateStats(sales), [sales]);

  const shortageRows = useMemo(() => shiftRows.filter(r => r.variance < 0), [shiftRows]);
  const surplusRows = useMemo(() => shiftRows.filter(r => r.variance > 0), [shiftRows]);
  const totalShortage = useMemo(() => shortageRows.reduce((s, r) => s - r.variance, 0), [shortageRows]);
  const totalSurplus = useMemo(() => surplusRows.reduce((s, r) => s + r.variance, 0), [surplusRows]);

  const debtsInRange = useMemo(() => debts.filter(d => d.created_at >= bounds.from && d.created_at <= bounds.to), [debts, bounds]);
  const totalDebtInRange = useMemo(() => debtsInRange.reduce((s, d) => s + d.amount, 0), [debtsInRange]);

  const creditCustomers = useMemo(() => {
    const map = new Map();
    debts.forEach(d => {
      if (d.customerCurrentBalance > 0) map.set(d.customer_id, { id: d.customer_id, name: d.customer_name, phone: d.customer_phone, balance: d.customerCurrentBalance });
    });
    return Array.from(map.values()).sort((a, b) => b.balance - a.balance);
  }, [debts]);

  const hasPatterns = patterns.length > 0;

  if (!online) {
    return (
      <div className="p-6 sm:p-10 text-center max-w-sm mx-auto mt-6 sm:mt-10">
        <IconAlert className="w-10 h-10 mx-auto mb-3 text-amber-500" />
        <p className="font-medium text-ink-950">You're offline</p>
        <p className="text-sm text-neutral-500 mt-1">This dashboard needs a live connection to show accurate figures.</p>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4 mb-3 sm:mb-5">
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-ink-950">My Dashboard</h1>
            <p className="text-sm text-neutral-500">Welcome back, {user.name}.</p>
          </div>
        </div>

        {/* Pattern Alert */}
        {hasPatterns && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 sm:p-4 mb-3 sm:mb-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
              <div>
                <h3 className="font-semibold text-amber-800 flex items-center gap-2 text-sm sm:text-base">
                  <IconAlert className="w-4 h-4 sm:w-5 sm:h-5" /> Pattern Alerts
                </h3>
                <p className="text-xs text-amber-600 mt-0.5 sm:mt-1">Our system has detected patterns in your shift reconciliations</p>
              </div>
              <button
                onClick={() => setShowPatternModal(true)}
                className="text-sm bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg transition w-full sm:w-auto min-h-[40px]"
              >
                View {patterns.length} Alert(s)
              </button>
            </div>
          </div>
        )}

        {/* Date Range Picker — presets and the From/To fields are now two
            separate rows so they never interleave into an unpredictable
            wrap order on narrow screens. Presets scroll horizontally
            instead of wrapping mid-word. */}
        <div className="bg-white rounded-2xl shadow-soft p-2 sm:p-3 mb-3 sm:mb-5 space-y-2">
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto">
            {PRESETS.map(p => (
              <button
                key={p.key}
                onClick={() => applyPreset(p)}
                className={`shrink-0 px-3 py-2 rounded-lg text-sm font-medium transition min-h-[36px] whitespace-nowrap ${
                  preset === p.key ? 'bg-brand text-white' : 'text-neutral-500 hover:bg-neutral-100'
                }`}
              >
                {p.label}
              </button>
            ))}
            {loading && <span className="text-xs text-neutral-400 ml-auto shrink-0 hidden sm:inline">Loading…</span>}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-sm border-t border-neutral-100 pt-2">
            <label className="text-neutral-400 shrink-0">From</label>
            <input
              type="date"
              value={fromDate}
              max={toDate}
              onChange={e => onCustomDateChange('from', e.target.value)}
              className="border border-neutral-200 rounded-lg px-2 py-2 text-sm min-h-[36px] flex-1 min-w-0"
            />
            <label className="text-neutral-400 shrink-0">To</label>
            <input
              type="date"
              value={toDate}
              min={fromDate}
              max={toDateInput(new Date())}
              onChange={e => onCustomDateChange('to', e.target.value)}
              className="border border-neutral-200 rounded-lg px-2 py-2 text-sm min-h-[36px] flex-1 min-w-0"
            />
            {loading && <span className="text-xs text-neutral-400 sm:hidden shrink-0">Loading…</span>}
          </div>
        </div>

        {error && <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4 text-rose-700 text-sm">{error}</div>}

        {/* Tabs — shrink-0 on each button is the key fix: without it, flex's
            default shrink behavior squeezed all 5 tabs into the available
            width and their labels overlapped into unreadable mush instead
            of the row overflowing and scrolling horizontally. */}
        <div className="flex flex-nowrap gap-1 sm:gap-2 mb-3 sm:mb-6 bg-white rounded-xl p-1 border border-neutral-200 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: IconChart },
            { id: 'sales', label: 'Sales', icon: IconReceipt },
            { id: 'credit', label: 'Credit', icon: IconCredit },
            { id: 'shortages', label: 'Shortages', icon: IconAlert },
            { id: 'debts', label: 'Debts', icon: IconCredit },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition min-h-[40px] ${
                activeTab === tab.id ? 'bg-brand text-white' : 'text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              <tab.icon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && <OverviewTab stats={stats} currentShiftSummary={currentShiftSummary} rangeLabel={rangeLabel} patterns={patterns} />}
        {activeTab === 'sales' && <SalesTab sales={sales} rangeLabel={rangeLabel} />}
        {activeTab === 'credit' && <CreditTab customers={creditCustomers} />}
        {activeTab === 'shortages' && <ShortagesTab shiftRows={shiftRows} totalShortage={totalShortage} totalSurplus={totalSurplus} rangeLabel={rangeLabel} />}
        {activeTab === 'debts' && (
          <DebtHistoryTab
            debtsInRange={debtsInRange} totalDebtInRange={totalDebtInRange}
            allTimeTotal={debtSummary?.totalRecorded || 0} allTimeCount={debtSummary?.totalDebts || 0}
            rangeLabel={rangeLabel}
          />
        )}
      </div>

      {/* Pattern Modal */}
      {showPatternModal && (
        <PatternModal
          patterns={patterns}
          onClose={() => setShowPatternModal(false)}
          selectedPattern={selectedPattern}
          setSelectedPattern={setSelectedPattern}
        />
      )}
    </div>
  );
}

function calculateStats(sales) {
  const completed = sales.filter(s => s.status === 'COMPLETED');
  const totalSales = completed.reduce((sum, s) => sum + (s.total || 0), 0);
  const totalItems = completed.reduce((sum, s) => sum + (s.items?.length || 0), 0);
  const linkedCustomers = new Set(completed.filter(s => s.customer_id).map(s => s.customer_id)).size;
  const totalTransactions = completed.length;

  let cashTotal = 0, creditTotal = 0, mobileTotal = 0, cardTotal = 0, otherTotal = 0;
  completed.forEach(sale => {
    (sale.payments || []).forEach(p => {
      if (p.method === 'CASH') cashTotal += p.amount;
      else if (p.method === 'CREDIT') creditTotal += p.amount;
      else if (p.method === 'MOBILE') mobileTotal += p.amount;
      else if (p.method === 'CARD') cardTotal += p.amount;
      else otherTotal += p.amount;
    });
  });

  const voided = sales.filter(s => s.status === 'VOIDED' || s.status === 'REFUNDED' || s.status === 'PARTIALLY_REFUNDED');

  return {
    totalSales, totalItems, linkedCustomers, totalTransactions,
    cashTotal, creditTotal, mobileTotal, cardTotal, otherTotal,
    voidedCount: voided.length,
    averageTicket: totalTransactions > 0 ? totalSales / totalTransactions : 0,
  };
}

// ============================================================================
// OVERVIEW TAB
// ============================================================================
function OverviewTab({ stats, currentShiftSummary, rangeLabel, patterns }) {
  if (!stats || stats.totalTransactions === 0) {
    return <EmptyState icon={IconChart} title="No completed sales in this range" subtitle="Try a different date range, or start taking orders." />;
  }

  const statCards = [
    { label: 'Revenue', value: money(stats.totalSales), icon: IconCash, color: 'text-emerald-600' },
    { label: 'Transactions', value: stats.totalTransactions, icon: IconReceipt, color: 'text-blue-600' },
    { label: 'Customers Linked', value: stats.linkedCustomers, icon: IconUsers, color: 'text-purple-600' },
    { label: 'Avg Ticket', value: money(stats.averageTicket), icon: IconChart, color: 'text-amber-600' },
  ];
  const paymentStats = [
    { label: 'Cash', value: money(stats.cashTotal), color: 'bg-green-50 text-green-700' },
    { label: 'Mobile', value: money(stats.mobileTotal), color: 'bg-blue-50 text-blue-700' },
    { label: 'Card', value: money(stats.cardTotal), color: 'bg-purple-50 text-purple-700' },
    { label: 'Credit', value: money(stats.creditTotal), color: 'bg-amber-50 text-amber-700' },
  ];

  return (
    <div className="space-y-3 sm:space-y-6">
      <p className="text-xs text-neutral-400 -mt-1 sm:-mt-2">Showing {rangeLabel}</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        {statCards.map((card, i) => (
          <div key={i} className="bg-white rounded-xl shadow-card p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 sm:p-2.5 rounded-lg bg-neutral-50 shrink-0">
                <card.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${card.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-neutral-400 font-medium truncate">{card.label}</p>
                <p className="text-sm sm:text-lg font-bold text-ink-950">{card.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {patterns && patterns.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 sm:p-4">
          <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
            <IconAlert className="w-4 h-4" /> Pattern Detected
          </div>
          <p className="text-xs text-amber-600 mt-0.5 sm:mt-1">
            You have {patterns.length} pattern alert(s). Please review them in the Patterns section.
          </p>
        </div>
      )}

      {currentShiftSummary?.sales && (
        <div className="bg-white rounded-xl shadow-card p-3 sm:p-4">
          <h3 className="font-semibold text-ink-950 mb-2 sm:mb-3 text-base">Current Shift (live)</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
            <div><p className="text-xs text-neutral-400">Revenue</p><p className="font-semibold text-sm">{money(currentShiftSummary.sales.revenue)}</p></div>
            <div><p className="text-xs text-neutral-400">Transactions</p><p className="font-semibold text-sm">{currentShiftSummary.sales.count}</p></div>
            <div><p className="text-xs text-neutral-400">Discounts</p><p className="font-semibold text-sm">{money(currentShiftSummary.sales.discounts)}</p></div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-card p-3 sm:p-4">
        <h3 className="font-semibold text-ink-950 mb-2 sm:mb-3 text-base">Payment Methods</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {paymentStats.map((stat, i) => (
            <div key={i} className={`p-2.5 sm:p-3 rounded-lg ${stat.color}`}>
              <p className="text-xs opacity-75">{stat.label}</p>
              <p className="font-bold text-sm">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      {stats.voidedCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
          {stats.voidedCount} voided/refunded sale(s) in this range — excluded from the figures above.
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SALES TAB
// ============================================================================
function SalesTab({ sales, rangeLabel }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const filteredSales = sales.filter(sale => {
    const search = searchTerm.toLowerCase();
    const matchSearch = (sale.receipt_number || '').toLowerCase().includes(search) || (sale.tab_label || '').toLowerCase().includes(search);
    const matchStatus = filterStatus === 'ALL' || sale.status === filterStatus;
    return matchSearch && matchStatus;
  });

  if (!sales || sales.length === 0) {
    return <EmptyState icon={IconReceipt} title="No sales in this range" subtitle="Try a different date range." />;
  }

  return (
    <div className="bg-white rounded-xl shadow-card overflow-hidden">
      <div className="p-3 sm:p-4 border-b border-neutral-100">
        <p className="text-xs text-neutral-400 mb-2 sm:mb-3">{rangeLabel} · {sales.length} sale(s)</p>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <input
            type="text"
            placeholder="Search by receipt or table…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="flex-1 px-3 py-2.5 border border-neutral-200 rounded-lg text-base focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
          />
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2.5 border border-neutral-200 rounded-lg text-base focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
          >
            <option value="ALL">All Status</option>
            <option value="COMPLETED">Completed</option>
            <option value="OPEN">Open</option>
            <option value="REFUNDED">Refunded</option>
            <option value="PARTIALLY_REFUNDED">Partially Refunded</option>
            <option value="VOIDED">Voided</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 border-b border-neutral-100">
            <tr>
              <th className="text-left px-2 sm:px-4 py-2.5 sm:py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Receipt</th>
              <th className="text-left px-2 sm:px-4 py-2.5 sm:py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Table</th>
              <th className="text-left px-2 sm:px-4 py-2.5 sm:py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Items</th>
              <th className="text-right px-2 sm:px-4 py-2.5 sm:py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Total</th>
              <th className="text-right px-2 sm:px-4 py-2.5 sm:py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Status</th>
              <th className="text-right px-2 sm:px-4 py-2.5 sm:py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filteredSales.slice(0, 100).map(sale => (
              <tr key={sale.id} className="hover:bg-neutral-50 transition">
                <td className="px-2 sm:px-4 py-2.5 sm:py-3 font-medium text-ink-950 text-sm whitespace-nowrap">{sale.receipt_number}</td>
                <td className="px-2 sm:px-4 py-2.5 sm:py-3 text-neutral-600 text-sm whitespace-nowrap">{sale.tab_label || '-'}</td>
                <td className="px-2 sm:px-4 py-2.5 sm:py-3 text-neutral-600 text-sm">{sale.items?.length || 0}</td>
                <td className="px-2 sm:px-4 py-2.5 sm:py-3 text-right font-semibold text-sm whitespace-nowrap">{money(sale.total)}</td>
                <td className="px-2 sm:px-4 py-2.5 sm:py-3 text-right"><StatusBadge status={sale.status} /></td>
                <td className="px-2 sm:px-4 py-2.5 sm:py-3 text-right text-neutral-500 text-xs whitespace-nowrap">{sale.server_created_at ? new Date(sale.server_created_at).toLocaleString() : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filteredSales.length === 0 && <div className="p-4 sm:p-6 text-center text-neutral-400 text-sm">No sales match your search.</div>}
    </div>
  );
}

function StatusBadge({ status }) {
  const style = status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700'
    : status === 'OPEN' ? 'bg-amber-50 text-amber-700'
    : status === 'VOIDED' ? 'bg-rose-50 text-rose-700'
    : 'bg-blue-50 text-blue-700';
  return <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${style}`}>{status}</span>;
}

// ============================================================================
// CREDIT TAB
// ============================================================================
function CreditTab({ customers }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const filtered = customers.filter(c => c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || (c.phone && c.phone.includes(searchTerm)));

  if (!customers || customers.length === 0) {
    return <EmptyState icon={IconCredit} title="No customers currently owe you money" subtitle="Customers you've extended credit to will appear here while their balance is outstanding." />;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
      <div className="lg:col-span-2 bg-white rounded-xl shadow-card overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-neutral-100">
          <input
            type="text"
            placeholder="Search customers by name or phone…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2.5 border border-neutral-200 rounded-lg text-base focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
          />
        </div>
        <div className="divide-y divide-neutral-100 max-h-96 overflow-y-auto">
          {filtered.map(customer => (
            <button
              key={customer.id}
              onClick={() => setSelectedCustomer(customer)}
              className={`w-full text-left px-3 sm:px-4 py-3 hover:bg-neutral-50 transition flex flex-wrap justify-between items-center gap-1 min-h-[56px] ${
                selectedCustomer?.id === customer.id ? 'bg-brand-50 border-l-4 border-brand' : ''
              }`}
            >
              <div>
                <div className="font-medium text-ink-950 text-sm">{customer.name}</div>
                {customer.phone && <div className="text-xs text-neutral-400 flex items-center gap-1"><IconPhone className="w-3 h-3" /> {customer.phone}</div>}
              </div>
              <div className="text-right">
                <div className="font-bold text-amber-600 text-sm">{money(customer.balance)}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-card p-3 sm:p-4">
        {selectedCustomer ? (
          <div>
            <div className="flex justify-between items-start mb-3 sm:mb-4">
              <div>
                <h3 className="font-display text-base sm:text-lg font-semibold text-ink-950">{selectedCustomer.name}</h3>
                {selectedCustomer.phone && <p className="text-sm text-neutral-500 flex items-center gap-1"><IconPhone className="w-3 h-3" /> {selectedCustomer.phone}</p>}
              </div>
              <button onClick={() => setSelectedCustomer(null)} className="text-neutral-400 hover:text-neutral-600 w-9 h-9 flex items-center justify-center shrink-0"><IconClose className="w-4 h-4" /></button>
            </div>
            <div className="bg-amber-50 rounded-lg p-3">
              <p className="text-xs text-amber-600 font-medium">Current Balance Owed</p>
              <p className="text-xl sm:text-2xl font-bold text-amber-600">{money(selectedCustomer.balance)}</p>
            </div>
            <p className="text-xs text-neutral-400 mt-2 sm:mt-3">Repayments and write-offs are handled by an admin under Credit Book.</p>
          </div>
        ) : (
          <div className="text-center text-neutral-400 py-4 sm:py-8">
            <IconUsers className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 opacity-30" />
            <p className="text-sm">Select a customer to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SHORTAGES TAB
// ============================================================================
function ShortagesTab({ shiftRows, totalShortage, totalSurplus, rangeLabel }) {
  if (!shiftRows || shiftRows.length === 0) {
    return <EmptyState icon={IconCheck} title="No closed shifts in this range" subtitle="Shortages are calculated automatically from the cash you count when closing a shift." success />;
  }

  return (
    <div className="bg-white rounded-xl shadow-card overflow-hidden">
      <div className={`p-3 sm:p-4 border-b border-neutral-100 ${totalShortage > 0 ? 'bg-rose-50' : 'bg-emerald-50'}`}>
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1.5 sm:gap-2">
          <div>
            <h3 className={`font-semibold flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base ${
              totalShortage > 0 ? 'text-rose-700' : 'text-emerald-700'
            }`}>
              <IconAlert className="w-4 h-4 sm:w-5 sm:h-5" /> Total Shortage: {money(totalShortage)}
            </h3>
            <p className={`text-xs mt-0.5 ${totalShortage > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {rangeLabel} · {shiftRows.length} shift(s) closed
            </p>
          </div>
          {totalSurplus > 0 && <div className="text-sm text-emerald-700 font-medium">+ {money(totalSurplus)} in surpluses</div>}
        </div>
      </div>
      <div className="divide-y divide-neutral-100 max-h-96 overflow-y-auto">
        {shiftRows.map(r => (
          <div key={r.id} className="px-3 sm:px-4 py-3 flex flex-wrap justify-between items-center gap-1">
            <div>
              <div className="font-medium text-ink-950 text-sm">Shift #{r.id}</div>
              <div className="text-xs text-neutral-400">{r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '-'}</div>
              <div className="text-xs text-neutral-400 mt-0.5">Expected {money(r.expected_cash)} · Counted {money(r.actual_cash)}</div>
            </div>
            <div className={`font-bold text-sm ${
              r.variance < 0 ? 'text-rose-600' : r.variance > 0 ? 'text-emerald-600' : 'text-neutral-400'
            }`}>
              {r.variance < 0 ? '-' : r.variance > 0 ? '+' : ''}{money(Math.abs(r.variance))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// DEBT HISTORY TAB
// ============================================================================
function DebtHistoryTab({ debtsInRange, totalDebtInRange, allTimeTotal, allTimeCount, rangeLabel }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const filtered = debtsInRange.filter(d => {
    const s = searchTerm.toLowerCase();
    const matchSearch = (d.customer_name || '').toLowerCase().includes(s) || (d.customer_phone || '').includes(s) || (d.receipt_number || '').toLowerCase().includes(s);
    const owing = d.customerCurrentBalance > 0;
    const matchStatus = filterStatus === 'ALL' || (filterStatus === 'OWING' && owing) || (filterStatus === 'CLEARED' && !owing);
    return matchSearch && matchStatus;
  });

  if (!debtsInRange || debtsInRange.length === 0) {
    return <EmptyState icon={IconCredit} title="No debt recorded in this range" subtitle="Debt from tabs settled partly on credit, or walk-outs, will show up here." success />;
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
        <StatBlock label={`Recorded — ${rangeLabel}`} value={money(totalDebtInRange)} color="text-amber-600" />
        <StatBlock label="All-time total" value={money(allTimeTotal)} color="text-neutral-700" />
        <StatBlock label="All-time records" value={allTimeCount} color="text-neutral-700" />
      </div>

      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-neutral-100">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <input
              type="text"
              placeholder="Search by customer name, phone, or receipt…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="flex-1 px-3 py-2.5 border border-neutral-200 rounded-lg text-base focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
            />
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-2.5 border border-neutral-200 rounded-lg text-base focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
            >
              <option value="ALL">All</option>
              <option value="OWING">Still Owing</option>
              <option value="CLEARED">Cleared</option>
            </select>
          </div>
        </div>

        <div className="divide-y divide-neutral-100 max-h-[500px] overflow-y-auto">
          {filtered.map(debt => {
            const owing = debt.customerCurrentBalance > 0;
            return (
              <div key={debt.id} className="px-3 sm:px-4 py-3 hover:bg-neutral-50 transition">
                <div className="flex flex-wrap justify-between items-start gap-1">
                  <div className="flex-1 min-w-[140px]">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span className="font-medium text-ink-950 text-sm">{debt.customer_name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${owing ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {owing ? 'Still Owing' : 'Cleared'}
                      </span>
                    </div>
                    {debt.customer_phone && <div className="text-xs text-neutral-400 flex items-center gap-1 mt-0.5"><IconPhone className="w-3 h-3" /> {debt.customer_phone}</div>}
                    {debt.receipt_number && <div className="text-xs text-neutral-400 mt-0.5">Receipt: {debt.receipt_number}{debt.tab_label ? ` · ${debt.tab_label}` : ''}</div>}
                    {debt.notes && <div className="text-xs text-neutral-400 mt-0.5 truncate max-w-[200px] sm:max-w-xs">{debt.notes}</div>}
                    <div className="text-xs text-neutral-400 mt-0.5">{new Date(debt.created_at).toLocaleString()}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-amber-600 text-sm">{money(debt.amount)}</div>
                    {owing && <div className="text-xs text-neutral-400 mt-0.5">balance: {money(debt.customerCurrentBalance)}</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {filtered.length === 0 && <div className="p-4 sm:p-6 text-center text-neutral-400 text-sm">No debts match your search.</div>}
      </div>
    </div>
  );
}

// ============================================================================
// PATTERN MODAL
// ============================================================================
function PatternModal({ patterns, onClose, selectedPattern, setSelectedPattern }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm sm:max-w-2xl max-h-[80vh] overflow-y-auto p-4 sm:p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-3 sm:mb-4">
          <div>
            <h3 className="font-display text-lg sm:text-xl font-semibold text-ink-950 flex items-center gap-2">
              <IconAlert className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" /> Pattern Alerts
            </h3>
            <p className="text-sm text-neutral-500 mt-1">Our system has detected {patterns.length} pattern(s) in your shift reconciliations</p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 w-9 h-9 flex items-center justify-center shrink-0">
            <IconClose className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        <div className="space-y-2 sm:space-y-3">
          {patterns.map(pattern => (
            <div key={pattern.id} className="border border-amber-200 bg-amber-50 rounded-lg p-3 sm:p-4">
              <div className="flex flex-wrap justify-between items-start gap-1">
                <div>
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span className="font-semibold text-amber-800 text-sm">{pattern.pattern_type.replace('_', ' ')}</span>
                    <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">Score: {pattern.score}</span>
                  </div>
                  {pattern.details && (
                    <p className="text-sm text-amber-700 mt-1">{pattern.details}</p>
                  )}
                  <p className="text-xs text-amber-600 mt-1">Detected: {new Date(pattern.detected_at).toLocaleString()}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-amber-600">Status: {pattern.resolved_at ? 'Resolved' : 'Active'}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="w-full sm:w-auto px-6 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-lg transition text-base min-h-[44px]">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HELPERS
// ============================================================================
function StatBlock({ label, value, color }) {
  return (
    <div className="bg-white rounded-xl shadow-card p-3 sm:p-4">
      <p className="text-xs text-neutral-400">{label}</p>
      <p className={`text-base sm:text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, title, subtitle, success }) {
  return (
    <div className="bg-white rounded-xl p-4 sm:p-8 text-center text-neutral-400">
      <Icon className={`w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 ${success ? 'text-emerald-400' : 'opacity-30'}`} />
      <p className="font-medium text-ink-950 text-sm sm:text-base">{title}</p>
      <p className="text-sm mt-1">{subtitle}</p>
    </div>
  );
}
