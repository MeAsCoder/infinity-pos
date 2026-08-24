// POS.jsx - Clean digital receipt without print/download buttons
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, enqueue, saveLocalDebt } from '../db/offlineDb';
import { api, apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { IconPlus, IconTable, IconCash, IconPhone, IconCard, IconCredit, IconCheck, IconAlert, IconArrowLeft, IconClose, IconUser, IconPlus as IconAdd } from '../components/Icons';

function money(n) { return `KES ${Number(n || 0).toLocaleString()}`; }
function timeAgo(iso) {
  if (!iso) return '';
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}
const isLocalTab = (t) => String(t.localId || t.id).startsWith('local-');

export default function POS() {
  const { user, deviceId } = useAuth();
  const { online } = useSync();
  const navigate = useNavigate();
  const location = useLocation();

  const [shift, setShift] = useState(undefined);
  const [view, setView] = useState(location.state?.view || 'new');
  const [addTarget, setAddTarget] = useState(null);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkShiftAndRedirect();
  }, []);

  async function checkShiftAndRedirect() {
    setIsLoading(true);
    
    const cached = await db.currentShift.get(1);
    if (cached?.shift?.status === 'OPEN') {
      setShift(cached.shift);
      setIsLoading(false);
      return;
    }

    if (online) {
      try {
        const fresh = await api.currentShift();
        if (fresh?.status === 'OPEN') {
          setShift(fresh);
          await db.currentShift.put({ id: 1, shift: fresh });
          setIsLoading(false);
          return;
        }
      } catch (e) {
        // Silent fail
      }
    }

    setShift(null);
    setIsLoading(false);
  }

  async function startShift() {
    setError('');
    try {
      const newShift = await api.startShift({
        userId: user.id,
        startingCash: 0,
        deviceId: deviceId
      });
      
      await db.currentShift.put({ id: 1, shift: newShift });
      setShift(newShift);
    } catch (e) {
      setError(e.message || 'Failed to start shift');
    }
  }

  function showToast(msg) { 
    setToast(msg); 
    setTimeout(() => setToast(''), 3000); 
  }

  if (isLoading) {
    return (
      <div className="p-10 text-center text-neutral-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand mx-auto"></div>
        <p className="mt-3">Loading...</p>
      </div>
    );
  }

  if (shift === null) {
    return (
      <div className="p-10 text-center max-w-sm mx-auto mt-10">
        <div className="text-4xl mb-3">🍸</div>
        <p className="text-lg font-medium text-ink-950 mb-1">No shift is running</p>
        <p className="text-sm text-neutral-500 mb-5">Start a shift to begin taking orders.</p>
        {error && <div className="text-rose-600 text-sm mb-3">{error}</div>}
        <button 
          onClick={startShift} 
          className="bg-brand hover:bg-brand-dark text-white px-6 py-3 rounded-xl font-semibold transition"
        >
          Start Shift
        </button>
        {!online && (
          <p className="text-xs text-amber-600 mt-3">You're offline. Shift will sync when connection is restored.</p>
        )}
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <PosTopBar shift={shift} view={view} setView={setView} />
      <div className="flex-1 overflow-hidden">
        {view === 'new' && (
          <OrderBuilder
            mode="new" 
            shift={shift} 
            deviceId={deviceId}
            onDone={(msg) => { 
              showToast(msg); 
              setView('tabs'); 
            }}
          />
        )}
        {view === 'tabs' && (
          <OpenTabsScreen
            shift={shift} 
            deviceId={deviceId} 
            user={user}
            onAddItems={(tab) => { 
              setAddTarget(tab); 
              setView('builder-add'); 
            }}
            onToast={showToast}
          />
        )}
        {view === 'builder-add' && addTarget && (
          <OrderBuilder
            mode="add" 
            shift={shift} 
            deviceId={deviceId} 
            existingTab={addTarget}
            onDone={(msg) => { 
              showToast(msg); 
              setAddTarget(null); 
              setView('tabs'); 
            }}
            onCancel={() => { 
              setAddTarget(null); 
              setView('tabs'); 
            }}
          />
        )}
      </div>
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-ink-950 text-white px-5 py-3 rounded-xl shadow-popover z-50 flex items-center gap-2 text-sm">
          <IconCheck className="w-4 h-4 text-emerald-400" />
          {toast}
        </div>
      )}
    </div>
  );
}

function PosTopBar({ shift, view, setView }) {
  const openCount = useLiveQuery(
    () => db.openTabs.where('shiftId').equals(shift.id).and(t => t.status === 'OPEN').count(), 
    [shift.id], 
    0
  );
  
  return (
    <div className="bg-white border-b border-neutral-200 px-4 sm:px-6 py-3 flex items-center gap-2 shrink-0">
      <TabButton active={view === 'new'} onClick={() => setView('new')} label="New Order" />
      <TabButton active={view === 'tabs' || view === 'builder-add'} onClick={() => setView('tabs')} label="Open Tabs" badge={openCount} />
    </div>
  );
}

