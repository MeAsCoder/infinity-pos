import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { IconPlus, IconClose } from '../components/Icons';

function money(n) { return `KES ${Number(n || 0).toLocaleString()}`; }

export default function Products() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [search]);
  async function load() {
    setLoading(true);
    try { setProducts(await api.products(`?active=1${search ? `&search=${encodeURIComponent(search)}` : ''}`)); }
    finally { setLoading(false); }
  }

  // Refresh just one row in place (used after a price save) without losing scroll position.
  async function refreshOne(id) {
    const fresh = await api.product(id);
    setProducts(list => list.map(p => p.id === id ? fresh : p));
    return fresh;
  }

  const selected = products.find(p => p.id === selectedId) || null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-950">Products</h1>
          <p className="text-sm text-neutral-500 mt-0.5">{products.length} active items in the catalogue</p>
        </div>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-1.5 bg-brand hover:bg-brand-dark text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-soft transition">
          <IconPlus className="w-4 h-4" /> New Product
        </button>
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products…"
        className="w-full border border-neutral-200 rounded-xl px-4 py-3 mb-5 bg-white focus:border-brand focus:ring-1 focus:ring-brand outline-none transition" />

      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-neutral-400 border-b border-neutral-100 bg-neutral-50/60">
              <th className="p-4 font-medium">Name</th><th className="p-4 font-medium">Category</th><th className="p-4 font-medium">Stock</th>
              <th className="p-4 font-medium">Serving</th><th className="p-4 font-medium">Base Price</th><th className="p-4"></th>
            </tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id} className="border-t border-neutral-100 hover:bg-neutral-50/80 transition">
                <td className="p-4 font-medium text-ink-950">{p.name}</td>
                <td className="p-4 text-neutral-500">{p.category || '—'}</td>
                <td className={`p-4 ${p.lowStock ? 'text-rose-600 font-medium' : 'text-neutral-600'}`}>{p.trackInventory ? p.stockDisplay : 'not tracked'}</td>
                <td className="p-4">{p.allowServing ? <span className="text-emerald-600">✓</span> : <span className="text-neutral-300">—</span>}</td>
                <td className="p-4 font-medium">{p.sellingUnits[0] ? money(p.sellingUnits[0].price) : '—'}</td>
                <td className="p-4"><button onClick={() => setSelectedId(p.id)} className="text-brand font-semibold hover:underline">Edit</button></td>
              </tr>
            ))}
            {!loading && products.length === 0 && <tr><td colSpan={6} className="p-10 text-center text-neutral-400">No products found</td></tr>}
          </tbody>
        </table>
      </div>

      {selected && (
        <ProductDrawer
          product={selected}
          onClose={() => setSelectedId(null)}
          onRefresh={() => refreshOne(selected.id)}
          onDeactivated={() => { setSelectedId(null); load(); }}
        />
      )}
      {showNew && <NewProductDrawer onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load(); }} />}
    </div>
  );
}

