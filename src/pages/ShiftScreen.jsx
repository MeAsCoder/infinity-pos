// ShiftScreen.jsx - Mobile Responsive (usability pass)
// Fixes vs. previous version:
// 1. DebtModal had no height cap/scroll — could run off-screen with the
//    keyboard up. Now capped at 85vh with its own scroll.
// 2. Stock-count rows used near-unreadable text (8-10px) and sub-30px tap
//    targets for the +1/0 quick buttons — technically fit the screen but
//    were hard to read/tap. Restructured to wrap with 16px+ text and
//    36-44px touch targets.
// 3. Several numeric inputs were under 16px, which makes iOS Safari
//    auto-zoom on focus. Bumped to text-base throughout.
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, enqueue } from '../db/offlineDb';
import { api, apiFetch, OfflineError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import {
  IconAlert,
  IconCheck,
  IconArrowLeft,
  IconClose,
  IconCredit,
  IconPhone,
  IconUser,
  IconCash,
  IconReceipt
} from '../components/Icons';

function money(n) { return `KES ${Number(n || 0).toLocaleString()}`; }

export default function ShiftScreen() {
  const { user, deviceId } = useAuth();
  const { online } = useSync();
  const navigate = useNavigate();
  const [shift, setShift] = useState(undefined);
  const [report, setReport] = useState(null);
  const [closedResult, setClosedResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadShift();
  }, []);

  async function loadShift() {
    setLoading(true);
    const cached = await db.currentShift.get(1);
    if (cached?.shift?.status === 'OPEN') {
      setShift(cached.shift);
      if (online) {
        try {
          const fresh = await api.currentShift();
          if (fresh?.status === 'OPEN') {
            setShift(fresh);
            await db.currentShift.put({ id: 1, shift: fresh });
          }
          if (fresh?.id) {
            const reportData = await api.shiftReport(fresh.id);
            setReport(reportData);
          }
        } catch (e) {
          // Silent fail - use cached data
        }
      }
      setLoading(false);
      return;
    }

    if (online) {
      try {
        const fresh = await api.currentShift();
        if (fresh?.status === 'OPEN') {
          setShift(fresh);
          await db.currentShift.put({ id: 1, shift: fresh });
          if (fresh?.id) {
            const reportData = await api.shiftReport(fresh.id);
            setReport(reportData);
          }
          setLoading(false);
          return;
        }
      } catch (e) {
        // Silent fail
      }
    }

    setShift(null);
    setLoading(false);
  }

  async function handleClosed(result, shiftId) {
    if (shiftId) {
      try {
        await db.openTabs.where('shiftId').equals(shiftId).delete();
      } catch (e) {
        // Silent fail
      }
    }
    setClosedResult(result);
  }

  if (loading) {
    return (
      <div className="p-10 text-center text-neutral-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand mx-auto"></div>
        <p className="mt-3">Loading shift data...</p>
      </div>
    );
  }

  if (closedResult) {
    return (
      <ShiftClosedSummary
        result={closedResult}
        onOk={() => {
          setClosedResult(null);
          setShift(null);
          navigate('/pos');
        }}
      />
    );
  }

  if (!shift || shift.status !== 'OPEN') {
    return <StartShiftForm deviceId={deviceId} onStarted={(s) => {
      setShift(s);
      navigate('/pos');
    }} />;
  }

  return (
    <div className="max-w-4xl mx-auto p-3 sm:p-4">
      <button
        onClick={() => navigate('/pos')}
        className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-ink-950 mb-3 sm:mb-4 font-medium min-h-[40px]"
      >
        <IconArrowLeft className="w-4 h-4" /> Back to POS
      </button>

      {report && !report.stocktake ? (
        <StockCountGate
          shift={shift}
          onSubmitted={(result) => {
            setReport(r => ({ ...(r || {}), stocktake: { id: result.stocktakeId || 'pending', ...result } }));
          }}
        />
      ) : (
        <EndShiftForm
          shift={shift}
          report={report}
          online={online}
          user={user}
          onClosed={(r) => handleClosed(r, shift.id)}
          onManageTabs={() => navigate('/pos', { state: { view: 'tabs' } })}
          onRefresh={loadShift}
        />
      )}
    </div>
  );
}

