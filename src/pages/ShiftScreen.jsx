// ShiftScreen.jsx - Updated with cash counting fields
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
    <div className="max-w-4xl mx-auto p-4">
      <button 
        onClick={() => navigate('/pos')} 
        className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-ink-950 mb-4 font-medium"
      >
        <IconArrowLeft className="w-4 h-4" /> Back to POS
      </button>
      
      <EndShiftForm 
        shift={shift} 
        report={report} 
        online={online} 
        user={user}
        onClosed={(r) => handleClosed(r, shift.id)} 
        onManageTabs={() => navigate('/pos', { state: { view: 'tabs' } })} 
        onRefresh={loadShift}
      />
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
    <div className="max-w-sm mx-auto mt-14 bg-white rounded-2xl shadow-card p-7">
      <h2 className="font-display text-2xl font-semibold text-ink-950 mb-1">Start Shift</h2>
      <p className="text-sm text-neutral-500 mb-5">Count your float before you begin.</p>
      {err && (
        <div className="bg-rose-50 text-rose-700 text-sm rounded-lg p-3 mb-4 border border-rose-100">
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
        className="w-full border border-neutral-200 rounded-xl px-4 py-3.5 text-lg mb-5 focus:border-brand focus:ring-1 focus:ring-brand outline-none transition" 
        placeholder="0" 
      />
      <button 
        disabled={busy} 
        onClick={start} 
        className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3.5 rounded-xl disabled:opacity-50 transition shadow-soft"
      >
        {busy ? 'Starting…' : 'Start Shift'}
      </button>
      {!navigator.onLine && (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2.5 mt-3.5">
          Offline — the shift will start locally and sync once you're back online.
        </p>
      )}
    </div>
  );
}

