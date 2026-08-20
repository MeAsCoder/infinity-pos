import React, { useEffect, useState } from 'react';
import { api, apiFetch, OfflineError } from '../api/client';
import { enqueue } from '../db/offlineDb';

function money(n) { return `KES ${Number(n || 0).toLocaleString()}`; }

export default function Credit() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => { load(); }, [search]);
  async function load() {
    try { setCustomers(await api.customers(search ? `?search=${encodeURIComponent(search)}` : '')); } catch (e) {}
  }

  const totalOutstanding = customers.reduce((s, c) => s + Math.max(c.balance, 0), 0);

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-1">
        <h1 className="text-2xl font-bold">Credit / Customers</h1>
        <button onClick={() => setShowNew(true)} className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold">+ New Customer</button>
      </div>
      <p className="text-sm text-neutral-500 mb-4">Total outstanding: <span className="font-semibold">{money(totalOutstanding)}</span></p>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customer…" className="w-full border rounded-lg px-3 py-2 mb-4" />

      <div className="bg-white rounded-xl shadow-sm divide-y">
        {customers.map(c => (
          <button key={c.id} onClick={() => setSelected(c)} className="w-full flex justify-between items-center p-3 text-left hover:bg-neutral-50">
            <div>
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-neutral-400">{c.phone}</div>
            </div>
            <div className={`font-semibold ${c.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>{money(c.balance)}</div>
          </button>
        ))}
        {customers.length === 0 && <div className="p-6 text-center text-neutral-400">No customers</div>}
      </div>

      {selected && <CustomerDrawer customer={selected} onClose={() => setSelected(null)} onChanged={() => { setSelected(null); load(); }} />}
      {showNew && <NewCustomerDrawer onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load(); }} />}
    </div>
  );
}

function CustomerDrawer({ customer, onClose, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [writeoffReason, setWriteoffReason] = useState('');
  const [showWriteoff, setShowWriteoff] = useState(false);

  useEffect(() => { api.customer(customer.id).then(setDetail).catch(() => {}); }, [customer.id]);

  async function repay() {
    if (!amount || Number(amount) <= 0) return;
    setBusy(true); setMsg('');
    const clientUuid = crypto.randomUUID();
    const payload = { customerId: customer.id, amount: Number(amount), notes: 'Repayment via Credit screen' };
    try {
      if (navigator.onLine) {
        await apiFetch(`/api/customers/${customer.id}/repay`, { method: 'POST', body: { amount: Number(amount), clientUuid } });
        setMsg('Repayment recorded.');
      } else {
        await enqueue('CREDIT_REPAYMENT', clientUuid, { customerId: customer.id, amount: Number(amount), clientUuid });
        setMsg('Saved offline — will sync automatically.');
      }
      setAmount('');
      onChanged();
    } catch (e) {
      if (e instanceof OfflineError) {
        await enqueue('CREDIT_REPAYMENT', clientUuid, { customerId: customer.id, amount: Number(amount), clientUuid });
        setMsg('Saved offline — will sync automatically.');
        onChanged();
      } else setMsg(e.message);
    } finally { setBusy(false); }
  }

  async function writeOff() {
    if (!amount || !writeoffReason) return;
    setBusy(true);
    try {
      await api.writeOff(customer.id, { amount: Number(amount), reason: writeoffReason });
      onChanged();
    } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-end z-40" onClick={onClose}>
      <div className="bg-white w-full sm:w-96 h-full overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-bold">{customer.name}</h2>
            <p className="text-sm text-neutral-400">{customer.phone}</p>
          </div>
          <button onClick={onClose} className="text-neutral-400 text-xl">✕</button>
        </div>

        <div className="bg-neutral-50 rounded-xl p-4 mb-4 text-center">
          <div className="text-xs text-neutral-400">Outstanding balance</div>
          <div className={`text-2xl font-bold ${customer.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>{money(customer.balance)}</div>
          <div className="text-xs text-neutral-400 mt-1">Limit: {money(customer.creditLimit)}</div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-neutral-600 mb-1">Record repayment</label>
          <div className="flex gap-2">
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="flex-1 border rounded-lg px-3 py-2" placeholder="Amount" />
            <button disabled={busy} onClick={repay} className="bg-brand text-white px-4 rounded-lg font-semibold">Pay</button>
          </div>
          {msg && <p className="text-xs text-green-700 mt-1">{msg}</p>}
        </div>

        {!showWriteoff ? (
          <button onClick={() => setShowWriteoff(true)} className="text-xs text-red-500 mb-4">Write off debt instead…</button>
        ) : (
          <div className="mb-4 border rounded-lg p-3">
            <input placeholder="Reason (required)" value={writeoffReason} onChange={e => setWriteoffReason(e.target.value)} className="w-full border rounded px-2 py-1 mb-2 text-sm" />
            <button disabled={busy} onClick={writeOff} className="w-full bg-red-500 text-white py-2 rounded-lg text-sm font-semibold">Confirm Write-off</button>
          </div>
        )}

        <h3 className="font-semibold text-sm mb-2 text-neutral-600">Ledger</h3>
        <div className="divide-y text-sm">
          {(detail?.ledger || []).map(l => (
            <div key={l.id} className="py-2 flex justify-between">
              <div>
                <div className="font-medium">{l.type}</div>
                <div className="text-xs text-neutral-400">{new Date(l.created_at).toLocaleString()}{l.notes ? ` · ${l.notes}` : ''}</div>
              </div>
              <div className={`font-semibold ${l.amount > 0 ? 'text-red-600' : 'text-green-600'}`}>{l.amount > 0 ? '+' : ''}{money(l.amount)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NewCustomerDrawer({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', phone: '', address: '', creditLimit: '' });
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!form.name) return;
    setBusy(true);
    try { await api.createCustomer({ ...form, creditLimit: Number(form.creditLimit) || 0 }); onSaved(); }
    finally { setBusy(false); }
  }
  return (
    <div className="fixed inset-0 bg-black/40 flex justify-end z-40" onClick={onClose}>
      <div className="bg-white w-full sm:w-96 h-full overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">New Customer</h2>
        <div className="space-y-3">
          <input placeholder="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border rounded-lg px-3 py-2" />
          <input placeholder="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full border rounded-lg px-3 py-2" />
          <input placeholder="Address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="w-full border rounded-lg px-3 py-2" />
          <input placeholder="Credit limit" type="number" value={form.creditLimit} onChange={e => setForm(f => ({ ...f, creditLimit: e.target.value }))} className="w-full border rounded-lg px-3 py-2" />
        </div>
        <button disabled={busy} onClick={save} className="w-full bg-brand text-white font-semibold py-3 rounded-xl mt-5">Create Customer</button>
      </div>
    </div>
  );
}
