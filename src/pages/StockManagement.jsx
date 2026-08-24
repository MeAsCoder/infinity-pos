import React, { useEffect, useState, useMemo } from 'react';
import { api, apiFetch, OfflineError } from '../api/client';
import { enqueue } from '../db/offlineDb';
import { useAuth } from '../context/AuthContext';
import { IconPlus, IconClose, IconSearch } from '../components/Icons';

function money(n) { return `KES ${Number(n || 0).toLocaleString()}`; }

export default function StockManagement() {
  const [tab, setTab] = useState('receive');
  
  return (
    <div className="p-3 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">Stock Management</h1>
          <p className="text-xs text-gray-400">Receive, adjust, and monitor inventory</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-white rounded-lg border border-gray-200 p-0.5 overflow-x-auto">
        {[
          { id: 'receive', label: 'Receive Stock' },
          { id: 'adjust', label: 'Adjustments' },
          { id: 'lowstock', label: 'Low Stock' }
        ].map(t => (
          <button 
            key={t.id} 
            onClick={() => setTab(t.id)} 
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
              tab === t.id ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {tab === 'receive' && <ReceiveStock />}
        {tab === 'adjust' && <AdjustStock />}
        {tab === 'lowstock' && <LowStock />}
      </div>
    </div>
  );
}

// ============================================================================
// PRODUCT SEARCH HOOK
// ============================================================================
function useProductSearch() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q) { setResults([]); setLoading(false); return; }
      setLoading(true);
      try {
        const data = await api.products(`?search=${encodeURIComponent(q)}&active=1`);
        setResults(data || []);
      } catch (e) {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);
  
  return { q, setQ, results, loading };
}

// ============================================================================
// RECEIVE STOCK
// ============================================================================
function ReceiveStock() {
  const { q, setQ, results, loading } = useProductSearch();
  const [product, setProduct] = useState(null);
  const [form, setForm] = useState({ quantityUnits: '', totalCost: '', invoiceRef: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function submit() {
    if (!product) { setErr('Please select a product'); return; }
    if (!form.quantityUnits || Number(form.quantityUnits) <= 0) { setErr('Please enter a valid quantity'); return; }
    
    setBusy(true); setMsg(''); setErr('');
    const clientUuid = crypto.randomUUID();
    const payload = { 
      productId: product.id, 
      quantityUnits: Number(form.quantityUnits), 
      totalCost: Number(form.totalCost) || 0, 
      invoiceRef: form.invoiceRef || null, 
      notes: form.notes || null, 
      clientUuid 
    };
    
    try {
      if (navigator.onLine) {
        await apiFetch('/api/inventory/receive', { method: 'POST', body: payload });
        setMsg('✓ Stock received successfully.');
      } else {
        await enqueue('STOCK_RECEIPT', clientUuid, payload);
        setMsg('✓ Saved offline — will sync automatically.');
      }
      setProduct(null);
      setForm({ quantityUnits: '', totalCost: '', invoiceRef: '', notes: '' });
      setQ('');
    } catch (e) {
      if (e instanceof OfflineError) {
        await enqueue('STOCK_RECEIPT', clientUuid, payload);
        setMsg('✓ Saved offline — will sync automatically.');
      } else {
        setErr(e.message || 'Failed to receive stock');
      }
    } finally { 
      setBusy(false); 
    }
  }

  if (product) {
    return (
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <p className="text-sm font-medium text-gray-800">{product.name}</p>
            <p className="text-xs text-gray-400">
              {product.volumeMl}ml · Current stock: {product.stockDisplay || 0} units
            </p>
          </div>
          <button 
            onClick={() => { setProduct(null); setQ(''); }} 
            className="text-xs text-gray-400 hover:text-gray-600 transition"
          >
            ← Change product
          </button>
        </div>

        {err && <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 mb-3 text-xs text-gray-700">{err}</div>}
        {msg && <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 mb-3 text-xs text-gray-700">{msg}</div>}

        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-gray-400 block mb-0.5">Quantity (units)</label>
              <input 
                type="number" 
                placeholder="0" 
                value={form.quantityUnits} 
                onChange={e => setForm(f => ({ ...f, quantityUnits: e.target.value }))} 
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-gray-400 focus:ring-1 focus:ring-gray-400 outline-none transition"
                autoFocus
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 block mb-0.5">Total Cost (KES)</label>
              <input 
                type="number" 
                placeholder="0" 
                value={form.totalCost} 
                onChange={e => setForm(f => ({ ...f, totalCost: e.target.value }))} 
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-gray-400 focus:ring-1 focus:ring-gray-400 outline-none transition"
              />
            </div>
          </div>
          
          <div>
            <label className="text-[10px] text-gray-400 block mb-0.5">Invoice / Reference</label>
            <input 
              placeholder="e.g. INV-001" 
              value={form.invoiceRef} 
              onChange={e => setForm(f => ({ ...f, invoiceRef: e.target.value }))} 
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-gray-400 focus:ring-1 focus:ring-gray-400 outline-none transition"
            />
          </div>
          
          <div>
            <label className="text-[10px] text-gray-400 block mb-0.5">Notes</label>
            <textarea 
              placeholder="Optional notes..." 
              value={form.notes} 
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} 
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-gray-400 focus:ring-1 focus:ring-gray-400 outline-none transition"
              rows={2}
            />
          </div>
          
          <button 
            disabled={busy} 
            onClick={submit} 
            className="w-full bg-gray-800 hover:bg-gray-700 text-white font-medium py-2.5 rounded-lg text-sm transition disabled:opacity-50"
          >
            {busy ? 'Processing...' : 'Receive Stock'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="relative">
        <span className="text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 text-xs">🔍</span>
        <input 
          value={q} 
          onChange={e => setQ(e.target.value)} 
          placeholder="Search product to receive stock..." 
          className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:border-gray-400 focus:ring-1 focus:ring-gray-400 outline-none transition"
          autoFocus
        />
      </div>
      
      {loading && (
        <div className="py-6 text-center text-gray-400 text-xs">
          <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-gray-600 mr-2"></span>
          Searching...
        </div>
      )}
      
      {!loading && q && results.length === 0 && (
        <div className="py-6 text-center text-gray-400 text-xs">
          No products found matching "{q}"
        </div>
      )}
      
      {results.length > 0 && (
        <div className="mt-2 border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-60 overflow-y-auto">
          {results.map(p => (
            <button 
              key={p.id} 
              onClick={() => setProduct(p)} 
              className="w-full text-left px-3 py-2 hover:bg-gray-50 transition flex justify-between items-center"
            >
              <div>
                <div className="text-sm font-medium text-gray-800">{p.name}</div>
                <div className="text-xs text-gray-400">{p.volumeMl}ml · {p.category || 'Uncategorized'}</div>
              </div>
              <div className="text-xs text-gray-500">
                {p.stockDisplay || 0} units
              </div>
            </button>
          ))}
        </div>
      )}
      
      {!q && !loading && (
        <div className="py-8 text-center text-gray-400 text-xs">
          Search for a product to receive stock
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ADJUST STOCK
// ============================================================================
function AdjustStock() {
  const { q, setQ, results, loading } = useProductSearch();
  const [product, setProduct] = useState(null);
  const [form, setForm] = useState({ changeMl: '', reason: 'DAMAGE', notes: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const reasons = [
    { value: 'DAMAGE', label: 'Damage / Broken' },
    { value: 'EXPIRED', label: 'Expired' },
    { value: 'MISSING', label: 'Missing' },
    { value: 'COMPLIMENTARY', label: 'Complimentary' },
    { value: 'OTHER', label: 'Other' }
  ];

  async function submit() {
    if (!product) { setErr('Please select a product'); return; }
    if (!form.changeMl || Number(form.changeMl) === 0) { setErr('Please enter a valid change amount'); return; }
    if (!form.notes) { setErr('Notes are required for adjustments'); return; }
    
    setBusy(true); setMsg(''); setErr('');
    const clientUuid = crypto.randomUUID();
    const payload = { 
      productId: product.id, 
      changeMl: Number(form.changeMl), 
      reason: form.reason, 
      notes: form.notes, 
      clientUuid 
    };
    
    try {
      if (navigator.onLine) {
        await apiFetch('/api/inventory/adjust', { method: 'POST', body: payload });
        setMsg('✓ Adjustment recorded successfully.');
      } else {
        await enqueue('STOCK_ADJUSTMENT', clientUuid, payload);
        setMsg('✓ Saved offline — will sync automatically.');
      }
      setProduct(null);
      setForm({ changeMl: '', reason: 'DAMAGE', notes: '' });
      setQ('');
    } catch (e) {
      if (e instanceof OfflineError) {
        await enqueue('STOCK_ADJUSTMENT', clientUuid, payload);
        setMsg('✓ Saved offline — will sync automatically.');
      } else {
        setErr(e.message || 'Failed to record adjustment');
      }
    } finally { 
      setBusy(false); 
    }
  }

  if (product) {
    const change = Number(form.changeMl) || 0;
    const isLoss = change < 0;
    
    return (
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <p className="text-sm font-medium text-gray-800">{product.name}</p>
            <p className="text-xs text-gray-400">
              {product.volumeMl}ml · Current stock: {product.stockDisplay || 0} units
            </p>
          </div>
          <button 
            onClick={() => { setProduct(null); setQ(''); }} 
            className="text-xs text-gray-400 hover:text-gray-600 transition"
          >
            ← Change product
          </button>
        </div>

        {err && <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 mb-3 text-xs text-gray-700">{err}</div>}
        {msg && <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 mb-3 text-xs text-gray-700">{msg}</div>}

        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-gray-400 block mb-0.5">Change (ml)</label>
              <input 
                type="number" 
                placeholder="e.g. -250" 
                value={form.changeMl} 
                onChange={e => setForm(f => ({ ...f, changeMl: e.target.value }))} 
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:border-gray-400 focus:ring-1 focus:ring-gray-400 outline-none transition ${
                  isLoss ? 'border-gray-300' : 'border-gray-200'
                }`}
                autoFocus
              />
              <p className="text-[10px] text-gray-400 mt-0.5">
                {isLoss ? '⬇️ Negative = stock loss' : '⬆️ Positive = stock found'}
              </p>
            </div>
            <div>
              <label className="text-[10px] text-gray-400 block mb-0.5">Reason</label>
              <select 
                value={form.reason} 
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} 
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-gray-400 focus:ring-1 focus:ring-gray-400 outline-none transition bg-white"
              >
                {reasons.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div>
            <label className="text-[10px] text-gray-400 block mb-0.5">Notes <span className="text-gray-300">*</span></label>
            <textarea 
              placeholder="Required: Describe the reason for this adjustment..." 
              value={form.notes} 
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} 
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-gray-400 focus:ring-1 focus:ring-gray-400 outline-none transition"
              rows={2}
            />
          </div>
          
          <div className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Current stock</span>
              <span className="font-medium text-gray-800">{product.stockDisplay || 0} units</span>
            </div>
            <div className="flex justify-between text-xs mt-0.5">
              <span className="text-gray-500">After adjustment</span>
              <span className={`font-medium ${(product.stockDisplay || 0) + (change / (product.volumeMl || 1)) < 0 ? 'text-gray-500' : 'text-gray-800'}`}>
                {Math.round((product.stockDisplay || 0) + (change / (product.volumeMl || 1)))} units
              </span>
            </div>
          </div>
          
          <button 
            disabled={busy} 
            onClick={submit} 
            className="w-full bg-gray-800 hover:bg-gray-700 text-white font-medium py-2.5 rounded-lg text-sm transition disabled:opacity-50"
          >
            {busy ? 'Processing...' : 'Record Adjustment'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-200 mb-3">
        <p className="text-xs text-gray-500">
          ⚠️ Adjustments require a reason and notes. Use a negative number (in ml) for a loss, positive for found stock.
        </p>
      </div>
      
      <div className="relative">
        <span className="text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 text-xs">🔍</span>
        <input 
          value={q} 
          onChange={e => setQ(e.target.value)} 
          placeholder="Search product to adjust..." 
          className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:border-gray-400 focus:ring-1 focus:ring-gray-400 outline-none transition"
          autoFocus
        />
      </div>
      
      {loading && (
        <div className="py-6 text-center text-gray-400 text-xs">
          <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-gray-600 mr-2"></span>
          Searching...
        </div>
      )}
      
      {!loading && q && results.length === 0 && (
        <div className="py-6 text-center text-gray-400 text-xs">
          No products found matching "{q}"
        </div>
      )}
      
      {results.length > 0 && (
        <div className="mt-2 border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-60 overflow-y-auto">
          {results.map(p => (
            <button 
              key={p.id} 
              onClick={() => setProduct(p)} 
              className="w-full text-left px-3 py-2 hover:bg-gray-50 transition flex justify-between items-center"
            >
              <div>
                <div className="text-sm font-medium text-gray-800">{p.name}</div>
                <div className="text-xs text-gray-400">{p.volumeMl}ml · {p.category || 'Uncategorized'}</div>
              </div>
              <div className="text-xs text-gray-500">
                {p.stockDisplay || 0} units
              </div>
            </button>
          ))}
        </div>
      )}
      
      {!q && !loading && (
        <div className="py-8 text-center text-gray-400 text-xs">
          Search for a product to adjust
        </div>
      )}
    </div>
  );
}

// ============================================================================
// LOW STOCK
// ============================================================================
function LowStock() {
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => { 
    loadData(); 
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const data = await api.lowStock();
      setItems(data || []);
    } catch (e) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  const filteredItems = useMemo(() => {
    if (!items) return [];
    if (filter === 'critical') {
      return items.filter(i => i.currentUnits === 0);
    }
    return items;
  }, [items, filter]);

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-400 text-xs">
        <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-gray-600 mr-2"></span>
        Loading...
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-gray-500">✓ All products are well stocked</p>
        <p className="text-xs text-gray-400 mt-1">No low stock items detected</p>
      </div>
    );
  }

  const criticalCount = items.filter(i => i.currentUnits === 0).length;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 p-3 border-b border-gray-100">
        <span className="text-[10px] text-gray-400">Filter:</span>
        <button
          onClick={() => setFilter('all')}
          className={`text-[10px] px-2 py-0.5 rounded transition ${
            filter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All ({items.length})
        </button>
        <button
          onClick={() => setFilter('critical')}
          className={`text-[10px] px-2 py-0.5 rounded transition ${
            filter === 'critical' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Critical ({criticalCount})
        </button>
        {filter !== 'all' && (
          <button
            onClick={() => setFilter('all')}
            className="text-[10px] text-gray-400 hover:text-gray-600 underline"
          >
            clear
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr className="text-left text-gray-500 font-medium">
              <th className="p-2">Product</th>
              <th className="p-2">Current Stock</th>
              <th className="p-2">Reorder Level</th>
              <th className="p-2">Status</th>
              <th className="p-2">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredItems.map(i => {
              const isCritical = i.currentUnits === 0;
              const isLow = i.currentUnits <= i.reorderLevel && i.currentUnits > 0;
              
              let statusText = 'Low';
              let statusColor = 'bg-gray-100 text-gray-600';
              if (isCritical) {
                statusText = 'Critical';
                statusColor = 'bg-gray-200 text-gray-700';
              }
              
              return (
                <tr key={i.id} className="hover:bg-gray-50/60 transition">
                  <td className="p-2 font-medium text-gray-700">{i.name}</td>
                  <td className={`p-2 font-medium ${isCritical ? 'text-gray-500' : isLow ? 'text-gray-700' : 'text-gray-700'}`}>
                    {i.currentUnits} units
                  </td>
                  <td className="p-2 text-gray-500">{i.reorderLevel} units</td>
                  <td className="p-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusColor}`}>
                      {statusText}
                    </span>
                  </td>
                  <td className="p-2">
                    <button className="text-[10px] text-gray-500 hover:text-gray-700 underline">
                      restock
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}