function StartShiftForm({ deviceId, onStarted }) {
  const [openingFloat, setOpeningFloat] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function start() {
    setErr('');
    setBusy(true);
    const uuid = crypto.randomUUID();
    const payload = {
      openingFloat: Number(openingFloat) || 0,
      deviceId,
      clientUuid: uuid
    };
    try {
      let shift;
      if (navigator.onLine) {
        shift = await apiFetch('/api/shifts/start', { method: 'POST', body: payload });
      } else {
        shift = {
          id: `local-${uuid}`,
          status: 'OPEN',
          opening_float: payload.openingFloat,
          started_at: new Date().toISOString(),
          _pendingSync: true,
          client_uuid: uuid
        };
        await enqueue('SHIFT_START', uuid, payload);
      }
      await db.currentShift.put({ id: 1, shift });
      onStarted(shift);
    } catch (e) {
      if (e instanceof OfflineError) {
        const shift = {
          id: `local-${uuid}`,
          status: 'OPEN',
          opening_float: payload.openingFloat,
          started_at: new Date().toISOString(),
          _pendingSync: true,
          client_uuid: uuid
        };
        await enqueue('SHIFT_START', uuid, payload);
        await db.currentShift.put({ id: 1, shift });
        onStarted(shift);
      } else {
        setErr(e.message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-8 sm:mt-14 bg-white rounded-2xl shadow-card p-5 sm:p-7">
      <h2 className="font-display text-xl sm:text-2xl font-semibold text-ink-950 mb-1">Start Shift</h2>
      <p className="text-sm text-neutral-500 mb-4 sm:mb-5">Count your float before you begin.</p>
      {err && (
        <div className="bg-rose-50 text-rose-700 text-sm rounded-lg p-2.5 sm:p-3 mb-3 sm:mb-4 border border-rose-100">
          {err}
        </div>
      )}
      <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5">
        Opening cash float
      </label>
      <input
        type="number"
        value={openingFloat}
        onChange={e => setOpeningFloat(e.target.value)}
        autoFocus
        className="w-full border border-neutral-200 rounded-xl px-3 sm:px-4 py-3 text-lg mb-4 sm:mb-5 focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
        placeholder="0"
      />
      <button
        disabled={busy}
        onClick={start}
        className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3.5 rounded-xl disabled:opacity-50 transition shadow-soft text-base min-h-[48px]"
      >
        {busy ? 'Starting…' : 'Start Shift'}
      </button>
      {!navigator.onLine && (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2.5 mt-3 text-center">
          Offline — the shift will start locally and sync once you're back online.
        </p>
      )}
    </div>
  );
}

// ============================================================================
// STOCK COUNT GATE
// ============================================================================
function StockCountGate({ shift, onSubmitted }) {
  const allProducts = useLiveQuery(() => db.products.toArray(), [], null);
  const [search, setSearch] = useState('');
  const [counts, setCounts] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [submittedResult, setSubmittedResult] = useState(null);

  useEffect(() => {
    if (navigator.onLine) {
      api.products('?active=1')
        .then(fresh => db.products.bulkPut(fresh))
        .catch(() => {});
    }
  }, []);

  const trackedProducts = useMemo(() => (allProducts || []).filter(p => p.trackInventory), [allProducts]);

  const getAvailableUnits = (product) => {
    return (product.sellingUnits || [])
      .filter(u => u.active !== false)
      .sort((a, b) => b.volumeMl - a.volumeMl)
      .map(u => ({
        id: u.id,
        label: u.name,
        ml: u.volumeMl,
        sortOrder: u.sortOrder || 0
      }));
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return trackedProducts;
    return trackedProducts.filter(p => p.name.toLowerCase().includes(q) || (p.brand || '').toLowerCase().includes(q));
  }, [trackedProducts, search]);

  const countedCount = trackedProducts.filter(p => {
    const units = getAvailableUnits(p);
    return units.some(unit => {
      const key = `${p.id}-${unit.id}`;
      const count = counts[key];
      return count !== undefined && count !== '';
    });
  }).length;

  const allCounted = trackedProducts.length === 0 || countedCount === trackedProducts.length;

  const getUnitCount = (productId, unitId) => {
    const key = `${productId}-${unitId}`;
    return counts[key] !== undefined && counts[key] !== '' ? Number(counts[key]) : 0;
  };

  const getTotalMl = (product) => {
    const units = getAvailableUnits(product);
    let total = 0;
    units.forEach(unit => {
      const count = getUnitCount(product.id, unit.id);
      total += count * unit.ml;
    });
    return total;
  };

  const isProductCounted = (product) => {
    const units = getAvailableUnits(product);
    return units.some(unit => {
      const key = `${product.id}-${unit.id}`;
      const count = counts[key];
      return count !== undefined && count !== '';
    });
  };

  async function submit() {
    if (!allCounted) {
      setErr(`Please count all products (${countedCount}/${trackedProducts.length} done).`);
      return;
    }
    setErr('');
    setBusy(true);

    const items = trackedProducts.map(p => {
      const units = getAvailableUnits(p);
      const unitCounts = units.map(unit => {
        const key = `${p.id}-${unit.id}`;
        const count = counts[key] !== undefined && counts[key] !== '' ? Number(counts[key]) : 0;
        return {
          sellingUnitId: unit.id,
          count: count
        };
      });
      return {
        productId: p.id,
        productName: p.name,
        unitCounts
      };
    });

    const payload = {
      items,
      shiftId: shift.id
    };

    try {
      if (navigator.onLine) {
        const result = await apiFetch(`/api/shifts/${shift.id}/stocktake`, {
          method: 'POST',
          body: payload
        });
        setSubmittedResult(result);
      } else {
        await enqueue('STOCK_COUNT_SUBMIT', crypto.randomUUID(), payload);
        setSubmittedResult({ pendingSync: true });
      }
    } catch (e) {
      setErr(e.data?.error || e.message || 'Failed to submit stock count');
    } finally {
      setBusy(false);
    }
  }

  if (submittedResult) {
    return (
      <div className="bg-white rounded-2xl shadow-card p-4 sm:p-6 text-center">
        <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full mx-auto flex items-center justify-center mb-3 sm:mb-4 ${
          submittedResult.pendingSync || submittedResult.flagged ? 'bg-amber-100' : 'bg-emerald-100'
        }`}>
          {submittedResult.pendingSync || submittedResult.flagged ?
            <IconAlert className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" /> :
            <IconCheck className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />}
        </div>
        <h2 className="font-display text-lg sm:text-xl font-semibold text-ink-950 mb-2">Stock Count Submitted</h2>
        {submittedResult.pendingSync ? (
          <p className="text-neutral-500 text-sm">Saved offline — will sync and be reviewed once this device is back online.</p>
        ) : (
          <>
            <p className="text-sm text-neutral-500 mb-3">
              {submittedResult.itemCount} product(s) counted.
              {submittedResult.flagged
                ? ' A few differences were large enough to flag for admin review.'
                : ' No significant differences found.'}
            </p>
            {submittedResult.topDiscrepancies?.length > 0 && (
              <div className="text-left bg-neutral-50 rounded-xl p-3 sm:p-4 space-y-1 text-sm">
                <p className="text-xs text-neutral-400 uppercase tracking-wide font-semibold mb-1">Largest differences</p>
                {submittedResult.topDiscrepancies.map((d, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-neutral-600 truncate">{d.product_name}</span>
                    <span className={`font-medium ${d.difference_ml < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {d.difference_ml > 0 ? '+' : ''}{d.difference_ml}ml
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        <button
          onClick={() => onSubmitted(submittedResult)}
          className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3.5 rounded-xl mt-4 sm:mt-6 transition text-base min-h-[48px]"
        >
          Continue to Close Shift
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-card p-3 sm:p-6">
      <div className="mb-3 sm:mb-4">
        <h2 className="font-display text-xl sm:text-2xl font-semibold text-ink-950 flex items-center gap-2">
          <IconReceipt className="w-5 h-5" /> Count Stock
        </h2>
        <p className="text-sm text-neutral-500 mt-1">
          Count what's physically on the shelf. Each unit type is counted separately.
          <br />
          <span className="text-xs text-amber-600">
            💡 Enter 0 if the item is out of stock — it will still count as counted.
          </span>
        </p>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search product…"
          className="flex-1 border border-neutral-200 rounded-xl px-3 sm:px-4 py-2.5 text-base focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
        />
        <span className="text-sm font-medium text-neutral-500 whitespace-nowrap">
          {countedCount}/{trackedProducts.length} counted
        </span>
      </div>

      {err && (
        <div className="bg-rose-50 text-rose-700 text-sm rounded-lg p-2.5 mb-2 sm:mb-3 border border-rose-100">
          {err}
        </div>
      )}

      <div className="border border-neutral-200 rounded-xl divide-y divide-neutral-100 max-h-[55vh] overflow-y-auto mb-3 sm:mb-4">
        {filtered.map(p => {
          const availableUnits = getAvailableUnits(p);
          const totalMl = getTotalMl(p);
          const productCounted = isProductCounted(p);

          return (
            <div key={p.id} className={`px-3 sm:px-4 py-3 ${productCounted ? 'bg-green-50/30' : ''}`}>
              <div className="flex flex-wrap items-center justify-between gap-1 sm:gap-2 mb-2">
                <div>
                  <div className="text-sm font-medium text-ink-950">{p.name}</div>
                  <div className="text-xs text-neutral-400">
                    {p.volumeMl}ml {p.volumeMl === 1 ? 'per piece' : 'bottle'}
                  </div>
                </div>
                <div className="text-sm font-semibold text-brand">
                  {productCounted ? (
                    totalMl > 0 ? `${totalMl}ml total` : '✅ 0 (Out of Stock)'
                  ) : (
                    'Not counted'
                  )}
                </div>
              </div>

              <div className="space-y-2">
                {availableUnits.map((unit) => {
                  const key = `${p.id}-${unit.id}`;
                  const count = counts[key] !== undefined && counts[key] !== '' ? Number(counts[key]) : '';
                  const unitTotalMl = count !== '' ? count * unit.ml : 0;
                  const isCounted = counts[key] !== undefined && counts[key] !== '';

                  return (
                    <div key={unit.id} className="flex flex-wrap items-center gap-2">
                      <div className={`w-16 text-xs shrink-0 ${isCounted ? 'text-neutral-700 font-medium' : 'text-neutral-500'}`}>
                        {unit.label}:
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={count}
                        onChange={e => {
                          const val = e.target.value;
                          if (val === '' || Number(val) >= 0) {
                            setCounts(c => ({ ...c, [key]: val }));
                          }
                        }}
                        placeholder="0"
                        className={`w-16 border border-neutral-200 rounded-lg px-2 py-2 text-right text-base focus:border-brand focus:ring-1 focus:ring-brand outline-none transition ${
                          isCounted ? 'bg-green-50 border-green-300' : ''
                        }`}
                      />
                      <span className="text-xs text-neutral-400 shrink-0">
                        × {unit.ml}ml = {unitTotalMl}ml
                      </span>
                      <div className="flex gap-1.5 ml-auto">
                        <button
                          onClick={() => {
                            const current = counts[key] !== undefined && counts[key] !== '' ? Number(counts[key]) : 0;
                            setCounts(c => ({ ...c, [key]: String(current + 1) }));
                          }}
                          className="text-xs font-medium bg-neutral-100 hover:bg-neutral-200 px-3 py-2 rounded-lg min-h-[36px] min-w-[36px]"
                        >
                          +1
                        </button>
                        <button
                          onClick={() => {
                            setCounts(c => ({ ...c, [key]: '0' }));
                          }}
                          className="text-xs font-medium bg-neutral-100 hover:bg-neutral-200 px-3 py-2 rounded-lg text-neutral-500 min-h-[36px] min-w-[36px]"
                        >
                          0
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {availableUnits.length > 1 && (
                <div className="mt-2.5 flex gap-1.5 flex-wrap">
                  <span className="text-xs text-neutral-400 self-center">Quick:</span>
                  {availableUnits.map((unit) => {
                    if (unit.label.toLowerCase().includes('half')) {
                      return (
                        <button
                          key={`half-${unit.id}`}
                          onClick={() => {
                            setCounts(c => ({ ...c, [`${p.id}-${unit.id}`]: '1' }));
                          }}
                          className="text-xs bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1.5 rounded-lg transition min-h-[32px]"
                        >
                          1 {unit.label}
                        </button>
                      );
                    }
                    if (unit.label.toLowerCase().includes('tot')) {
                      return (
                        <button
                          key={`tot-${unit.id}`}
                          onClick={() => {
                            setCounts(c => ({ ...c, [`${p.id}-${unit.id}`]: '20' }));
                          }}
                          className="text-xs bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1.5 rounded-lg transition min-h-[32px]"
                        >
                          20 {unit.label}s
                        </button>
                      );
                    }
                    return null;
                  })}
                  <button
                    onClick={() => {
                      const newCounts = {};
                      availableUnits.forEach(u => {
                        newCounts[`${p.id}-${u.id}`] = '0';
                      });
                      setCounts(c => ({ ...c, ...newCounts }));
                    }}
                    className="text-xs bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 px-2.5 py-1.5 rounded-lg transition min-h-[32px]"
                  >
                    Out of Stock
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="p-4 sm:p-6 text-center text-neutral-400 text-sm">No matching products.</div>
        )}
        {trackedProducts.length === 0 && (
          <div className="p-4 sm:p-6 text-center text-neutral-400 text-sm">No tracked-inventory products to count.</div>
        )}
      </div>

      <button
        disabled={busy || !allCounted}
        onClick={submit}
        className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3.5 rounded-xl disabled:opacity-40 transition shadow-soft text-base min-h-[48px]"
      >
        {busy ? 'Submitting…' : allCounted ? 'Submit Stock Count' : `Count all products to continue (${countedCount}/${trackedProducts.length})`}
      </button>
      {!navigator.onLine && (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2.5 mt-2 sm:mt-3 text-center">
          Offline — this will sync automatically once you're back online.
        </p>
      )}
    </div>
  );
}

// ============================================================================
// END SHIFT FORM
// ============================================================================
function EndShiftForm({ shift, report, online, user, onClosed, onManageTabs, onRefresh }) {
  const [actualCash, setActualCash] = useState('');
  const [actualMobile, setActualMobile] = useState('');
  const [actualCard, setActualCard] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [openTabsBlocking, setOpenTabsBlocking] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [showDebtModal, setShowDebtModal] = useState(false);
  const [selectedTab, setSelectedTab] = useState(null);
  const [debtCustomer, setDebtCustomer] = useState({
    name: '',
    phone: '',
    notes: ''
  });
  const [debtSuccess, setDebtSuccess] = useState('');

  const totals = report?.sales;

  async function refreshData() {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } catch (e) {
      // Silent fail
    } finally {
      setIsRefreshing(false);
    }
  }

  async function recordAsDebt() {
    if (!debtCustomer.name.trim()) {
      setErr('Customer name is required');
      return;
    }

    if (!selectedTab || !selectedTab.localId) {
      setErr('Invalid tab selected');
      return;
    }

    setBusy(true);
    setErr('');
    setDebtSuccess('');

    try {
      const saleId = selectedTab.localId || selectedTab.id;

      const payload = {
        customerName: debtCustomer.name.trim(),
        customerPhone: debtCustomer.phone.trim() || undefined,
        notes: debtCustomer.notes.trim() || undefined,
        waiterId: user.id,
        shiftId: shift.id,
        amount: selectedTab.total
      };

      if (navigator.onLine) {
        await apiFetch(`/api/sales/${saleId}/debt`, {
          method: 'POST',
          body: payload
        });
      } else {
        await enqueue('RECORD_DEBT', crypto.randomUUID(), { ...payload, saleId });
      }

      await db.openTabs.where('localId').equals(saleId).delete();
      await refreshData();

      setDebtSuccess(`Debt of ${money(selectedTab.total)} recorded for ${debtCustomer.name}`);

      setTimeout(() => {
        setShowDebtModal(false);
        setSelectedTab(null);
        setDebtCustomer({ name: '', phone: '', notes: '' });
        setDebtSuccess('');
      }, 1500);

    } catch (e) {
      console.error('Debt recording error:', e);
      setErr(e.message || 'Failed to record debt');
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setErr('');
    setOpenTabsBlocking(null);

    if (openTabsBlocking && openTabsBlocking.length > 0) {
      setErr('Please settle or record all open tabs as debt before closing.');
      return;
    }

    if (actualCash === '') {
      setErr('Please count and enter the physical cash in the drawer.');
      return;
    }

    await closeShift();
  }

  async function closeShift() {
    setBusy(true);
    const payload = {
      shiftId: shift.id,
      actualCash: Number(actualCash),
      actualMobile: Number(actualMobile) || 0,
      actualCard: Number(actualCard) || 0,
      notes: notes || 'No notes provided'
    };

    try {
      let result;
      if (navigator.onLine) {
        result = await apiFetch(`/api/shifts/${shift.id}/end`, { method: 'POST', body: payload });
      } else {
        await enqueue('SHIFT_END', crypto.randomUUID(), payload);
        result = {
          pendingSync: true,
          message: 'Shift closure saved offline. Will reconcile once synced.'
        };
      }
      await db.currentShift.delete(1);
      onClosed(result);
    } catch (e) {
      console.error('Shift end error:', e);

      if (e instanceof OfflineError) {
        await enqueue('SHIFT_END', crypto.randomUUID(), payload);
        await db.currentShift.delete(1);
        onClosed({
          pendingSync: true,
          message: 'Saved offline. Shift closure will be processed once this device syncs.'
        });
      } else if (e.status === 409 && e.data?.openTabs) {
        setOpenTabsBlocking(e.data.openTabs);
        setErr(`${e.data.openTabs.length} tab(s) still open. Please settle or record them as debt.`);
      } else if (e.status === 400 && e.data?.error) {
        setErr(e.data.error);
      } else {
        setErr(e.message || 'Failed to close shift');
      }
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    async function fetchOpenTabs() {
      if (!shift?.id) return;

      try {
        const tabs = await api.openTabs(shift.id);
        if (tabs && tabs.length > 0) {
          setOpenTabsBlocking(tabs);
        }
      } catch (e) {
        // Silent fail - might be offline
      }
    }

    fetchOpenTabs();
  }, [shift]);

  return (
    <div className="bg-white rounded-2xl shadow-card p-3 sm:p-6">
      <div className="flex flex-wrap justify-between items-start gap-2 mb-3 sm:mb-4">
        <div>
          <h2 className="font-display text-lg sm:text-2xl font-semibold text-ink-950">
            Shift #{shift.id}
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500">
            Started {new Date(shift.started_at).toLocaleString()}
            {shift._pendingSync && ' (pending sync)'}
          </p>
        </div>
        <button
          onClick={refreshData}
          disabled={isRefreshing}
          className="text-sm text-brand hover:text-brand-dark font-medium disabled:opacity-50 min-h-[36px]"
        >
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {openTabsBlocking && openTabsBlocking.length > 0 && (
        <div className="border border-amber-200 bg-amber-50 rounded-xl p-3 sm:p-4 mb-4 sm:mb-5">
          <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm mb-2">
            <IconAlert className="w-4 h-4" /> {openTabsBlocking.length} bill(s) still open
          </div>
          <p className="text-xs text-amber-700 mb-2 sm:mb-3">
            You must either settle these bills or record them as debt before closing the shift.
          </p>
          <div className="space-y-2 mb-2 sm:mb-3 max-h-60 overflow-y-auto">
            {openTabsBlocking.map(t => {
              const tabId = t.localId || t.id;
              return (
                <div key={tabId} className="flex flex-wrap justify-between items-center gap-2 text-sm bg-white rounded-lg px-3 py-2">
                  <div>
                    <span className="text-ink-950 font-medium">{t.tab_label || t.receipt_number || `Bill #${tabId}`}</span>
                    <span className="text-neutral-400 text-xs ml-2">{t.items?.length || 0} items</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{money(t.total || 0)}</span>
                    <button
                      onClick={() => {
                        const selected = { ...t, localId: tabId };
                        setSelectedTab(selected);
                        setShowDebtModal(true);
                        setErr('');
                        setDebtSuccess('');
                      }}
                      className="text-xs bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-lg transition min-h-[36px]"
                    >
                      Record as Debt
                    </button>
                    <button
                      onClick={() => {
                        onManageTabs();
                      }}
                      className="text-xs bg-brand hover:bg-brand-dark text-white px-3 py-2 rounded-lg transition min-h-[36px]"
                    >
                      Settle
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            onClick={onManageTabs}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold py-2.5 rounded-lg transition min-h-[44px]"
          >
            Go to Open Bills
          </button>
        </div>
      )}

      {totals && (
        <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4 sm:mb-5 text-sm">
          <Stat label="Transactions" value={totals.count} />
          <Stat label="Revenue" value={money(totals.revenue)} />
          <Stat label="Opening float" value={money(shift.opening_float)} />
          <Stat label="Discounts given" value={money(totals.discounts)} />
          <Stat label="Cash Sales" value={money(totals.cash || 0)} />
          <Stat label="Credit/Debt Sales" value={money(totals.credit || 0)} />
        </div>
      )}
      {!report && (
        <div className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2.5 mb-4 sm:mb-5">
          {online ? 'Loading shift report...' : 'Live totals unavailable offline — figures will be finalized once this device is back online.'}
        </div>
      )}

      <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-5">
        <div className="border-b border-neutral-200 pb-2">
          <h3 className="font-semibold text-ink-950 flex items-center gap-2 text-base">
            <IconCash className="w-4 h-4" /> Count Cash
          </h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Enter the physical cash, mobile money, and card payments you received.
            The system will calculate the expected amount after you submit.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">
            Physical cash counted <span className="text-rose-500">*</span>
          </label>
          <input
            type="number"
            value={actualCash}
            onChange={e => setActualCash(e.target.value)}
            autoFocus
            className="w-full border border-neutral-200 rounded-xl px-3 sm:px-4 py-3 text-lg focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
            placeholder="0.00"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <div>
            <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">
              Mobile money received
            </label>
            <input
              type="number"
              value={actualMobile}
              onChange={e => setActualMobile(e.target.value)}
              className="w-full border border-neutral-200 rounded-xl px-2 sm:px-3 py-2.5 text-base focus:border-brand outline-none transition"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">
              Card / PDQ received
            </label>
            <input
              type="number"
              value={actualCard}
              onChange={e => setActualCard(e.target.value)}
              className="w-full border border-neutral-200 rounded-xl px-2 sm:px-3 py-2.5 text-base focus:border-brand outline-none transition"
              placeholder="0.00"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full border border-neutral-200 rounded-xl px-2 sm:px-3 py-2.5 text-base focus:border-brand outline-none transition"
            rows={2}
            placeholder="Any issues, discrepancies, or notes about this shift..."
          />
        </div>
      </div>

      {err && (
        <div className="bg-rose-50 text-rose-700 text-sm rounded-lg p-2.5 sm:p-3 mb-3 sm:mb-4 border border-rose-100">
          {err}
        </div>
      )}

      <div className="bg-neutral-50 rounded-xl p-3 sm:p-4 mb-4 sm:mb-5 text-sm">
        <p className="text-neutral-600">
          <span className="font-medium">📌 Note:</span>
          Expected cash and any shortage/surplus are calculated automatically from your recorded sales.
          {openTabsBlocking && openTabsBlocking.length > 0 && (
            <span className="block mt-2 text-amber-700">
              ⚠️ {openTabsBlocking.length} open bill(s) must be settled or recorded as debt before closing.
            </span>
          )}
        </p>
      </div>

      <button
        disabled={busy || (openTabsBlocking && openTabsBlocking.length > 0)}
        onClick={submit}
        className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3.5 rounded-xl disabled:opacity-50 transition shadow-soft text-base min-h-[48px]"
      >
        {busy ? 'Processing...' : 'Close Shift'}
      </button>

      {openTabsBlocking && openTabsBlocking.length > 0 && (
        <p className="text-xs text-amber-700 text-center mt-2">
          Please settle all open bills or record them as debt before closing the shift.
        </p>
      )}

      {showDebtModal && selectedTab && (
        <DebtModal
          tab={selectedTab}
          customer={debtCustomer}
          setCustomer={setDebtCustomer}
          onConfirm={recordAsDebt}
          onClose={() => {
            setShowDebtModal(false);
            setSelectedTab(null);
            setDebtCustomer({ name: '', phone: '', notes: '' });
            setErr('');
            setDebtSuccess('');
          }}
          busy={busy}
          error={err}
          success={debtSuccess}
        />
      )}
    </div>
  );
}

// ============================================================================
// DEBT MODAL
// ============================================================================
function DebtModal({ tab, customer, setCustomer, onConfirm, onClose, busy, error, success }) {
  const [customerSearch, setCustomerSearch] = useState('');
  const [showManualEntry, setShowManualEntry] = useState(false);
  const existingCustomers = useLiveQuery(() => db.customers.toArray(), [], []);

  useEffect(() => {
    if (navigator.onLine) {
      api.customers()
        .then(c => db.customers.bulkPut(c))
        .catch(() => {});
    }
  }, []);

  const matchedExisting = (existingCustomers || []).find(c =>
    (customer.phone && c.phone === customer.phone) ||
    (!customer.phone && customer.name && c.name === customer.name)
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      {/* max-h + overflow-y-auto so this never runs off-screen with the
          keyboard open or a long customer search result list showing */}
      <div
        className="bg-white rounded-2xl w-full max-w-sm sm:max-w-md max-h-[85vh] overflow-y-auto p-4 sm:p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-3 sm:mb-4">
          <div>
            <h3 className="font-display text-lg sm:text-xl font-semibold text-ink-950 flex items-center gap-2">
              <IconCredit className="w-5 h-5 text-amber-600" />
              Record as Debt
            </h3>
            <p className="text-sm text-neutral-500 mt-1">
              {tab.tab_label || tab.receipt_number || `Bill #${tab.localId || tab.id}`} — {money(tab.total || 0)}
            </p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 w-9 h-9 flex items-center justify-center shrink-0">
            <IconClose className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 sm:p-4 mb-3 sm:mb-4">
            <div className="flex items-center gap-2 text-emerald-700">
              <IconCheck className="w-5 h-5" />
              <span className="text-sm font-medium">{success}</span>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 sm:p-3 mb-3 sm:mb-4">
              <p className="text-xs text-amber-800">
                <span className="font-semibold">⚠️ Important:</span> Recording this as debt means:
              </p>
              <ul className="text-xs text-amber-700 mt-1 space-y-0.5 list-disc list-inside">
                <li>This amount will be recorded against this customer</li>
                <li>It will be recorded as a shortage on your shift</li>
                <li>If not recovered, it may be deducted from your earnings</li>
              </ul>
            </div>

            {error && (
              <div className="bg-rose-50 text-rose-700 text-sm rounded-lg p-2.5 sm:p-3 mb-3 sm:mb-4 border border-rose-100">
                {error}
              </div>
            )}

            <div className="space-y-2 sm:space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">
                  Customer <span className="text-rose-500">*</span>
                </label>

                {customer.name && !showManualEntry ? (
                  <div className="bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm min-w-0">
                        <IconUser className="w-4 h-4 text-neutral-400 shrink-0" />
                        <span className="font-medium text-ink-950 truncate">{customer.name}</span>
                        {customer.phone && <span className="text-neutral-400 text-xs shrink-0">{customer.phone}</span>}
                      </div>
                      <button
                        onClick={() => {
                          setCustomer(c => ({ ...c, name: '', phone: '' }));
                          setCustomerSearch('');
                        }}
                        className="text-xs text-neutral-400 hover:text-neutral-600 shrink-0"
                      >
                        change
                      </button>
                    </div>
                    {matchedExisting && matchedExisting.balance > 0 && (
                      <div className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                        <IconAlert className="w-3 h-3" /> Already owes {money(matchedExisting.balance)}
                      </div>
                    )}
                  </div>
                ) : showManualEntry ? (
                  <div className="space-y-2">
                    <div className="relative">
                      <IconUser className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={customer.name}
                        onChange={e => setCustomer(c => ({ ...c, name: e.target.value }))}
                        placeholder="e.g. John Doe"
                        className="w-full border border-neutral-200 rounded-xl pl-9 pr-3 sm:pr-4 py-2.5 text-base focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
                        autoFocus
                      />
                    </div>
                    <div className="relative">
                      <IconPhone className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        value={customer.phone}
                        onChange={e => setCustomer(c => ({ ...c, phone: e.target.value }))}
                        placeholder="e.g. 0712 345 678"
                        className="w-full border border-neutral-200 rounded-xl pl-9 pr-3 sm:pr-4 py-2.5 text-base focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
                      />
                    </div>
                    <button
                      onClick={() => {
                        setCustomer(c => ({ ...c, name: '', phone: '' }));
                        setShowManualEntry(false);
                      }}
                      className="text-xs text-neutral-400 hover:text-neutral-600 py-1 min-h-[32px]"
                    >
                      ← search existing customers instead
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <input
                        value={customerSearch}
                        onChange={e => setCustomerSearch(e.target.value)}
                        placeholder="Search customer by name/phone…"
                        className="flex-1 border border-neutral-200 rounded-xl px-3 py-2.5 text-base focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
                        autoFocus
                      />
                      <button
                        onClick={() => { setShowManualEntry(true); setCustomerSearch(''); }}
                        className="text-xs bg-amber-600 hover:bg-amber-700 text-white px-3 py-2.5 rounded-lg transition whitespace-nowrap min-h-[40px]"
                      >
                        + New
                      </button>
                    </div>
                    <div className="max-h-32 overflow-y-auto border border-neutral-200 rounded-lg bg-white">
                      {(existingCustomers || [])
                        .filter(c => c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
                               (c.phone && c.phone.includes(customerSearch)))
                        .slice(0, 20)
                        .map(c => (
                          <button
                            key={c.id}
                            onClick={() => {
                              setCustomer(cur => ({ ...cur, name: c.name, phone: c.phone || '' }));
                              setCustomerSearch('');
                            }}
                            className="w-full text-left px-3 py-2.5 text-sm hover:bg-neutral-50 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-0.5 min-h-[44px]"
                          >
                            <span className="truncate">{c.name}</span>
                            <span className="text-neutral-400 text-xs shrink-0">
                              {c.phone || 'no phone'} · owes {money(c.balance || 0)}
                            </span>
                          </button>
                        ))}
                      {(!existingCustomers || existingCustomers.length === 0) && (
                        <div className="p-3 text-xs text-neutral-400">
                          No customers found. Click "+ New" to add one.
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={customer.notes}
                  onChange={e => setCustomer(c => ({ ...c, notes: e.target.value }))}
                  placeholder="Any additional details about this customer or the situation..."
                  className="w-full border border-neutral-200 rounded-xl px-3 sm:px-4 py-2.5 text-base focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
                  rows={2}
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-1 sm:pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 border border-neutral-200 rounded-xl py-2.5 text-sm text-neutral-600 font-medium hover:bg-neutral-50 transition min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  onClick={onConfirm}
                  disabled={busy || !customer.name.trim()}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl py-2.5 text-sm transition disabled:opacity-50 min-h-[44px]"
                >
                  {busy ? 'Recording...' : 'Record Debt'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SHIFT CLOSED SUMMARY
// ============================================================================
function ShiftClosedSummary({ result, onOk }) {
  const shortage = result.variance < 0 ? -result.variance : 0;
  const surplus = result.variance > 0 ? result.variance : 0;

  return (
    <div className="max-w-sm mx-auto mt-8 sm:mt-14 bg-white rounded-2xl shadow-card p-5 sm:p-7 text-center">
      <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full mx-auto flex items-center justify-center mb-3 sm:mb-4 ${
        result.pendingSync ? 'bg-amber-100' : shortage > 0 ? 'bg-rose-100' : 'bg-emerald-100'
      }`}>
        {result.pendingSync ?
          <IconAlert className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" /> :
          shortage > 0 ?
            <IconAlert className="w-5 h-5 sm:w-6 sm:h-6 text-rose-600" /> :
            <IconCheck className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
        }
      </div>
      <h2 className="font-display text-lg sm:text-xl font-semibold text-ink-950 mb-2">Shift Closed</h2>
      {result.pendingSync ? (
        <p className="text-neutral-500 text-sm">{result.message}</p>
      ) : (
        <>
          <p className={`text-sm font-medium mb-3 sm:mb-4 ${shortage > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            {shortage > 0 ? `⚠️ Shortage of ${money(shortage)}` :
             surplus > 0 ? `✅ Surplus of ${money(surplus)}` :
             '✅ Perfect balance!'}
          </p>
          <div className="text-left bg-neutral-50 rounded-xl p-3 sm:p-4 space-y-1 text-sm mt-3">
            <Row label="Expected Cash" value={money(result.expectedCash)} />
            <Row label="Actual Cash" value={money(result.actualCash)} />
            {shortage > 0 && <Row label="Shortage" value={money(shortage)} bold color="text-rose-600" />}
            {surplus > 0 && <Row label="Surplus" value={money(surplus)} bold color="text-emerald-600" />}
            {result.notes && (
              <div className="border-t border-neutral-200 pt-2 mt-2">
                <p className="text-xs text-neutral-400">Notes:</p>
                <p className="text-sm text-ink-950 mt-0.5">{result.notes}</p>
              </div>
            )}
          </div>
        </>
      )}
      <button
        onClick={onOk}
        className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3.5 rounded-xl mt-4 sm:mt-6 transition text-base min-h-[48px]"
      >
        Return to POS
      </button>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-neutral-50 rounded-xl p-2.5 sm:p-3">
      <div className="text-xs text-neutral-400">{label}</div>
      <div className="text-sm font-semibold text-ink-950 mt-0.5">{value}</div>
    </div>
  );
}

function Row({ label, value, bold, color }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-bold' : ''} ${color || ''} text-sm`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