function TabButton({ active, onClick, label, badge }) {
  return (
    <button 
      onClick={onClick} 
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
        active ? 'bg-brand text-white' : 'text-neutral-500 hover:bg-neutral-100'
      }`}
    >
      {label}
      {!!badge && (
        <span className={`text-[11px] rounded-full px-1.5 py-0.5 ${
          active ? 'bg-white/20' : 'bg-brand/10 text-brand'
        }`}>
          {badge}
        </span>
      )}
    </button>
  );
}

// ============================================================================
// ORDER BUILDER
// ============================================================================
function OrderBuilder({ mode, shift, deviceId, existingTab, onDone, onCancel }) {
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [tabLabel, setTabLabel] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [pickerProduct, setPickerProduct] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const products = useLiveQuery(() => db.products.toArray(), [], []);

  useEffect(() => { 
    if (navigator.onLine) refreshCatalogue(); 
  }, []);

  async function refreshCatalogue() {
    try {
      const fresh = await api.products('?active=1');
      await db.products.bulkPut(fresh);
    } catch (e) {
      // Silent fail
    }
  }

  const filtered = useMemo(() => {
    if (!products) return [];
    const q = search.trim().toLowerCase();
    if (!q) return products.slice(0, 40);
    return products
      .filter(p => p.name.toLowerCase().includes(q) || (p.brand || '').toLowerCase().includes(q))
      .slice(0, 40);
  }, [products, search]);

  function addToCart(product, unit) {
    setCart(c => {
      const idx = c.findIndex(l => l.sellingUnitId === unit.id);
      if (idx >= 0) {
        const copy = [...c];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        return copy;
      }
      return [...c, {
        productId: product.id,
        productName: product.name,
        sellingUnitId: unit.id,
        unitName: unit.name,
        volumeMl: unit.volumeMl,
        qty: 1,
        price: unit.price
      }];
    });
    setPickerProduct(null);
  }

  function changeQty(id, delta) {
    setCart(c => c.map(l => 
      l.sellingUnitId === id ? { ...l, qty: Math.max(1, l.qty + delta) } : l
    ));
  }

  function removeLine(id) {
    setCart(c => c.filter(l => l.sellingUnitId !== id));
  }

  const subtotal = cart.reduce((s, l) => s + l.price * l.qty, 0);

  async function submit() {
    if (cart.length === 0) {
      setErr('Add at least one item.');
      return;
    }
    setErr('');
    setBusy(true);
    const items = cart.map(l => ({
      productId: l.productId,
      sellingUnitId: l.sellingUnitId,
      quantity: l.qty
    }));

    const label = tabLabel.trim() || customerName.trim() || undefined;

    try {
      if (mode === 'new') {
        const uuid = crypto.randomUUID();
        const payload = {
          uuid,
          shiftId: shift.id,
          deviceId,
          tabLabel: label,
          items,
          clientCreatedAt: new Date().toISOString()
        };
        let sale;
        if (navigator.onLine) {
          sale = await apiFetch('/api/sales/tabs', { method: 'POST', body: payload });
        } else {
          sale = {
            id: `local-${uuid}`,
            shift_id: shift.id,
            tab_label: label,
            subtotal,
            total: subtotal,
            status: 'OPEN',
            receipt_number: 'pending sync',
            server_created_at: new Date().toISOString()
          };
          await enqueue('OPEN_TAB', uuid, payload);
        }
        await db.openTabs.put({ ...sale, localId: String(sale.id), shiftId: shift.id });
        onDone(`Order sent${label ? ' — ' + label : ''}.`);
      } else {
        const uuid = crypto.randomUUID();
        const payload = {
          uuid,
          items,
          deviceId,
          saleId: existingTab.localId
        };
        const useOutbox = !navigator.onLine || isLocalTab(existingTab);
        let updated;
        if (!useOutbox) {
          updated = await apiFetch(`/api/sales/${existingTab.localId}/items`, { method: 'POST', body: payload });
        } else {
          await enqueue('ADD_TAB_ITEMS', uuid, payload);
          updated = {
            ...existingTab,
            subtotal: existingTab.subtotal + subtotal,
            total: existingTab.total + subtotal
          };
        }
        await db.openTabs.put({ ...updated, localId: existingTab.localId, shiftId: shift.id });
        onDone(`Added to ${existingTab.tab_label || existingTab.receipt_number}.`);
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col lg:flex-row h-full">
      <div className="flex-1 p-4 overflow-y-auto">
        {mode === 'add' && (
          <button 
            onClick={onCancel} 
            className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-ink-950 mb-3 font-medium"
          >
            <IconArrowLeft className="w-4 h-4" /> Back to {existingTab.tab_label || existingTab.receipt_number}
          </button>
        )}
        {mode === 'new' && (
          <div className="space-y-2 mb-3">
            <div className="relative">
              <IconUser className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input 
                value={customerName} 
                onChange={e => setCustomerName(e.target.value)} 
                placeholder="Customer name (optional)"
                className="w-full border border-neutral-200 rounded-xl pl-10 pr-4 py-3 text-sm bg-white focus:border-brand focus:ring-1 focus:ring-brand outline-none transition" 
              />
            </div>
            <div className="relative">
              <IconTable className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input 
                value={tabLabel} 
                onChange={e => setTabLabel(e.target.value)} 
                placeholder="Table / seat number (optional)"
                className="w-full border border-neutral-200 rounded-xl pl-10 pr-4 py-3 text-sm bg-white focus:border-brand focus:ring-1 focus:ring-brand outline-none transition" 
              />
            </div>
          </div>
        )}
        <input 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
          autoFocus 
          placeholder="Search product (e.g. Chrome Vodka)…"
          className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-base mb-3 bg-white shadow-soft focus:border-brand focus:ring-1 focus:ring-brand outline-none transition" 
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {filtered.map(p => (
            <button 
              key={p.id} 
              onClick={() => setPickerProduct(p)}
              className="bg-white border border-neutral-200 rounded-xl p-3.5 text-left shadow-soft hover:shadow-card hover:border-brand/30 active:scale-[0.98] transition disabled:opacity-40 disabled:pointer-events-none"
              disabled={p.trackInventory && p.stockMl <= 0}
            >
              <div className="font-semibold text-sm leading-tight text-ink-950">{p.name}</div>
              <div className="text-[11px] text-neutral-400 mt-1">
                {p.trackInventory ? p.stockDisplay : 'not tracked'}
              </div>
              <div className="text-brand font-bold text-sm mt-1.5">
                {p.sellingUnits[0] ? money(p.sellingUnits[0].price) : '—'}
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center text-neutral-400 py-12">
              No products found.
            </div>
          )}
        </div>
      </div>

      <div className="w-full lg:w-96 bg-white border-l border-neutral-200 flex flex-col shrink-0">
        <div className="p-4 border-b border-neutral-100 font-semibold text-ink-950 flex justify-between items-center">
          <span>{mode === 'new' ? 'New Order' : 'Add Items'}</span>
          <span className="text-xs text-neutral-400 font-normal">
            {cart.reduce((s, l) => s + l.qty, 0)} item(s)
          </span>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-neutral-100">
          {cart.length === 0 && (
            <div className="p-8 text-center text-neutral-400 text-sm">
              Tap a product to add it
            </div>
          )}
          {cart.map(l => (
            <div key={l.sellingUnitId} className="p-3.5 flex justify-between items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate text-ink-950">{l.productName}</div>
                <div className="text-xs text-neutral-400">{l.unitName} · {money(l.price)} each</div>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => changeQty(l.sellingUnitId, -1)} 
                  className="w-7 h-7 bg-neutral-100 hover:bg-neutral-200 rounded-full font-bold transition"
                >
                  -
                </button>
                <span className="w-6 text-center text-sm font-medium">{l.qty}</span>
                <button 
                  onClick={() => changeQty(l.sellingUnitId, 1)} 
                  className="w-7 h-7 bg-neutral-100 hover:bg-neutral-200 rounded-full font-bold transition"
                >
                  +
                </button>
              </div>
              <div className="w-16 text-right text-sm font-semibold">{money(l.price * l.qty)}</div>
              <button 
                onClick={() => removeLine(l.sellingUnitId)} 
                className="text-neutral-300 hover:text-rose-500 transition"
              >
                <IconClose className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-neutral-100">
          {err && (
            <div className="bg-rose-50 text-rose-700 text-sm rounded-lg p-2.5 mb-3 border border-rose-100">
              {err}
            </div>
          )}
          <div className="flex justify-between text-lg font-bold mb-3 text-ink-950">
            <span>Total</span>
            <span>{money(subtotal)}</span>
          </div>
          <button 
            disabled={cart.length === 0 || busy} 
            onClick={submit}
            className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3.5 rounded-xl disabled:opacity-40 transition shadow-soft"
          >
            {busy ? 'Sending…' : mode === 'new' ? 'Send Order' : 'Add to Tab'}
          </button>
          {!navigator.onLine && (
            <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg p-2 mt-2 text-center">
              Offline — this will sync automatically.
            </p>
          )}
        </div>
      </div>

      {pickerProduct && (
        <UnitPicker 
          product={pickerProduct} 
          onPick={(u) => addToCart(pickerProduct, u)} 
          onClose={() => setPickerProduct(null)} 
        />
      )}
    </div>
  );
}

// ============================================================================
// UNIT PICKER
// ============================================================================
function UnitPicker({ product, onPick, onClose }) {
  const volume = product.volumeMl || 0;
  const stockMl = product.stockMl || 0;

  const getStockDisplay = () => {
    if (!product.trackInventory) return 'Not stock-tracked';
    if (stockMl <= 0) return 'Out of stock';
    
    if (volume === 250) {
      const bottles = Math.floor(stockMl / 250);
      const remainder = stockMl % 250;
      if (remainder === 125) {
        return `${bottles} bottle${bottles !== 1 ? 's' : ''} + ½ bottle`;
      }
      return `${bottles} bottle${bottles !== 1 ? 's' : ''}`;
    }
    
    if (volume === 750) {
      const bottles = Math.floor(stockMl / 750);
      const remainder = stockMl % 750;
      if (remainder > 0) {
        const tots = Math.floor(remainder / 30);
        return `${bottles} bottle${bottles !== 1 ? 's' : ''} + ${tots} tot${tots !== 1 ? 's' : ''}`;
      }
      return `${bottles} bottle${bottles !== 1 ? 's' : ''}`;
    }
    
    return product.stockDisplay || `${stockMl}ml`;
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-40" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:w-96 p-5" onClick={e => e.stopPropagation()}>
        <div className="font-display font-semibold text-lg mb-1 text-ink-950">{product.name}</div>
        <div className="text-xs text-neutral-400 mb-4">
          {getStockDisplay()}
        </div>
        <div className="space-y-2">
          {product.sellingUnits
            .filter(u => u.active)
            .filter(unit => {
              if (volume === 250) {
                return unit.name === 'Bottle' || unit.name === 'Half';
              } else if (volume === 750) {
                return unit.name === 'Bottle' || unit.name === 'Tot';
              }
              return true;
            })
            .map(u => {
              let isAvailable = true;
              if (product.trackInventory) {
                if (stockMl < u.volumeMl) {
                  isAvailable = false;
                }
              }
              
              return (
                <button 
                  key={u.id} 
                  onClick={() => isAvailable && onPick(u)}
                  className={`w-full flex justify-between items-center border rounded-xl px-4 py-3.5 transition ${
                    isAvailable 
                      ? 'border-neutral-200 hover:border-brand hover:bg-brand-50' 
                      : 'border-neutral-200 bg-neutral-50 opacity-50 cursor-not-allowed'
                  }`}
                  disabled={!isAvailable}
                >
                  <span className="font-medium text-ink-950">
                    {u.name} <span className="text-neutral-400 text-xs">({u.volumeMl}ml)</span>
                    {!isAvailable && (
                      <span className="text-xs text-rose-500 ml-2">(out of stock)</span>
                    )}
                  </span>
                  <span className="font-bold text-brand">{money(u.price)}</span>
                </button>
              );
            })}
          
          {product.sellingUnits
            .filter(u => u.active)
            .filter(unit => {
              if (volume === 250) {
                return unit.name === 'Bottle' || unit.name === 'Half';
              } else if (volume === 750) {
                return unit.name === 'Bottle' || unit.name === 'Tot';
              }
              return true;
            })
            .every(u => product.trackInventory && stockMl < u.volumeMl) && (
            <div className="text-center py-6 text-neutral-400 text-sm">
              {stockMl <= 0 ? 'This product is out of stock' : 'No available units for sale'}
            </div>
          )}
        </div>
        <button onClick={onClose} className="w-full mt-4 text-neutral-500 py-2 font-medium">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// OPEN TABS
// ============================================================================
function OpenTabsScreen({ shift, deviceId, user, onAddItems, onToast }) {
  const tabs = useLiveQuery(
    () => db.openTabs.where('shiftId').equals(shift.id).and(t => t.status === 'OPEN').toArray(), 
    [shift.id], 
    []
  );
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { 
    refresh(); 
  }, [shift.id]);

  async function refresh() {
    setLoading(true);
    try {
      if (navigator.onLine) {
        const serverTabs = await api.openTabs(shift.id);
        const existing = await db.openTabs.where('shiftId').equals(shift.id).toArray();
        const stillPending = existing.filter(t => isLocalTab(t));
        await db.openTabs.where('shiftId').equals(shift.id).delete();
        await db.openTabs.bulkPut([
          ...serverTabs.map(t => ({ ...t, localId: String(t.id), shiftId: shift.id })),
          ...stillPending
        ]);
      }
    } catch (e) {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }

  if (loading && (!tabs || tabs.length === 0)) {
    return <div className="p-10 text-center text-neutral-400">Loading tabs…</div>;
  }

  if (!tabs || tabs.length === 0) {
    return (
      <div className="p-10 text-center max-w-sm mx-auto mt-10">
        <div className="text-4xl mb-3">🧾</div>
        <p className="text-neutral-500">No open tabs right now.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 overflow-y-auto h-full">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {tabs
          .sort((a, b) => new Date(b.server_created_at || 0) - new Date(a.server_created_at || 0))
          .map(tab => (
            <button 
              key={tab.localId} 
              onClick={() => setDetail(tab)}
              className="text-left bg-white border border-neutral-200 rounded-2xl p-4 shadow-soft hover:shadow-card hover:border-brand/30 transition"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-display font-semibold text-ink-950">
                    {tab.tab_label || `Order ${tab.receipt_number}`}
                  </div>
                  {tab.tab_label && (
                    <div className="text-[10px] text-neutral-400 mt-0.5">
                      📋 {tab.tab_label}
                    </div>
                  )}
                </div>
                {isLocalTab(tab) && (
                  <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                    syncing
                  </span>
                )}
              </div>
              <div className="text-xs text-neutral-400 mb-3">
                {timeAgo(tab.server_created_at)}
              </div>
              <div className="flex justify-between items-end">
                <span className="text-xs text-neutral-400">
                  {tab.items?.length ?? '—'} item(s)
                </span>
                <span className="text-lg font-bold text-brand">{money(tab.total)}</span>
              </div>
            </button>
          ))}
      </div>

      {detail && (
        <TabDetail
          tab={detail} 
          shift={shift} 
          user={user}
          onClose={() => setDetail(null)}
          onAddItems={(t) => { 
            setDetail(null); 
            onAddItems(t); 
          }}
          onSettled={(msg) => { 
            setDetail(null); 
            onToast(msg); 
            refresh(); 
          }}
          onVoided={(msg) => { 
            setDetail(null); 
            onToast(msg); 
            refresh(); 
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// TAB DETAIL - COMPACT DIGITAL RECEIPT STYLE WITH UNIT TYPES
// ============================================================================
function TabDetail({ tab, shift, user, onClose, onAddItems, onSettled, onVoided }) {
  const [full, setFull] = useState(tab);
  const [showSettle, setShowSettle] = useState(false);
  const [showVoid, setShowVoid] = useState(false);
  
  const products = useLiveQuery(() => db.products.toArray(), [], []);

  useEffect(() => {
    setFull(tab);
  }, [tab]);

  const getProductDisplayName = (item) => {
    if (item.product_name) return item.product_name;
    if (item.product_id && products) {
      const product = products.find(p => p.id === item.product_id);
      if (product) return product.name;
    }
    return item.unit_name || `Product #${item.product_id}`;
  };

  const getUnitLabel = (unitName, volumeMl) => {
    if (unitName === 'Bottle') return 'BTL';
    if (unitName === 'Half') return '½';
    if (unitName === 'Tot') return 'TOT';
    return unitName || 'UNIT';
  };

  const enrichedItems = useMemo(() => {
    return (full.items || []).map(item => ({
      ...item,
      displayName: getProductDisplayName(item),
      unitLabel: getUnitLabel(item.unit_name, item.volume_ml)
    }));
  }, [full.items, products]);

  const totalQty = enrichedItems.reduce((sum, item) => sum + item.quantity, 0);
  const receiptNumber = full.receipt_number || `ORD-${String(full.id || full.localId || '').padStart(5, '0')}`;
  const orderDate = full.server_created_at ? new Date(full.server_created_at) : new Date();
  const customerName = full.tab_label || 'Walk-in';

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-end z-40" onClick={onClose}>
      <div className="bg-white w-full sm:w-[380px] h-full overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-3 border-b border-neutral-100 flex justify-between items-start">
          <div>
            <h2 className="font-semibold text-sm text-ink-950">🧾 Receipt</h2>
            <div className="flex flex-wrap items-center gap-1 text-[10px] text-neutral-400 mt-0.5">
              <span>#{receiptNumber}</span>
              <span>•</span>
              <span>{orderDate.toLocaleTimeString()}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 p-0.5">
            <IconClose className="w-4 h-4" />
          </button>
        </div>

        {/* Receipt Body - Compact */}
        <div className="flex-1 overflow-y-auto p-3 bg-neutral-50">
          {/* Receipt Header - Compact */}
          <div className="text-center border-b border-dashed border-neutral-300 pb-2 mb-2">
            <h3 className="font-bold text-xs text-ink-950">INFINITY LIQUORS</h3>
            <div className="text-[9px] text-neutral-500">
              <span>{orderDate.toLocaleDateString()}</span>
              <span className="mx-1">•</span>
              <span>{orderDate.toLocaleTimeString()}</span>
            </div>
            <div className="text-[10px] font-medium text-ink-950 mt-0.5">
              {customerName}
            </div>
          </div>

          {/* Items - Compact */}
          <div className="mb-2">
            <div className="grid grid-cols-12 text-[9px] font-semibold text-neutral-500 border-b border-neutral-200 pb-0.5 mb-0.5">
              <span className="col-span-5">Item</span>
              <span className="col-span-2 text-center">Qty</span>
              <span className="col-span-2 text-right">Price</span>
              <span className="col-span-3 text-right">Total</span>
            </div>
            {enrichedItems.map((it, idx) => (
              <div key={it.id || idx} className="grid grid-cols-12 text-[10px] py-0.5 border-b border-neutral-100">
                <div className="col-span-5">
                  <div className="text-ink-950 truncate pr-1 text-[10px]">{it.displayName || it.unit_name}</div>
                  <div className="text-[8px] text-neutral-400">
                    {it.unitLabel} · {it.volume_ml}ml
                  </div>
                </div>
                <span className="col-span-2 text-center text-neutral-600 text-[10px]">{it.quantity}</span>
                <span className="col-span-2 text-right text-neutral-600 text-[10px]">{money(it.unit_price)}</span>
                <span className="col-span-3 text-right font-medium text-ink-950 text-[10px]">{money(it.line_total)}</span>
              </div>
            ))}
          </div>

          {/* Totals - Compact */}
          <div className="border-t border-dashed border-neutral-300 pt-1.5 space-y-0.5 text-[10px]">
            <div className="flex justify-between">
              <span className="text-neutral-500">Items</span>
              <span className="font-medium text-ink-950">{totalQty}</span>
            </div>
            {full.discount_total > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>Discount</span>
                <span>-{money(full.discount_total)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold pt-0.5 border-t border-neutral-200">
              <span className="text-ink-950">Total</span>
              <span className="text-ink-950">{money(full.total)}</span>
            </div>
          </div>

          {/* Footer - Compact */}
          <div className="text-center border-t border-dashed border-neutral-300 mt-2 pt-2">
            <p className="text-[8px] text-neutral-400">Thank you!</p>
            <p className="text-[7px] text-neutral-300 mt-0.5">Please present to settle</p>
          </div>
        </div>

        {/* Actions */}
        <div className="p-2.5 border-t border-neutral-100 space-y-1.5 bg-white">
          <button 
            onClick={() => onAddItems(full)} 
            className="w-full flex items-center justify-center gap-1.5 border border-brand text-brand font-semibold py-1.5 rounded-lg hover:bg-brand-50 transition text-xs"
          >
            <IconPlus className="w-3.5 h-3.5" /> Add Items
          </button>
          <button 
            onClick={() => setShowSettle(true)} 
            className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-1.5 rounded-lg transition shadow-soft text-xs"
          >
            Settle Bill
          </button>
          {(user.permissions.includes('sales.refund') || user.permissions.includes('*')) && (
            <button 
              onClick={() => setShowVoid(true)} 
              className="w-full text-rose-500 text-[10px] font-medium py-1"
            >
              Void this tab
            </button>
          )}
        </div>
      </div>

      {showSettle && (
        <SettleModal
          tab={full} 
          shift={shift} 
          user={user}
          maxDiscountPercent={user.maxDiscountPercent}
          onClose={() => setShowSettle(false)}
          onDone={onSettled}
        />
      )}
      {showVoid && (
        <VoidModal 
          tab={full} 
          onClose={() => setShowVoid(false)} 
          onDone={onVoided} 
        />
      )}
    </div>
  );
}

