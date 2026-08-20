import React, { useEffect, useState } from 'react';
import { api, apiFetch } from '../api/client';

function money(n) { return `KES ${Number(n || 0).toLocaleString()}`; }
const CATEGORIES = ['Rent', 'Electricity', 'Transport', 'Salaries', 'Repairs', 'Licenses', 'Supplies', 'Other'];

export default function Expenses() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ category: 'Rent', amount: '', paymentMethod: 'CASH', description: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => { load(); }, []);
  async function load() { try { setRows(await api.expenses()); } catch (e) {} }

  async function submit() {
    if (!form.amount) return;
    setBusy(true);
    try {
      await apiFetch('/api/expenses', { method: 'POST', body: { ...form, amount: Number(form.amount) } });
      setForm({ category: 'Rent', amount: '', paymentMethod: 'CASH', description: '' });
      load();
    } finally { setBusy(false); }
  }

  const total = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Expenses</h1>
      <p className="text-sm text-neutral-500 mb-4">Total recorded: {money(total)}</p>

      <div className="bg-white rounded-xl shadow-sm p-4 mb-4 grid sm:grid-cols-5 gap-2 items-end">
        <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="border rounded-lg px-2 py-2">
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <input placeholder="Amount" type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="border rounded-lg px-2 py-2" />
        <select value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))} className="border rounded-lg px-2 py-2">
          <option value="CASH">Cash</option><option value="MOBILE">Mobile</option><option value="CARD">Card</option><option value="OTHER">Other</option>
        </select>
        <input placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="border rounded-lg px-2 py-2 sm:col-span-1" />
        <button disabled={busy} onClick={submit} className="bg-brand text-white rounded-lg py-2 font-semibold">Add</button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-neutral-400 border-b"><th className="p-3">Date</th><th className="p-3">Category</th><th className="p-3">Amount</th><th className="p-3">Method</th><th className="p-3">Description</th><th className="p-3">By</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t">
                <td className="p-3">{r.expense_date}</td><td className="p-3">{r.category}</td>
                <td className="p-3">{money(r.amount)}</td><td className="p-3">{r.payment_method}</td>
                <td className="p-3 text-neutral-500">{r.description}</td><td className="p-3 text-neutral-500">{r.created_by_name}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-neutral-400">No expenses yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
