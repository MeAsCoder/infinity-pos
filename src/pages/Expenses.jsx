import React, { useEffect, useState, useMemo } from 'react';
import { api, apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { IconPlus, IconClose } from '../components/Icons';

function money(n) { return `KES ${Number(n || 0).toLocaleString()}`; }

const CATEGORIES = ['Rent', 'Electricity', 'Water', 'Transport', 'Salaries', 'Repairs', 'Licenses', 'Supplies', 'Marketing', 'Other'];

export default function Expenses() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ 
    category: 'Rent', 
    amount: '', 
    paymentMethod: 'CASH', 
    description: '',
    expenseDate: new Date().toISOString().split('T')[0]
  });
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { 
      const data = await api.expenses();
      setRows(data || []); 
    } catch (e) {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    if (!form.amount || Number(form.amount) <= 0) return;
    setBusy(true);
    try {
      await apiFetch('/api/expenses', { 
        method: 'POST', 
        body: { 
          ...form, 
          amount: Number(form.amount),
          expenseDate: form.expenseDate || new Date().toISOString().split('T')[0]
        } 
      });
      setForm({ 
        category: 'Rent', 
        amount: '', 
        paymentMethod: 'CASH', 
        description: '',
        expenseDate: new Date().toISOString().split('T')[0]
      });
      setShowForm(false);
      load();
    } catch (e) {
      alert('Failed to add expense: ' + e.message);
    } finally { 
      setBusy(false); 
    }
  }

  // Filter expenses
  const filteredRows = useMemo(() => {
    let result = rows;
    
    if (filterCategory !== 'all') {
      result = result.filter(r => r.category === filterCategory);
    }
    
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r => 
        r.category?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q) ||
        r.created_by_name?.toLowerCase().includes(q)
      );
    }
    
    return result;
  }, [rows, filterCategory, search]);

  const total = rows.reduce((s, r) => s + (r.amount || 0), 0);
  const categories = useMemo(() => {
    const cats = new Set(rows.map(r => r.category).filter(Boolean));
    return ['all', ...Array.from(cats)];
  }, [rows]);

  return (
    <div className="p-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-ink-950">Expenses</h1>
          <div className="flex flex-wrap gap-4 mt-1 text-sm text-neutral-500">
            <span>Total: <span className="font-semibold text-ink-950">{money(total)}</span></span>
            <span>· {rows.length} transactions</span>
          </div>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)} 
          className="flex items-center gap-2 bg-brand hover:bg-brand-dark text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition shadow-soft"
        >
          <IconPlus className="w-4 h-4" /> {showForm ? 'Cancel' : 'Add Expense'}
        </button>
      </div>

      {/* Add Expense Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-neutral-100 p-5 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <div>
              <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1 block">Category</label>
              <select 
                value={form.category} 
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))} 
                className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none transition bg-white"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1 block">Amount (KES)</label>
              <input 
                placeholder="0.00" 
                type="number" 
                value={form.amount} 
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} 
                className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1 block">Payment Method</label>
              <select 
                value={form.paymentMethod} 
                onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))} 
                className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none transition bg-white"
              >
                <option value="CASH">Cash</option>
                <option value="MOBILE">Mobile</option>
                <option value="CARD">Card</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1 block">Date</label>
              <input 
                type="date" 
                value={form.expenseDate} 
                onChange={e => setForm(f => ({ ...f, expenseDate: e.target.value }))} 
                className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1 block">Description</label>
              <input 
                placeholder="What was this for?" 
                value={form.description} 
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} 
                className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button 
              onClick={() => setShowForm(false)} 
              className="px-4 py-2 border border-neutral-200 rounded-lg text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition"
            >
              Cancel
            </button>
            <button 
              disabled={busy || !form.amount} 
              onClick={submit} 
              className="bg-brand hover:bg-brand-dark text-white px-6 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50"
            >
              {busy ? 'Adding...' : 'Add Expense'}
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4 bg-white rounded-xl shadow-sm p-3 border border-neutral-100">
        <div className="flex-1 min-w-[140px] relative">
          <span className="text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 text-sm">🔍</span>
          <input 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Search expenses..." 
            className="w-full border border-neutral-200 rounded-lg pl-9 pr-3 py-2 text-sm bg-neutral-50 focus:bg-white focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
          />
        </div>
        
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="border border-neutral-200 rounded-lg px-3 py-2 text-sm bg-white focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
        >
          {categories.map(cat => (
            <option key={cat} value={cat}>
              {cat === 'all' ? 'All Categories' : cat}
            </option>
          ))}
        </select>
        
        {(search || filterCategory !== 'all') && (
          <button
            onClick={() => { setSearch(''); setFilterCategory('all'); }}
            className="text-sm text-neutral-400 hover:text-neutral-600 underline whitespace-nowrap"
          >
            Clear
          </button>
        )}
      </div>

      {/* Expenses Table */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-neutral-100 p-8 text-center text-neutral-400 text-sm">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand mx-auto"></div>
          <p className="mt-3">Loading expenses...</p>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-neutral-100 p-12 text-center text-neutral-400 text-sm">
          {search || filterCategory !== 'all' ? 'No expenses match your filters' : 'No expenses recorded yet'}
          {(search || filterCategory !== 'all') && (
            <button
              onClick={() => { setSearch(''); setFilterCategory('all'); }}
              className="block mt-2 text-brand text-sm font-medium hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-neutral-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr className="text-left text-neutral-500 font-semibold text-xs uppercase tracking-wider">
                  <th className="p-3">Date</th>
                  <th className="p-3">Category</th>
                  <th className="p-3 text-right">Amount</th>
                  <th className="p-3">Method</th>
                  <th className="p-3">Description</th>
                  <th className="p-3">Recorded By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredRows.map(r => (
                  <tr key={r.id} className="hover:bg-neutral-50 transition">
                    <td className="p-3 text-neutral-600">{r.expense_date || new Date(r.created_at).toISOString().split('T')[0]}</td>
                    <td className="p-3">
                      <span className="text-xs px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-600 font-medium">
                        {r.category}
                      </span>
                    </td>
                    <td className="p-3 text-right font-semibold text-ink-950">
                      {money(r.amount)}
                    </td>
                    <td className="p-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        r.payment_method === 'CASH' ? 'bg-neutral-100 text-neutral-600' :
                        r.payment_method === 'MOBILE' ? 'bg-emerald-100 text-emerald-700' :
                        r.payment_method === 'CARD' ? 'bg-blue-100 text-blue-700' :
                        'bg-neutral-100 text-neutral-600'
                      }`}>
                        {r.payment_method}
                      </span>
                    </td>
                    <td className="p-3 text-neutral-500 max-w-[200px] truncate">
                      {r.description || '—'}
                    </td>
                    <td className="p-3 text-neutral-500">
                      {r.created_by_name || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-neutral-50 border-t-2 border-neutral-200">
                <tr>
                  <td colSpan="2" className="p-3 font-semibold text-ink-950">Total</td>
                  <td className="p-3 text-right font-bold text-ink-950">{money(total)}</td>
                  <td colSpan="3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}