function VoidModal({ tab, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function confirmVoid() {
    if (!reason.trim()) {
      setErr('A reason is required.');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      await api.voidTab(tab.localId, { reason: reason.trim() });
      onDone(`Voided ${tab.tab_label || tab.receipt_number}.`);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 text-rose-600 mb-2">
          <IconAlert className="w-5 h-5" />
          <h3 className="font-semibold">Void tab</h3>
        </div>
        <p className="text-sm text-neutral-500 mb-3">
          This reverses all items back into stock and permanently records who voided it and why.
        </p>
        {err && (
          <div className="bg-rose-50 text-rose-700 text-sm rounded-lg p-2.5 mb-3">
            {err}
          </div>
        )}
        <textarea 
          value={reason} 
          onChange={e => setReason(e.target.value)} 
          placeholder="Reason (required)" 
          className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm mb-3" 
          rows={2} 
        />
        <div className="flex gap-2">
          <button 
            onClick={onClose} 
            className="flex-1 border border-neutral-200 rounded-xl py-2.5 text-neutral-600 font-medium"
          >
            Cancel
          </button>
          <button 
            disabled={busy} 
            onClick={confirmVoid} 
            className="flex-1 bg-rose-600 hover:bg-rose-700 text-white rounded-xl py-2.5 font-semibold transition disabled:opacity-50"
          >
            {busy ? 'Voiding…' : 'Void Tab'}
          </button>
        </div>
      </div>
    </div>
  );
}

const PAY_METHODS = [
  { v: 'CASH', label: 'Cash', icon: IconCash },
  { v: 'MOBILE', label: 'M-Pesa / Mobile', icon: IconPhone },
  { v: 'CARD', label: 'Card / PDQ', icon: IconCard },
  { v: 'OTHER', label: 'Other', icon: IconCash },
];

// ============================================================================
// SETTLE MODAL
// ============================================================================
function SettleModal({ tab, shift, user, maxDiscountPercent, onClose, onDone }) {
  const [methods, setMethods] = useState([{ method: 'CASH', amount: tab.total, reference: '' }]);
  const [discount, setDiscount] = useState(0);
  const [discountReason, setDiscountReason] = useState('');
  const [customerId, setCustomerId] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', notes: '' });
  const customers = useLiveQuery(() => db.customers.toArray(), [], []);

  useEffect(() => { 
    if (navigator.onLine) {
      api.customers()
        .then(c => db.customers.bulkPut(c))
        .catch(() => {}); 
    }
  }, []);

  const total = tab.total - discount;
  const paid = methods.reduce((s, m) => s + (Number(m.amount) || 0), 0);
  const remaining = total - paid;

  function updateMethod(i, patch) { 
    setMethods(ms => ms.map((m, idx) => idx === i ? { ...m, ...patch } : m)); 
  }
  
  function addMethod(v) { 
    setMethods(ms => [...ms, { method: v, amount: Math.max(remaining, 0), reference: '' }]); 
  }
  
  function removeMethod(i) { 
    setMethods(ms => ms.filter((_, idx) => idx !== i)); 
  }

  async function createNewCustomer() {
    if (!newCustomer.name.trim()) {
      setErr('Customer name is required');
      return;
    }

    setBusy(true);
    try {
      const created = await apiFetch('/api/customers', {
        method: 'POST',
        body: {
          name: newCustomer.name.trim(),
          phone: newCustomer.phone.trim() || undefined,
          notes: newCustomer.notes.trim() || undefined
        }
      });

      await db.customers.put(created);
      
      setCustomerId(created.id);
      setCustomerName(created.name);
      setCustomerPhone(created.phone || '');
      setShowNewCustomer(false);
      setNewCustomer({ name: '', phone: '', notes: '' });
      setErr('');
      
      if (navigator.onLine) {
        const fresh = await api.customers();
        await db.customers.bulkPut(fresh);
      }
    } catch (e) {
      setErr(e.message || 'Failed to create customer');
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setErr('');
    if (remaining > 0 && !customerId) { 
      setErr(`KES ${remaining.toLocaleString()} is unpaid — select a customer to put the balance on their credit account.`); 
      return; 
    }
    if (remaining < 0) { 
      setErr(`Payments exceed the total by KES ${(-remaining).toLocaleString()}. Reduce a payment amount.`); 
      return; 
    }
    const discountPct = tab.subtotal > 0 ? (discount / tab.subtotal) * 100 : 0;
    if (discount > 0 && discountPct > maxDiscountPercent + 0.01) {
      setErr(`Discount ${discountPct.toFixed(1)}% exceeds your limit of ${maxDiscountPercent}%. Ask a manager.`);
      return;
    }
    setBusy(true);
    const payload = {
      payments: methods.filter(m => m.amount > 0).map(m => ({ 
        method: m.method, 
        amount: Number(m.amount), 
        reference: m.reference || undefined 
      })),
      customerId: customerId || undefined,
      discountTotal: discount || undefined,
      discountReason: discount > 0 ? discountReason : undefined,
    };
    try {
      const useOutbox = !navigator.onLine || isLocalTab(tab);
      
      if (!useOutbox) {
        const result = await apiFetch(`/api/sales/${tab.localId}/settle`, { method: 'POST', body: payload });
        console.log('Settle result:', result);
      } else {
        await enqueue('SETTLE_TAB', crypto.randomUUID(), { ...payload, saleId: tab.localId });
      }
      
      if (remaining > 0 && customerId) {
        const debtData = {
          sale_id: parseInt(tab.localId) || tab.localId,
          customer_id: customerId,
          waiter_id: user.id,
          shift_id: shift?.id || tab.shift_id,
          amount: remaining,
          customer_name: customerName,
          customer_phone: customerPhone || '',
          notes: `Partial payment settlement - remaining balance on credit. Receipt: ${tab.receipt_number}`,
          status: 'PENDING'
        };
        
        try {
          await saveLocalDebt(debtData);
        } catch (e) {
          console.warn('Could not cache debt locally:', e);
        }
      }
      
      if (tab.localId) {
        const updatedTab = { ...tab, status: 'COMPLETED', settled_at: new Date().toISOString() };
        await db.openTabs.put({ ...updatedTab, localId: tab.localId, shiftId: shift.id });
      }
      
      onDone(`Settled ${tab.tab_label || tab.receipt_number} — ${money(total)}${remaining > 0 ? ` (${money(remaining)} on credit)` : ''}.`);
      
    } catch (e) {
      console.error('Settlement error:', e);
      setErr(e.message || 'Failed to settle tab');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:w-[440px] max-h-[92vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
        <div className="font-display text-xl font-semibold text-ink-950 mb-1">Settle Bill</div>
        <div className="text-sm text-neutral-400 mb-4">{tab.tab_label || tab.receipt_number}</div>

        <div className="flex justify-between text-sm mb-1 text-neutral-600">
          <span>Subtotal</span>
          <span>{money(tab.subtotal)}</span>
        </div>
        <div className="flex justify-between items-center text-sm mb-1 text-neutral-600">
          <span>Discount</span>
          <input 
            type="number" 
            min="0" 
            value={discount} 
            onChange={e => setDiscount(Number(e.target.value) || 0)} 
            className="w-24 border border-neutral-200 rounded-lg px-2 py-1 text-right" 
          />
        </div>
        {discount > 0 && (
          <input 
            placeholder="Discount reason" 
            value={discountReason} 
            onChange={e => setDiscountReason(e.target.value)} 
            className="w-full border border-neutral-200 rounded-lg px-2 py-1 text-xs mb-2" 
          />
        )}
        <div className="flex justify-between font-bold text-xl mb-4 border-t border-neutral-200 pt-2.5 text-ink-950">
          <span>Total Due</span>
          <span>{money(total)}</span>
        </div>

        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-2">Payment received</div>
        <div className="space-y-2 mb-2">
          {methods.map((m, i) => (
            <div key={i} className="flex gap-2 items-center">
              <select 
                value={m.method} 
                onChange={e => updateMethod(i, { method: e.target.value })} 
                className="border border-neutral-200 rounded-lg px-2 py-2.5 text-sm"
              >
                {PAY_METHODS.map(pm => <option key={pm.v} value={pm.v}>{pm.label}</option>)}
              </select>
              <input 
                type="number" 
                value={m.amount} 
                onChange={e => updateMethod(i, { amount: e.target.value })} 
                className="flex-1 border border-neutral-200 rounded-lg px-2 py-2.5 text-right" 
              />
              {(m.method === 'MOBILE' || m.method === 'CARD') && (
                <input 
                  placeholder="Ref" 
                  value={m.reference} 
                  onChange={e => updateMethod(i, { reference: e.target.value })} 
                  className="w-20 border border-neutral-200 rounded-lg px-2 py-2.5 text-xs" 
                />
              )}
              {methods.length > 1 && (
                <button onClick={() => removeMethod(i)} className="text-neutral-300 hover:text-rose-500">
                  <IconClose className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          <button onClick={() => addMethod('MOBILE')} className="text-brand text-sm font-semibold">
            + Split payment
          </button>
        </div>

        <div className={`flex justify-between text-sm font-medium rounded-lg px-3 py-2 mb-3 ${
          remaining > 0 ? 'bg-amber-50 text-amber-700' : 
          remaining < 0 ? 'bg-rose-50 text-rose-700' : 
          'bg-emerald-50 text-emerald-700'
        }`}>
          <span>{remaining > 0 ? 'Remaining (unpaid)' : remaining < 0 ? 'Overpaid' : 'Fully paid'}</span>
          <span>{money(Math.abs(remaining))}</span>
        </div>

        {remaining > 0 && (
          <div className="mb-3 border border-amber-200 bg-amber-50/50 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-amber-800 text-xs font-semibold">
                <IconCredit className="w-3.5 h-3.5" /> Put remaining balance on credit
              </div>
              {!customerId && (
                <button
                  onClick={() => setShowNewCustomer(true)}
                  className="text-xs bg-amber-600 hover:bg-amber-700 text-white px-2 py-1 rounded-lg transition flex items-center gap-1"
                >
                  <IconAdd className="w-3 h-3" /> New Customer
                </button>
              )}
            </div>
            
            {customerId ? (
              <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 text-sm">
                <span className="font-medium text-ink-950">{customerName}</span>
                <button onClick={() => { setCustomerId(null); setCustomerName(''); setCustomerPhone(''); }} className="text-xs text-neutral-400 hover:text-neutral-600">
                  change
                </button>
              </div>
            ) : showNewCustomer ? (
              <div className="bg-white rounded-lg p-3 space-y-2">
                <input
                  placeholder="Customer name *"
                  value={newCustomer.name}
                  onChange={e => setNewCustomer(c => ({ ...c, name: e.target.value }))}
                  className="w-full border border-neutral-200 rounded-lg px-2.5 py-2 text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
                  autoFocus
                />
                <input
                  placeholder="Phone number"
                  value={newCustomer.phone}
                  onChange={e => setNewCustomer(c => ({ ...c, phone: e.target.value }))}
                  className="w-full border border-neutral-200 rounded-lg px-2.5 py-2 text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
                />
                <input
                  placeholder="Notes (optional)"
                  value={newCustomer.notes}
                  onChange={e => setNewCustomer(c => ({ ...c, notes: e.target.value }))}
                  className="w-full border border-neutral-200 rounded-lg px-2.5 py-2 text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowNewCustomer(false)}
                    className="flex-1 border border-neutral-200 rounded-lg py-1.5 text-sm text-neutral-600 hover:bg-neutral-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createNewCustomer}
                    disabled={busy || !newCustomer.name.trim()}
                    className="flex-1 bg-brand hover:bg-brand-dark text-white rounded-lg py-1.5 text-sm font-medium transition disabled:opacity-50"
                  >
                    {busy ? 'Creating...' : 'Create & Select'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <input 
                  placeholder="Search customer by name/phone…" 
                  value={customerSearch} 
                  onChange={e => setCustomerSearch(e.target.value)} 
                  className="w-full border border-neutral-200 rounded-lg px-2.5 py-2 text-sm mb-1.5 focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
                />
                <div className="max-h-32 overflow-y-auto border border-neutral-200 rounded-lg bg-white">
                  {(customers || [])
                    .filter(c => c.name?.toLowerCase().includes(customerSearch.toLowerCase()) || 
                           (c.phone && c.phone.includes(customerSearch)))
                    .slice(0, 20)
                    .map(c => (
                      <button 
                        key={c.id} 
                        onClick={() => { 
                          setCustomerId(c.id); 
                          setCustomerName(c.name); 
                          setCustomerPhone(c.phone || '');
                          setCustomerSearch(''); 
                        }} 
                        className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 flex justify-between"
                      >
                        <span>{c.name}</span>
                        <span className="text-neutral-400 text-xs">
                          {c.phone || 'no phone'} · owes {money(c.balance || 0)}
                        </span>
                      </button>
                    ))}
                  {(!customers || customers.length === 0) && (
                    <div className="p-3 text-xs text-neutral-400">
                      No customers found. Click "New Customer" to add one.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {err && (
          <div className="bg-rose-50 text-rose-700 text-sm rounded-lg p-2.5 mb-3 border border-rose-100">
            {err}
          </div>
        )}
        {!navigator.onLine && (
          <div className="bg-amber-50 text-amber-800 text-xs rounded-lg p-2.5 mb-3">
            Offline — this settlement will be saved locally and synced automatically.
          </div>
        )}

        <div className="flex gap-2">
          <button 
            onClick={onClose} 
            className="flex-1 border border-neutral-200 rounded-xl py-3 text-neutral-600 font-medium"
          >
            Cancel
          </button>
          <button 
            disabled={busy} 
            onClick={submit} 
            className="flex-1 bg-brand hover:bg-brand-dark text-white font-semibold rounded-xl py-3 transition disabled:opacity-50"
          >
            {busy ? 'Processing…' : 'Confirm Settlement'}
          </button>
        </div>
      </div>
    </div>
  );
}