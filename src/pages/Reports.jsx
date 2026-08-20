import React, { useEffect, useState } from 'react';
import { api, apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';

function money(n) { return `KES ${Number(n || 0).toLocaleString()}`; }

const TABS = ['Sales', 'Products', 'Waiters', 'Profit', 'Stock'];

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

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <h1 className="text-2xl font-bold">Reports</h1>
        
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => {
              setDateRange(e.target.value);
              if (e.target.value === 'custom') {
                setShowDatePicker(true);
              } else {
                setShowDatePicker(false);
              }
            }}
            className="border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none transition bg-white"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="custom">Custom Range</option>
          </select>

          {showDatePicker && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border border-neutral-200 rounded-lg px-2 py-1.5 text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
              />
              <span className="text-neutral-400 text-sm">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border border-neutral-200 rounded-lg px-2 py-1.5 text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto">
        {TABS.map(t => (
          <button 
            key={t} 
            onClick={() => setTab(t)} 
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${tab === t ? 'bg-brand text-white' : 'bg-white border'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Sales' && <SalesReport dateRange={dateRange} startDate={startDate} endDate={endDate} />}
      {tab === 'Products' && <ProductReport dateRange={dateRange} startDate={startDate} endDate={endDate} />}
      {tab === 'Waiters' && <WaiterReport dateRange={dateRange} startDate={startDate} endDate={endDate} />}
      {tab === 'Profit' && <ProfitReport dateRange={dateRange} startDate={startDate} endDate={endDate} />}
      {tab === 'Stock' && <StockReport />}
    </div>
  );
}

function Table({ cols, rows, renderRow }) {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-neutral-400 border-b">{cols.map(c => <th key={c} className="p-3">{c}</th>)}</tr></thead>
        <tbody>
          {rows.map(renderRow)}
          {rows.length === 0 && <tr><td colSpan={cols.length} className="p-6 text-center text-neutral-400">No data</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function SalesReport({ dateRange, startDate, endDate }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateRange === 'today') {
      params.append('date', new Date().toISOString().split('T')[0]);
    } else if (dateRange === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      params.append('date', yesterday.toISOString().split('T')[0]);
    } else if (dateRange === 'week' || dateRange === 'month') {
      params.append('startDate', startDate);
      params.append('endDate', endDate);
    } else if (dateRange === 'custom') {
      params.append('startDate', startDate);
      params.append('endDate', endDate);
    }
    apiFetch(`/api/reports/sales?${params.toString()}`)
      .then(setRows)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dateRange, startDate, endDate]);

  if (loading) return <div className="text-neutral-400 p-4">Loading...</div>;

  return <Table cols={['Day', 'Transactions', 'Revenue', 'Discounts']} rows={rows} renderRow={r => (
    <tr key={r.day} className="border-t"><td className="p-3">{r.day}</td><td className="p-3">{r.transactions}</td><td className="p-3">{money(r.revenue)}</td><td className="p-3">{money(r.discounts)}</td></tr>
  )} />;
}

function ProductReport({ dateRange, startDate, endDate }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateRange === 'today') {
      params.append('date', new Date().toISOString().split('T')[0]);
    } else if (dateRange === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      params.append('date', yesterday.toISOString().split('T')[0]);
    } else if (dateRange === 'week' || dateRange === 'month') {
      params.append('startDate', startDate);
      params.append('endDate', endDate);
    } else if (dateRange === 'custom') {
      params.append('startDate', startDate);
      params.append('endDate', endDate);
    }
    apiFetch(`/api/reports/products?${params.toString()}`)
      .then(setRows)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dateRange, startDate, endDate]);

  if (loading) return <div className="text-neutral-400 p-4">Loading...</div>;

  return <Table cols={['Product', 'Units Sold', 'Revenue', 'COGS', 'Gross Profit', 'Margin']} rows={rows} renderRow={r => (
    <tr key={r.id} className="border-t">
      <td className="p-3 font-medium">{r.name}</td><td className="p-3">{r.unitsSold}</td>
      <td className="p-3">{money(r.revenue)}</td><td className="p-3">{money(r.cogs)}</td>
      <td className="p-3">{money(r.grossProfit)}</td><td className="p-3">{r.marginPct.toFixed(1)}%</td>
    </tr>
  )} />;
}

