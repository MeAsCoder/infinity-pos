import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../api/client';
import { IconPlus, IconClose } from '../components/Icons';

// Mobile-responsiveness pass:
// 1. Filter row mixed a flex-1 search box with auto-width selects — on a
//    narrow screen the selects ended up inconsistently sized next to each
//    other. Restructured: search gets its own full-width row, category/sort
//    share a row as equal flex-1 controls.
// 2. Two-column grids (New Product form, "add custom unit" panel) got tight
//    on ~320-375px screens. Now grid-cols-1 sm:grid-cols-2 so fields stack
//    on phones and pair up from sm: onward.
// 3. Several inputs sat at text-sm (14px), which triggers iOS Safari's
//    auto-zoom on focus. Bumped to text-base (16px) throughout.
// 4. Small buttons (Update, Add Unit, Edit) bumped to real touch targets.
// Product table kept as horizontally-scrolling, consistent with the other
// admin pages already adjusted.

function money(n) { return `KES ${Number(n || 0).toLocaleString()}`; }

export default function Products() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortBy, setSortBy] = useState('name');

  useEffect(() => { load(); }, [search]);

  async function load() {
    setLoading(true);
    try {
      const data = await api.products(`?active=1${search ? `&search=${encodeURIComponent(search)}` : ''}`);
      setProducts(data);
    } finally {
      setLoading(false);
    }
  }

  async function refreshOne(id) {
    const fresh = await api.product(id);
    setProducts(list => list.map(p => p.id === id ? fresh : p));
    return fresh;
  }

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(Boolean));
    return ['all', ...Array.from(cats)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    let result = products;
    if (filterCategory !== 'all') {
      result = result.filter(p => p.category === filterCategory);
    }
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'name': return a.name.localeCompare(b.name);
        case 'price': return (a.sellingUnits[0]?.price || 0) - (b.sellingUnits[0]?.price || 0);
        case 'stock': return (a.stockDisplay || 0) - (b.stockDisplay || 0);
        case 'category': return (a.category || '').localeCompare(b.category || '');
        default: return 0;
      }
    });
    return result;
  }, [products, filterCategory, sortBy]);

  const selected = products.find(p => p.id === selectedId) || null;

  const stats = {
    total: products.length,
    lowStock: products.filter(p => p.lowStock).length,
    outOfStock: products.filter(p => p.stockDisplay === 0).length,
    serving: products.filter(p => p.allowServing).length,
  };

  return (
    <div className="p-3 sm:p-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:justify-between sm:items-center gap-3 mb-4 sm:mb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-ink-950">Products</h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-neutral-500">
            <span>{stats.total} total</span>
            <span>· {stats.total - stats.lowStock - stats.outOfStock} in stock</span>
            {stats.lowStock > 0 && <span className="text-amber-600">· {stats.lowStock} low</span>}
            {stats.outOfStock > 0 && <span className="text-rose-600">· {stats.outOfStock} out</span>}
            <span>· {stats.serving} serving</span>
          </div>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark text-white px-5 py-3 rounded-xl text-sm font-semibold transition shadow-soft min-h-[48px] w-full sm:w-auto"
        >
          <IconPlus className="w-4 h-4" /> New Product
        </button>
      </div>

      {/* Filters — search gets its own row; category/sort share a row as
          equal-width controls instead of auto-sizing next to a flex-1 box */}
      <div className="space-y-2 mb-4 bg-white rounded-xl shadow-sm p-3 border border-neutral-100">
        <div className="relative">
          <span className="text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 text-sm">🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search products..."
            className="w-full border border-neutral-200 rounded-lg pl-9 pr-3 py-2.5 text-base bg-neutral-50 focus:bg-white focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="flex-1 min-w-[140px] border border-neutral-200 rounded-lg px-3 py-2.5 text-base bg-white focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat === 'all' ? 'All Categories' : cat}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="flex-1 min-w-[140px] border border-neutral-200 rounded-lg px-3 py-2.5 text-base bg-white focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
          >
            <option value="name">Sort: Name</option>
            <option value="price">Sort: Price</option>
            <option value="stock">Sort: Stock</option>
            <option value="category">Sort: Category</option>
          </select>

          {(search || filterCategory !== 'all') && (
            <button
              onClick={() => { setSearch(''); setFilterCategory('all'); }}
              className="text-sm text-neutral-400 hover:text-neutral-600 underline whitespace-nowrap min-h-[40px] px-1"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Product Table */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-neutral-100 p-8 text-center text-neutral-400 text-sm">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand mx-auto"></div>
          <p className="mt-3">Loading products...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-neutral-100 p-8 sm:p-12 text-center text-neutral-400 text-sm">
          {search || filterCategory !== 'all' ? 'No products match your filters' : 'No products found'}
          {(search || filterCategory !== 'all') && (
            <button
              onClick={() => { setSearch(''); setFilterCategory('all'); }}
              className="block mx-auto mt-2 text-brand text-sm font-medium hover:underline min-h-[36px]"
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
                  <th className="p-3 whitespace-nowrap">Product</th>
                  <th className="p-3 whitespace-nowrap">Category</th>
                  <th className="p-3 text-right whitespace-nowrap">Price</th>
                  <th className="p-3 text-right whitespace-nowrap">Stock</th>
                  <th className="p-3 text-center whitespace-nowrap">Status</th>
                  <th className="p-3 text-center whitespace-nowrap">Serving</th>
                  <th className="p-3 text-center whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredProducts.map(p => {
                  const unit = p.sellingUnits?.[0];
                  const isOutOfStock = p.stockDisplay === 0;
                  const isLowStock = p.lowStock && !isOutOfStock;

                  let statusText = 'In Stock';
                  let statusColor = 'bg-emerald-100 text-emerald-700';
                  if (isOutOfStock) {
                    statusText = 'Out of Stock';
                    statusColor = 'bg-rose-100 text-rose-700';
                  } else if (isLowStock) {
                    statusText = 'Low Stock';
                    statusColor = 'bg-amber-100 text-amber-700';
                  }

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-neutral-50 transition cursor-pointer"
                      onClick={() => setSelectedId(p.id)}
                    >
                      <td className="p-3 whitespace-nowrap">
                        <div className="font-medium text-ink-950">{p.name}</div>
                        <div className="text-xs text-neutral-400">{p.brand || '—'} · {p.volumeMl}ml</div>
                      </td>
                      <td className="p-3 text-neutral-500 whitespace-nowrap">{p.category || '—'}</td>
                      <td className="p-3 text-right font-semibold text-ink-950 whitespace-nowrap">
                        {unit ? money(unit.price) : '—'}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <span className={isOutOfStock ? 'text-rose-600' : isLowStock ? 'text-amber-600' : 'text-ink-950'}>
                          {p.trackInventory ? p.stockDisplay || 0 : '—'}
                        </span>
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor}`}>
                          {statusText}
                        </span>
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        {p.allowServing ? (
                          <span className="text-emerald-600 font-semibold">✓</span>
                        ) : (
                          <span className="text-neutral-300">—</span>
                        )}
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <button
                          className="text-brand hover:text-brand-dark font-semibold text-sm transition min-h-[36px] px-2"
                          onClick={(e) => { e.stopPropagation(); setSelectedId(p.id); }}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Product Drawer */}
      {selected && (
        <ProductDrawer
          product={selected}
          onClose={() => setSelectedId(null)}
          onRefresh={() => refreshOne(selected.id)}
          onDeactivated={() => { setSelectedId(null); load(); }}
        />
      )}

      {/* New Product Drawer */}
      {showNew && (
        <NewProductDrawer
          onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); load(); }}
        />
      )}
    </div>
  );
}

// ============================================================================
// PRODUCT DRAWER
// ============================================================================
function ProductDrawer({ product, onClose, onRefresh, onDeactivated }) {
  const [prices, setPrices] = useState({});
  const [savingUnit, setSavingUnit] = useState(null);
  const [savedUnit, setSavedUnit] = useState(null);
  const [allowServing, setAllowServing] = useState(product.allowServing);
  const [reorderLevel, setReorderLevel] = useState(product.reorderLevel);
  const [active, setActive] = useState(product.active);
  const [busy, setBusy] = useState(false);
  const [newUnit, setNewUnit] = useState({ name: '', volumeMl: '', price: '', cost: '' });
  const [err, setErr] = useState('');
  const [activeTab, setActiveTab] = useState('units');

  useEffect(() => {
    setPrices(Object.fromEntries(product.sellingUnits.map(u => [u.id, { price: u.price, cost: u.cost }])));
    setAllowServing(product.allowServing);
    setReorderLevel(product.reorderLevel);
    setActive(product.active);
  }, [product]);

  async function savePrice(unitId) {
    setErr(''); setSavingUnit(unitId); setSavedUnit(null);
    try {
      await api.setPrice(product.id, unitId, {
        sellingPrice: Number(prices[unitId].price),
        costPrice: Number(prices[unitId].cost)
      });
      await onRefresh();
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
    try {
      await api.updateProduct(product.id, { allowServing, reorderLevel: Number(reorderLevel), active });
      await onRefresh();
      if (!active) onDeactivated();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function addUnit() {
    if (!newUnit.name || !newUnit.volumeMl) return;
    setBusy(true); setErr('');
    try {
      await api.addUnit(product.id, {
        name: newUnit.name,
        volumeMl: Number(newUnit.volumeMl),
        price: Number(newUnit.price) || 0,
        cost: Number(newUnit.cost) || 0
      });
      setNewUnit({ name: '', volumeMl: '', price: '', cost: '' });
      await onRefresh();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-end z-50" onClick={onClose}>
      <div className="bg-white w-full sm:w-[460px] h-full overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 border-b border-neutral-200 p-4 sm:p-5">
          <div className="flex justify-between items-start gap-2">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg sm:text-xl font-semibold text-ink-950 truncate">{product.name}</h2>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-400 mt-1">
                <span>{product.category || 'Uncategorized'}</span>
                <span>•</span>
                <span>{product.volumeMl}ml</span>
                <span>•</span>
                <span className={product.active ? 'text-emerald-600' : 'text-rose-600'}>
                  {product.active ? 'Active' : 'Inactive'}
                </span>
                <span>•</span>
                <span>Stock: {product.stockDisplay || 0}</span>
              </div>
            </div>
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 w-9 h-9 flex items-center justify-center shrink-0">
              <IconClose className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4 bg-neutral-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('units')}
              className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition min-h-[40px] ${
                activeTab === 'units'
                  ? 'bg-brand text-white'
                  : 'text-neutral-600 hover:text-neutral-800'
              }`}
            >
              Units & Prices
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition min-h-[40px] ${
                activeTab === 'settings'
                  ? 'bg-brand text-white'
                  : 'text-neutral-600 hover:text-neutral-800'
              }`}
            >
              Settings
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5">
          {err && (
            <div className="bg-rose-50 text-rose-700 text-sm rounded-lg p-3 mb-4 border border-rose-100">
              {err}
            </div>
          )}

          {activeTab === 'units' && (
            <>
              <div className="space-y-3 mb-5">
                {product.sellingUnits.map(u => {
                  const priceData = prices[u.id];
                  return (
                    <div key={u.id} className="border border-neutral-200 rounded-lg p-3 sm:p-4 hover:border-brand/30 transition">
                      <div className="flex justify-between items-center mb-3 gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-ink-950">{u.name}</span>
                          <span className="text-sm text-neutral-400">({u.volumeMl}ml)</span>
                        </div>
                        {savedUnit === u.id && (
                          <span className="text-sm text-emerald-600 font-semibold flex items-center gap-1 shrink-0">
                            ✓ Saved
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-neutral-500 font-medium">Price</label>
                          <input
                            type="number"
                            value={priceData?.price ?? ''}
                            onChange={e => setPrices(p => ({ ...p, [u.id]: { ...p[u.id], price: e.target.value } }))}
                            className="w-24 border border-neutral-200 rounded-lg px-2.5 py-2 text-base focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-neutral-500 font-medium">Cost</label>
                          <input
                            type="number"
                            value={priceData?.cost ?? ''}
                            onChange={e => setPrices(p => ({ ...p, [u.id]: { ...p[u.id], cost: e.target.value } }))}
                            className="w-24 border border-neutral-200 rounded-lg px-2.5 py-2 text-base focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
                          />
                        </div>
                        <button
                          disabled={savingUnit === u.id}
                          onClick={() => savePrice(u.id)}
                          className="ml-auto bg-brand hover:bg-brand-dark text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50 min-h-[40px]"
                        >
                          {savingUnit === u.id ? 'Saving...' : 'Update'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <details className="border border-neutral-200 rounded-lg p-4">
                <summary className="text-sm font-medium text-neutral-500 cursor-pointer hover:text-neutral-700 transition py-1">
                  + Add custom unit
                </summary>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <input
                    placeholder="Name"
                    value={newUnit.name}
                    onChange={e => setNewUnit(n => ({ ...n, name: e.target.value }))}
                    className="border border-neutral-200 rounded-lg px-3 py-2.5 text-base col-span-1 sm:col-span-2 focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
                  />
                  <input
                    placeholder="Volume ml"
                    type="number"
                    value={newUnit.volumeMl}
                    onChange={e => setNewUnit(n => ({ ...n, volumeMl: e.target.value }))}
                    className="border border-neutral-200 rounded-lg px-3 py-2.5 text-base focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
                  />
                  <input
                    placeholder="Price"
                    type="number"
                    value={newUnit.price}
                    onChange={e => setNewUnit(n => ({ ...n, price: e.target.value }))}
                    className="border border-neutral-200 rounded-lg px-3 py-2.5 text-base focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
                  />
                  <input
                    placeholder="Cost"
                    type="number"
                    value={newUnit.cost}
                    onChange={e => setNewUnit(n => ({ ...n, cost: e.target.value }))}
                    className="border border-neutral-200 rounded-lg px-3 py-2.5 text-base focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
                  />
                  <button
                    disabled={busy}
                    onClick={addUnit}
                    className="col-span-1 sm:col-span-2 bg-neutral-100 hover:bg-neutral-200 rounded-lg px-3 py-2.5 font-medium text-sm transition disabled:opacity-50 min-h-[44px]"
                  >
                    Add Unit
                  </button>
                </div>
              </details>
            </>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-4">
              <div className="bg-neutral-50 rounded-xl p-4 space-y-4">
                <h4 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider">Product Settings</h4>

                <label className="flex items-center gap-3 text-sm text-ink-950 min-h-[36px]">
                  <input
                    type="checkbox"
                    checked={allowServing}
                    onChange={e => setAllowServing(e.target.checked)}
                    className="w-5 h-5 accent-brand rounded shrink-0"
                  />
                  Allow serving sales (half/tot)
                </label>

                <div className="flex flex-wrap items-center gap-3 text-sm text-ink-950">
                  <span>Reorder level:</span>
                  <input
                    type="number"
                    value={reorderLevel}
                    onChange={e => setReorderLevel(e.target.value)}
                    className="border border-neutral-200 rounded-lg px-2.5 py-2 w-20 text-base focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
                  />
                  <span className="text-sm text-neutral-400">units</span>
                </div>

                <label className="flex items-center gap-3 text-sm text-ink-950 min-h-[36px]">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={e => setActive(e.target.checked)}
                    className="w-5 h-5 accent-brand rounded shrink-0"
                  />
                  Active
                </label>

                <button
                  disabled={busy}
                  onClick={saveMeta}
                  className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-xl text-base transition disabled:opacity-50 min-h-[48px]"
                >
                  {busy ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// NEW PRODUCT DRAWER
// ============================================================================
function NewProductDrawer({ onClose, onSaved }) {
  const [form, setForm] = useState({
    name: '',
    brand: '',
    category: '',
    volumeMl: 750,
    allowServing: false,
    price: '',
    cost: ''
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    if (!form.name) return;
    setBusy(true); setErr('');
    try {
      await api.createProduct({
        name: form.name,
        brand: form.brand || undefined,
        category: form.category || undefined,
        volumeMl: Number(form.volumeMl) || 1,
        allowServing: form.allowServing,
        sellingUnits: [{
          name: Number(form.volumeMl) > 1 ? 'Bottle' : 'Piece',
          volumeMl: Number(form.volumeMl) || 1,
          price: Number(form.price) || 0,
          cost: Number(form.cost) || 0
        }],
      });
      onSaved();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-end z-50" onClick={onClose}>
      <div className="bg-white w-full sm:w-[440px] h-full overflow-y-auto shadow-xl p-4 sm:p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-5 gap-2">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-ink-950">New Product</h2>
            <p className="text-sm text-neutral-400 mt-0.5">Add a product to the catalogue</p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 w-9 h-9 flex items-center justify-center shrink-0">
            <IconClose className="w-5 h-5" />
          </button>
        </div>

        {err && (
          <div className="bg-rose-50 text-rose-700 text-sm rounded-lg p-3 mb-4 border border-rose-100">
            {err}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-1.5 block">
              Product Name <span className="text-rose-500">*</span>
            </label>
            <input
              placeholder="e.g. KC Ginger"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-base focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
              autoFocus
            />
          </div>

          {/* Single column on phones, two-up from sm: — these fields have
              longer placeholders and labels that got tight side-by-side on
              narrow screens. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-1.5 block">
                Brand
              </label>
              <input
                placeholder="e.g. Chrome"
                value={form.brand}
                onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}
                className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-base focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-1.5 block">
                Category
              </label>
              <input
                placeholder="e.g. Spirit"
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-base focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-1.5 block">
                Volume (ml)
              </label>
              <input
                type="number"
                placeholder="750"
                value={form.volumeMl}
                onChange={e => setForm(f => ({ ...f, volumeMl: e.target.value }))}
                className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-base focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
              />
              <p className="text-xs text-neutral-400 mt-1">Use 1 for per-piece items</p>
            </div>
            <div className="flex items-center sm:items-end sm:pb-1">
              <label className="flex items-center gap-2.5 text-sm text-ink-950 min-h-[36px]">
                <input
                  type="checkbox"
                  checked={form.allowServing}
                  onChange={e => setForm(f => ({ ...f, allowServing: e.target.checked }))}
                  className="w-5 h-5 accent-brand rounded shrink-0"
                />
                Allow servings
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-1.5 block">
                Base Price (KES)
              </label>
              <input
                type="number"
                placeholder="0"
                value={form.price}
                onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-base focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-1.5 block">
                Base Cost (KES)
              </label>
              <input
                type="number"
                placeholder="0"
                value={form.cost}
                onChange={e => setForm(f => ({ ...f, cost: e.target.value }))}
                className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-base focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
              />
            </div>
          </div>
        </div>

        <button
          disabled={busy || !form.name}
          onClick={save}
          className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3.5 rounded-xl text-base mt-6 transition disabled:opacity-50 shadow-card min-h-[48px]"
        >
          {busy ? 'Creating...' : 'Create Product'}
        </button>
        <p className="text-sm text-neutral-400 text-center mt-2">
          You can add Half/Tot serving units and adjust stock after creation.
        </p>
      </div>
    </div>
  );
}
