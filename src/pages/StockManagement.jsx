import React, { useEffect, useState } from 'react';
import { api, apiFetch, OfflineError } from '../api/client';
import { enqueue } from '../db/offlineDb';
import { useAuth } from '../context/AuthContext';

function money(n) { return `KES ${Number(n || 0).toLocaleString()}`; }

export default function StockManagement() {
  const [tab, setTab] = useState('receive');
  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Stock Management</h1>
      <div className="flex gap-2 mb-4">
        {['receive', 'adjust', 'lowstock'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === t ? 'bg-brand text-white' : 'bg-white border'}`}>
            {t === 'receive' ? 'Receive Stock' : t === 'adjust' ? 'Adjustments' : 'Low Stock'}
          </button>
        ))}
      </div>
      {tab === 'receive' && <ReceiveStock />}
      {tab === 'adjust' && <AdjustStock />}
      {tab === 'lowstock' && <LowStock />}
    </div>
  );
}

function useProductSearch() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q) { setResults([]); return; }
      try { setResults(await api.products(`?search=${encodeURIComponent(q)}`)); } catch (e) {}
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  return { q, setQ, results };
}

function ReceiveStock() {
  const { q, setQ, results } = useProductSearch();
  const [product, setProduct] = useState(null);
  const [form, setForm] = useState({ quantityUnits: '', totalCost: '', invoiceRef: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function submit() {
    if (!product || !form.quantityUnits) return;
    setBusy(true); setMsg('');
    const clientUuid = crypto.randomUUID();
    const payload = { productId: product.id, quantityUnits: Number(form.quantityUnits), totalCost: Number(form.totalCost) || 0, invoiceRef: form.invoiceRef, notes: form.notes, clientUuid };
    try {
      if (navigator.onLine) {
        await apiFetch('/api/inventory/receive', { method: 'POST', body: payload });
        setMsg('Stock received.');
      } else {
        await enqueue('STOCK_RECEIPT', clientUuid, payload);
        setMsg('Saved offline — will sync automatically.');
      }
      setProduct(null); setForm({ quantityUnits: '', totalCost: '', invoiceRef: '', notes: '' });
    } catch (e) {
      if (e instanceof OfflineError) {
        await enqueue('STOCK_RECEIPT', clientUuid, payload);
        setMsg('Saved offline — will sync automatically.');
      } else setMsg(e.message);
    } finally { setBusy(false); }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 max-w-lg">
      {!product ? (
        <>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search product to receive stock for…" className="w-full border rounded-lg px-3 py-2 mb-2" />
          <div className="divide-y">
            {results.map(p => (
              <button key={p.id} onClick={() => setProduct(p)} className="w-full text-left py-2 hover:bg-neutral-50 px-1">
                <div className="font-medium text-sm">{p.name}</div>
                <div className="text-xs text-neutral-400">{p.stockDisplay}</div>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="flex justify-between items-center mb-3">
            <div className="font-semibold">{product.name}</div>
            <button onClick={() => setProduct(null)} className="text-xs text-neutral-400">change</button>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input placeholder={`Qty (units of ${product.volumeMl}ml)`} type="number" value={form.quantityUnits} onChange={e => setForm(f => ({ ...f, quantityUnits: e.target.value }))} className="border rounded-lg px-3 py-2" />
            <input placeholder="Total cost (KES)" type="number" value={form.totalCost} onChange={e => setForm(f => ({ ...f, totalCost: e.target.value }))} className="border rounded-lg px-3 py-2" />
          </div>
          <input placeholder="Invoice / reference no." value={form.invoiceRef} onChange={e => setForm(f => ({ ...f, invoiceRef: e.target.value }))} className="w-full border rounded-lg px-3 py-2 mb-2" />
          <textarea placeholder="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full border rounded-lg px-3 py-2 mb-3" rows={2} />
          {msg && <div className="text-sm text-green-700 bg-green-50 rounded p-2 mb-2">{msg}</div>}
          <button disabled={busy} onClick={submit} className="w-full bg-brand text-white font-semibold py-3 rounded-xl">Record Stock Receipt</button>
        </>
      )}
    </div>
  );
}

function AdjustStock() {
  const { q, setQ, results } = useProductSearch();
  const [product, setProduct] = useState(null);
  const [form, setForm] = useState({ changeMl: '', reason: 'DAMAGE', notes: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function submit() {
    if (!product || !form.changeMl || !form.notes) { setMsg('Change amount and notes are required.'); return; }
    setBusy(true); setMsg('');
    const clientUuid = crypto.randomUUID();
    const payload = { productId: product.id, changeMl: Number(form.changeMl), reason: form.reason, notes: form.notes, clientUuid };
    try {
      if (navigator.onLine) {
        await apiFetch('/api/inventory/adjust', { method: 'POST', body: payload });
        setMsg('Adjustment recorded.');
      } else {
        await enqueue('STOCK_ADJUSTMENT', clientUuid, payload);
        setMsg('Saved offline — will sync automatically.');
      }
      setProduct(null); setForm({ changeMl: '', reason: 'DAMAGE', notes: '' });
    } catch (e) {
      if (e instanceof OfflineError) {
        await enqueue('STOCK_ADJUSTMENT', clientUuid, payload);
        setMsg('Saved offline — will sync automatically.');
      } else setMsg(e.message);
    } finally { setBusy(false); }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 max-w-lg">
      <p className="text-xs text-neutral-400 mb-3">Every adjustment requires a reason and is permanently recorded in the audit log. Use a negative number (in ml) for a loss, positive for found stock.</p>
      {!product ? (
        <>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search product…" className="w-full border rounded-lg px-3 py-2 mb-2" />
          <div className="divide-y">
            {results.map(p => (
              <button key={p.id} onClick={() => setProduct(p)} className="w-full text-left py-2 hover:bg-neutral-50 px-1">
                <div className="font-medium text-sm">{p.name}</div>
                <div className="text-xs text-neutral-400">{p.stockDisplay}</div>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="flex justify-between items-center mb-3">
            <div className="font-semibold">{product.name} <span className="text-neutral-400 text-xs">({product.stockDisplay})</span></div>
            <button onClick={() => setProduct(null)} className="text-xs text-neutral-400">change</button>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input placeholder="Change (ml, e.g. -250)" type="number" value={form.changeMl} onChange={e => setForm(f => ({ ...f, changeMl: e.target.value }))} className="border rounded-lg px-3 py-2" />
            <select value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} className="border rounded-lg px-3 py-2">
              <option value="DAMAGE">Damage / broken bottle</option>
              <option value="EXPIRED">Expired</option>
              <option value="MISSING">Missing</option>
              <option value="COMPLIMENTARY">Complimentary</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <textarea placeholder="Notes (required)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full border rounded-lg px-3 py-2 mb-3" rows={2} />
          {msg && <div className="text-sm rounded p-2 mb-2 bg-neutral-50">{msg}</div>}
          <button disabled={busy} onClick={submit} className="w-full bg-brand text-white font-semibold py-3 rounded-xl">Record Adjustment</button>
        </>
      )}
    </div>
  );
}

function LowStock() {
  const [items, setItems] = useState(null);
  useEffect(() => { api.lowStock().then(setItems).catch(() => setItems([])); }, []);
  if (!items) return <div className="text-neutral-400">Loading…</div>;
  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      {items.length === 0 && <p className="text-neutral-400 text-sm">Nothing is low on stock.</p>}
      <table className="w-full text-sm">
        <tbody>
          {items.map(i => (
            <tr key={i.id} className="border-t">
              <td className="p-2 font-medium">{i.name}</td>
              <td className="p-2 text-red-500">{i.currentUnits} units left</td>
              <td className="p-2 text-neutral-400">reorder at {i.reorderLevel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