function WaiterReport({ dateRange, startDate, endDate }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateRange === 'today') {
      params.append('date', new Date().toISOString().split('T')[0]);
    } else if (dateRange === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      params.append('date', yesterday.toISOString().split('T')[0]);
    } else if (dateRange === 'week' || dateRange === 'month') {
      params.append('startDate', startDate);
      params.append('endDate', endDate);
    } else if (dateRange === 'custom') {
      params.append('startDate', startDate);
      params.append('endDate', endDate);
    }
    apiFetch(`/api/reports/waiters?${params.toString()}`)
      .then(setRows)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dateRange, startDate, endDate]);

  if (loading) return <div className="text-neutral-400 p-4">Loading...</div>;

  return <Table cols={['Waiter', 'Transactions', 'Revenue', 'Avg Sale', 'Cash', 'Mobile', 'Card', 'Credit', 'Shortages', 'Surpluses']} rows={rows} renderRow={r => (
    <tr key={r.id} className="border-t">
      <td className="p-3 font-medium">{r.name}</td><td className="p-3">{r.transactions}</td>
      <td className="p-3">{money(r.revenue)}</td><td className="p-3">{money(r.avgTransaction)}</td>
      <td className="p-3">{money(r.cashRevenue)}</td><td className="p-3">{money(r.mobileRevenue)}</td>
      <td className="p-3">{money(r.cardRevenue)}</td><td className="p-3">{money(r.creditRevenue)}</td>
      <td className="p-3 text-red-500">{money(r.shortages)}</td><td className="p-3 text-green-600">{money(r.surpluses)}</td>
    </tr>
  )} />;
}

function ProfitReport({ dateRange, startDate, endDate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateRange === 'today') {
      params.append('date', new Date().toISOString().split('T')[0]);
    } else if (dateRange === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      params.append('date', yesterday.toISOString().split('T')[0]);
    } else if (dateRange === 'week' || dateRange === 'month') {
      params.append('startDate', startDate);
      params.append('endDate', endDate);
    } else if (dateRange === 'custom') {
      params.append('startDate', startDate);
      params.append('endDate', endDate);
    }
    apiFetch(`/api/reports/profit?${params.toString()}`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dateRange, startDate, endDate]);

  if (loading) return <div className="text-neutral-400 p-4">Loading...</div>;
  if (!data) return <div className="text-neutral-400 p-4">No data available</div>;
  
  const rows = [
    ['Revenue', data.revenue], ['COGS', -data.cogs], ['Gross Profit', data.grossProfit],
    ['Gross Margin', `${data.grossMarginPct.toFixed(1)}%`], ['Operating Expenses', -data.expenses],
    ['Net Profit', data.netProfit], ['Net Margin', `${data.netMarginPct.toFixed(1)}%`],
  ];
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 max-w-md">
      {rows.map(([label, value]) => (
        <div key={label} className={`flex justify-between py-2 border-b last:border-0 ${label.includes('Profit') ? 'font-bold' : ''}`}>
          <span>{label}</span><span>{typeof value === 'number' ? money(value) : value}</span>
        </div>
      ))}
    </div>
  );
}

function StockReport() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.stockReport()
      .then(setRows)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-neutral-400 p-4">Loading...</div>;

  return <Table cols={['Product', 'Stock (units)', 'Avg cost/ml', 'Stock Value', 'Status']} rows={rows} renderRow={r => (
    <tr key={r.id} className="border-t">
      <td className="p-3 font-medium">{r.name}</td><td className="p-3">{r.stockUnits}</td>
      <td className="p-3">{r.avgCostPerMl.toFixed(2)}</td><td className="p-3">{money(r.stockValue)}</td>
      <td className={`p-3 ${r.lowStock ? 'text-red-500 font-medium' : 'text-green-600'}`}>{r.lowStock ? 'Low' : 'OK'}</td>
    </tr>
  )} />;
}