// ============================================================================
// END SHIFT FORM - WITH CASH COUNTING FIELDS
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
  const [showPatternModal, setShowPatternModal] = useState(false);
  const [patterns, setPatterns] = useState([]);
  
  // Debt/Unsettled bill state
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

  // Handle recording a tab as debt
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

      // Remove the tab from open tabs
      await db.openTabs.where('localId').equals(saleId).delete();
      
      // Refresh the open tabs list
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

  // Close shift
  async function submit() {
    setErr('');
    setOpenTabsBlocking(null);
    
    // Check if there are open tabs blocking
    if (openTabsBlocking && openTabsBlocking.length > 0) {
      setErr('Please settle or record all open tabs as debt before closing.');
      return;
    }
    
    // Validate cash count - required!
    if (actualCash === '') {
      setErr('Please count and enter the physical cash in the drawer.');
      return;
    }
    
    // Close shift
    await closeShift();
  }

  // Close the shift
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

  // Fetch open tabs when the component mounts or when shift changes
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
    <div className="bg-white rounded-2xl shadow-card p-6 sm:p-7">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink-950">
            Shift #{shift.id}
          </h2>
          <p className="text-sm text-neutral-500">
            Started {new Date(shift.started_at).toLocaleString()}
            {shift._pendingSync && ' (pending sync)'}
          </p>
        </div>
        <button 
          onClick={refreshData} 
          disabled={isRefreshing}
          className="text-sm text-brand hover:text-brand-dark font-medium disabled:opacity-50"
        >
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Open Bills/Tabs Warning */}
      {openTabsBlocking && openTabsBlocking.length > 0 && (
        <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 mb-5">
          <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm mb-2">
            <IconAlert className="w-4 h-4" /> {openTabsBlocking.length} bill(s) still open
          </div>
          <p className="text-xs text-amber-700 mb-3">
            You must either settle these bills or record them as debt before closing the shift.
          </p>
          <div className="space-y-2 mb-3 max-h-60 overflow-y-auto">
            {openTabsBlocking.map(t => {
              const tabId = t.localId || t.id;
              return (
                <div key={tabId} className="flex justify-between items-center text-sm bg-white rounded-lg px-3 py-2">
                  <div>
                    <span className="text-ink-950 font-medium">{t.tab_label || t.receipt_number || `Bill #${tabId}`}</span>
                    <span className="text-neutral-400 text-xs ml-2">{t.items?.length || 0} items</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{money(t.total || 0)}</span>
                    <button
                      onClick={() => {
                        const selected = { ...t, localId: tabId };
                        setSelectedTab(selected);
                        setShowDebtModal(true);
                        setErr('');
                        setDebtSuccess('');
                      }}
                      className="text-xs bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded-lg transition"
                    >
                      Record as Debt
                    </button>
                    <button
                      onClick={() => {
                        onManageTabs();
                      }}
                      className="text-xs bg-brand hover:bg-brand-dark text-white px-3 py-1 rounded-lg transition"
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
            className="w-full bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold py-2.5 rounded-lg transition"
          >
            Go to Open Bills
          </button>
        </div>
      )}

      {/* Shift Statistics */}
      {totals && (
        <div className="grid grid-cols-2 gap-3 mb-5 text-sm">
          <Stat label="Transactions" value={totals.count} />
          <Stat label="Revenue" value={money(totals.revenue)} />
          <Stat label="Opening float" value={money(shift.opening_float)} />
          <Stat label="Discounts given" value={money(totals.discounts)} />
          <Stat label="Cash Sales" value={money(totals.cash || 0)} />
          <Stat label="Credit/Debt Sales" value={money(totals.credit || 0)} />
        </div>
      )}
      {!report && (
        <div className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2.5 mb-5">
          {online ? 'Loading shift report...' : 'Live totals unavailable offline — figures will be finalized once this device is back online.'}
        </div>
      )}

      {/* Cash Counting Section - BLIND COUNT (no expected cash shown yet) */}
      <div className="space-y-4 mb-5">
        <div className="border-b border-neutral-200 pb-2">
          <h3 className="font-semibold text-ink-950 flex items-center gap-2">
            <IconCash className="w-4 h-4" /> Count Cash
          </h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Enter the physical cash, mobile money, and card payments you received. 
            The system will calculate the expected amount after you submit.
          </p>
        </div>
        
        <div>
          <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5">
            Physical cash counted <span className="text-rose-500">*</span>
          </label>
          <input 
            type="number" 
            value={actualCash} 
            onChange={e => setActualCash(e.target.value)} 
            autoFocus 
            className="w-full border border-neutral-200 rounded-xl px-4 py-3.5 text-lg focus:border-brand focus:ring-1 focus:ring-brand outline-none transition" 
            placeholder="0.00"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5">
              Mobile money received
            </label>
            <input 
              type="number" 
              value={actualMobile} 
              onChange={e => setActualMobile(e.target.value)} 
              className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 focus:border-brand outline-none transition" 
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5">
              Card / PDQ received
            </label>
            <input 
              type="number" 
              value={actualCard} 
              onChange={e => setActualCard(e.target.value)} 
              className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 focus:border-brand outline-none transition" 
              placeholder="0.00"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5">
            Notes (optional)
          </label>
          <textarea 
            value={notes} 
            onChange={e => setNotes(e.target.value)} 
            className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 focus:border-brand outline-none transition" 
            rows={2} 
            placeholder="Any issues, discrepancies, or notes about this shift..."
          />
        </div>
      </div>

      {err && (
        <div className="bg-rose-50 text-rose-700 text-sm rounded-lg p-3 mb-4 border border-rose-100">
          {err}
        </div>
      )}

      <div className="bg-neutral-50 rounded-xl p-4 mb-5 text-sm">
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
        className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3.5 rounded-xl disabled:opacity-50 transition shadow-soft"
      >
        {busy ? 'Processing...' : 'Close Shift'}
      </button>
      
      {openTabsBlocking && openTabsBlocking.length > 0 && (
        <p className="text-xs text-amber-700 text-center mt-2">
          Please settle all open bills or record them as debt before closing the shift.
        </p>
      )}

      {/* Debt Recording Modal */}
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
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-display text-xl font-semibold text-ink-950 flex items-center gap-2">
              <IconCredit className="w-5 h-5 text-amber-600" />
              Record as Debt
            </h3>
            <p className="text-sm text-neutral-500 mt-1">
              {tab.tab_label || tab.receipt_number || `Bill #${tab.localId || tab.id}`} — {money(tab.total || 0)}
            </p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
            <IconClose className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2 text-emerald-700">
              <IconCheck className="w-5 h-5" />
              <span className="text-sm font-medium">{success}</span>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
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
              <div className="bg-rose-50 text-rose-700 text-sm rounded-lg p-3 mb-4 border border-rose-100">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5">
                  Customer Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <IconUser className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={customer.name}
                    onChange={e => setCustomer(c => ({ ...c, name: e.target.value }))}
                    placeholder="e.g. John Doe"
                    className="w-full border border-neutral-200 rounded-xl pl-10 pr-4 py-2.5 focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5">
                  Phone Number
                </label>
                <div className="relative">
                  <IconPhone className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={customer.phone}
                    onChange={e => setCustomer(c => ({ ...c, phone: e.target.value }))}
                    placeholder="e.g. 0712 345 678"
                    className="w-full border border-neutral-200 rounded-xl pl-10 pr-4 py-2.5 focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5">
                  Notes (optional)
                </label>
                <textarea
                  value={customer.notes}
                  onChange={e => setCustomer(c => ({ ...c, notes: e.target.value }))}
                  placeholder="Any additional details about this customer or the situation..."
                  className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
                  rows={2}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 border border-neutral-200 rounded-xl py-2.5 text-neutral-600 font-medium hover:bg-neutral-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={onConfirm}
                  disabled={busy || !customer.name.trim()}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl py-2.5 transition disabled:opacity-50"
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
  const hasVariance = result.variance !== 0;
  
  return (
    <div className="max-w-sm mx-auto mt-14 bg-white rounded-2xl shadow-card p-7 text-center">
      <div className={`w-14 h-14 rounded-full mx-auto flex items-center justify-center mb-4 ${
        result.pendingSync ? 'bg-amber-100' : shortage > 0 ? 'bg-rose-100' : surplus > 0 ? 'bg-emerald-100' : 'bg-emerald-100'
      }`}>
        {result.pendingSync ? 
          <IconAlert className="w-6 h-6 text-amber-600" /> : 
          shortage > 0 ? 
            <IconAlert className="w-6 h-6 text-rose-600" /> : 
            <IconCheck className="w-6 h-6 text-emerald-600" />
        }
      </div>
      <h2 className="font-display text-xl font-semibold text-ink-950 mb-2">Shift Closed</h2>
      {result.pendingSync ? (
        <p className="text-neutral-500 text-sm">{result.message}</p>
      ) : (
        <>
          <p className={`text-sm font-medium mb-4 ${shortage > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            {shortage > 0 ? `⚠️ Shortage of ${money(shortage)}` : 
             surplus > 0 ? `✅ Surplus of ${money(surplus)}` : 
             '✅ Perfect balance!'}
          </p>
          <div className="text-left bg-neutral-50 rounded-xl p-4 space-y-1.5 text-sm mt-3">
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
        className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3.5 rounded-xl mt-6 transition"
      >
        Return to POS
      </button>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-neutral-50 rounded-xl p-3">
      <div className="text-neutral-400 text-xs">{label}</div>
      <div className="font-semibold text-ink-950 mt-0.5">{value}</div>
    </div>
  );
}

function Row({ label, value, bold, color }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-bold' : ''} ${color || ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}