function ProductDrawer({ product, onClose, onRefresh, onDeactivated }) {
  // Keyed on product.id so switching products (or a refresh with new price data)
  // re-syncs local input state instead of showing stale values.
  const [prices, setPrices] = useState({});
  const [savingUnit, setSavingUnit] = useState(null);
  const [savedUnit, setSavedUnit] = useState(null);
  const [allowServing, setAllowServing] = useState(product.allowServing);
  const [reorderLevel, setReorderLevel] = useState(product.reorderLevel);
  const [active, setActive] = useState(product.active);
  const [busy, setBusy] = useState(false);
  const [newUnit, setNewUnit] = useState({ name: '', volumeMl: '', price: '', cost: '' });
  const [err, setErr] = useState('');

  useEffect(() => {
    setPrices(Object.fromEntries(product.sellingUnits.map(u => [u.id, { price: u.price, cost: u.cost }])));
    setAllowServing(product.allowServing);
    setReorderLevel(product.reorderLevel);
    setActive(product.active);
  }, [product]);

  async function savePrice(unitId) {
    setErr(''); setSavingUnit(unitId); setSavedUnit(null);
    try {
      await api.setPrice(product.id, unitId, { sellingPrice: Number(prices[unitId].price), costPrice: Number(prices[unitId].cost) });
      await onRefresh(); // pulls the freshly-saved price back so the UI reflects what's actually in the DB
      setSavedUnit(unitId);
      setTimeout(() => setSavedUnit(null), 2000);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSavingUnit(null);
    }
  }

  async function saveMeta() {
    setBusy(true); setErr('');
    try { await api.updateProduct(product.id, { allowServing, reorderLevel: Number(reorderLevel), active }); await onRefresh(); if (!active) onDeactivated(); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function addUnit() {
    if (!newUnit.name || !newUnit.volumeMl) return;
    setBusy(true); setErr('');
    try {
      await api.addUnit(product.id, { name: newUnit.name, volumeMl: Number(newUnit.volumeMl), price: Number(newUnit.price) || 0, cost: Number(newUnit.cost) || 0 });
      setNewUnit({ name: '', volumeMl: '', price: '', cost: '' });
      await onRefresh();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-end z-40" onClick={onClose}>
      <div className="bg-white w-full sm:w-[460px] h-full overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-5">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink-950">{product.name}</h2>
            <p className="text-sm text-neutral-400 mt-0.5">{product.category} · {product.stockDisplay}</p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 p-1"><IconClose className="w-5 h-5" /></button>
        </div>

        {err && <div className="bg-rose-50 text-rose-700 text-sm rounded-lg p-3 mb-4 border border-rose-100">{err}</div>}

        <h3 className="font-semibold text-xs uppercase tracking-wide mb-2.5 text-neutral-400">Selling Units &amp; Prices</h3>
        <div className="space-y-2.5 mb-5">
          {product.sellingUnits.map(u => (
            <div key={u.id} className="border border-neutral-200 rounded-xl p-3.5">
              <div className="flex justify-between items-center mb-2.5">
                <span className="font-medium text-sm text-ink-950">{u.name} <span className="text-neutral-400 font-normal">({u.volumeMl}ml)</span></span>
                {savedUnit === u.id && <span className="text-xs text-emerald-600 font-medium">Saved ✓</span>}
              </div>
              <div className="flex gap-2 items-center flex-wrap">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-neutral-400">Price</label>
                  <input type="number" value={prices[u.id]?.price ?? ''} onChange={e => setPrices(p => ({ ...p, [u.id]: { ...p[u.id], price: e.target.value } }))}
                    className="w-24 border border-neutral-200 rounded-lg px-2 py-1.5 text-sm focus:border-brand outline-none" />
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-neutral-400">Cost</label>
                  <input type="number" value={prices[u.id]?.cost ?? ''} onChange={e => setPrices(p => ({ ...p, [u.id]: { ...p[u.id], cost: e.target.value } }))}
                    className="w-24 border border-neutral-200 rounded-lg px-2 py-1.5 text-sm focus:border-brand outline-none" />
                </div>
                <button disabled={savingUnit === u.id} onClick={() => savePrice(u.id)} className="ml-auto text-brand text-sm font-semibold disabled:opacity-50">
                  {savingUnit === u.id ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          ))}
        </div>

        <details className="mb-5">
          <summary className="text-xs font-semibold uppercase tracking-wide text-neutral-400 cursor-pointer">+ Add a selling unit (custom serving)</summary>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <input placeholder="Name (e.g. Double Tot)" value={newUnit.name} onChange={e => setNewUnit(n => ({ ...n, name: e.target.value }))} className="border border-neutral-200 rounded-lg px-2.5 py-1.5 text-sm col-span-2" />
            <input placeholder="Volume ml" type="number" value={newUnit.volumeMl} onChange={e => setNewUnit(n => ({ ...n, volumeMl: e.target.value }))} className="border border-neutral-200 rounded-lg px-2.5 py-1.5 text-sm" />
            <input placeholder="Price" type="number" value={newUnit.price} onChange={e => setNewUnit(n => ({ ...n, price: e.target.value }))} className="border border-neutral-200 rounded-lg px-2.5 py-1.5 text-sm" />
            <input placeholder="Cost" type="number" value={newUnit.cost} onChange={e => setNewUnit(n => ({ ...n, cost: e.target.value }))} className="border border-neutral-200 rounded-lg px-2.5 py-1.5 text-sm" />
            <button disabled={busy} onClick={addUnit} className="bg-neutral-100 hover:bg-neutral-200 rounded-lg px-2.5 py-1.5 font-medium text-sm transition">Add</button>
          </div>
        </details>

        <h3 className="font-semibold text-xs uppercase tracking-wide mb-2.5 text-neutral-400">Settings</h3>
        <label className="flex items-center gap-2.5 mb-2.5 text-sm text-ink-950"><input type="checkbox" checked={allowServing} onChange={e => setAllowServing(e.target.checked)} className="w-4 h-4 accent-brand" /> Allow serving sales (half/tot)</label>
        <label className="flex items-center gap-2.5 mb-2.5 text-sm text-ink-950">Reorder level (units): <input type="number" value={reorderLevel} onChange={e => setReorderLevel(e.target.value)} className="border border-neutral-200 rounded-lg px-2 py-1 w-20 text-sm" /></label>
        <label className="flex items-center gap-2.5 mb-5 text-sm text-ink-950"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} className="w-4 h-4 accent-brand" /> Active</label>

        <button disabled={busy} onClick={saveMeta} className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-xl transition disabled:opacity-50">
          {busy ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

function NewProductDrawer({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', brand: '', category: '', volumeMl: 750, allowServing: false, price: '', cost: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    if (!form.name) return;
    setBusy(true); setErr('');
    try {
      await api.createProduct({
        name: form.name, brand: form.brand, category: form.category, volumeMl: Number(form.volumeMl) || 1,
        allowServing: form.allowServing,
        sellingUnits: [{ name: form.volumeMl > 1 ? 'Bottle' : 'Piece', volumeMl: Number(form.volumeMl) || 1, price: Number(form.price) || 0, cost: Number(form.cost) || 0 }],
      });
      onSaved();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-end z-40" onClick={onClose}>
      <div className="bg-white w-full sm:w-96 h-full overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-5">
          <h2 className="font-display text-xl font-semibold text-ink-950">New Product</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 p-1"><IconClose className="w-5 h-5" /></button>
        </div>
        {err && <div className="bg-rose-50 text-rose-700 text-sm rounded-lg p-3 mb-4 border border-rose-100">{err}</div>}
        <div className="space-y-3">
          <input placeholder="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm" />
          <input placeholder="Brand" value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm" />
          <input placeholder="Category" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Volume ml (1 = piece)" type="number" value={form.volumeMl} onChange={e => setForm(f => ({ ...f, volumeMl: e.target.value }))} className="border border-neutral-200 rounded-lg px-3 py-2.5 text-sm" />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.allowServing} onChange={e => setForm(f => ({ ...f, allowServing: e.target.checked }))} className="accent-brand" /> Servings</label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Base price" type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} className="border border-neutral-200 rounded-lg px-3 py-2.5 text-sm" />
            <input placeholder="Base cost" type="number" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} className="border border-neutral-200 rounded-lg px-3 py-2.5 text-sm" />
          </div>
        </div>
        <button disabled={busy} onClick={save} className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-xl mt-5 transition disabled:opacity-50">
          {busy ? 'Creating…' : 'Create Product'}
        </button>
        <p className="text-xs text-neutral-400 mt-2">You can add Half/Tot serving units and adjust stock afterward.</p>
      </div>
    </div>
  );
}
