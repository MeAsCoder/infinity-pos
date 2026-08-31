import React, { useEffect, useState, useMemo } from 'react';
import { api, apiFetch, OfflineError } from '../api/client';
import { enqueue } from '../db/offlineDb';
import { IconPlus, IconClose } from '../components/Icons';

// Mobile-responsiveness pass:
// 1. The All/Owing/Settled filter buttons sat in a plain `flex gap-1` with
//    no wrap and no overflow-x-auto. If that cluster didn't fit next to the
//    search box on a narrow phone, flex would shrink the buttons instead of
//    wrapping them, clipping labels like "Owing (12)". Now wraps onto a new
//    line instead.
// 2. text-[10px] labels (customer ID, status badges, ledger timestamps)
//    bumped to text-xs for legibility.
// 3. Drawer inputs (repayment amount, write-off fields, new-customer form)
//    bumped from text-sm (14px) to text-base (16px) to stop iOS auto-zoom.
// 4. Small action buttons/links given real touch-target height.
// Table kept as horizontally-scrolling, consistent with the other admin
// pages already adjusted.

function money(n) { return `KES ${Number(n || 0).toLocaleString()}`; }

export default function Credit() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => { load(); }, [search]);

  async function load() {
    setLoading(true);
    try {
      const data = await api.customers(search ? `?search=${encodeURIComponent(search)}` : '');
      setCustomers(data || []);
    } catch (e) {
      console.error('Error loading customers:', e);
    } finally {
      setLoading(false);
    }
  }

  // Filter customers
  const filteredCustomers = useMemo(() => {
    let result = customers;

    if (filterStatus === 'owing') {
      result = result.filter(c => c.balance > 0);
    } else if (filterStatus === 'settled') {
      result = result.filter(c => c.balance <= 0);
    }

    return result;
  }, [customers, filterStatus]);

  const totalOutstanding = customers.reduce((s, c) => s + Math.max(c.balance, 0), 0);
  const totalCustomers = customers.length;
  const owingCustomers = customers.filter(c => c.balance > 0).length;
  const settledCustomers = customers.filter(c => c.balance <= 0).length;

  return (
    <div className="p-3 sm:p-5 lg:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:justify-between sm:items-center gap-3 mb-4">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-semibold text-ink-950 flex items-center gap-2">
            Credit Book
            <span className="text-sm font-normal text-neutral-400 bg-neutral-100 px-2.5 py-0.5 rounded-full">
              {totalCustomers}
            </span>
          </h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-neutral-500">
            <span>💰 Total Outstanding: <span className="font-semibold text-ink-950">{money(totalOutstanding)}</span></span>
            <span>🔴 {owingCustomers} owing</span>
            <span>🟢 {settledCustomers} settled</span>
          </div>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center justify-center gap-1.5 bg-brand hover:bg-brand-dark text-white px-4 py-3 rounded-xl text-sm font-semibold shadow-soft transition min-h-[48px] w-full sm:w-auto"
        >
          <IconPlus className="w-4 h-4" /> New Customer
        </button>
      </div>

      {/* Filters */}
      <div className="space-y-2 mb-4 bg-white rounded-xl shadow-sm p-2.5 border border-neutral-100">
        {/* Search */}
        <div className="relative">
          <span className="text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2">🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or phone..."
            className="w-full border border-neutral-200 rounded-lg pl-9 pr-3 py-2.5 text-base bg-neutral-50 focus:bg-white focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Status Filter — flex-wrap so the 3 buttons drop to a new line
              instead of shrinking and clipping their labels on a narrow phone */}
          <button
            onClick={() => setFilterStatus('all')}
            className={`text-xs px-3 py-2 rounded-lg transition min-h-[36px] whitespace-nowrap ${
              filterStatus === 'all'
                ? 'bg-brand text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            All ({totalCustomers})
          </button>
          <button
            onClick={() => setFilterStatus('owing')}
            className={`text-xs px-3 py-2 rounded-lg transition min-h-[36px] whitespace-nowrap ${
              filterStatus === 'owing'
                ? 'bg-red-600 text-white'
                : 'bg-neutral-100 text-red-600 hover:bg-red-50'
            }`}
          >
            Owing ({owingCustomers})
          </button>
          <button
            onClick={() => setFilterStatus('settled')}
            className={`text-xs px-3 py-2 rounded-lg transition min-h-[36px] whitespace-nowrap ${
              filterStatus === 'settled'
                ? 'bg-emerald-600 text-white'
                : 'bg-neutral-100 text-emerald-600 hover:bg-emerald-50'
            }`}
          >
            Settled ({settledCustomers})
          </button>

          {/* Clear filters */}
          {(search || filterStatus !== 'all') && (
            <button
              onClick={() => { setSearch(''); setFilterStatus('all'); }}
              className="text-xs text-neutral-400 hover:text-neutral-600 underline whitespace-nowrap min-h-[36px] px-1"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Customer Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-neutral-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand mx-auto"></div>
            <p className="mt-3 text-sm">Loading customers...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-neutral-400">
            <p className="text-sm">
              {search || filterStatus !== 'all' ? 'No customers match your filters' : 'No customers yet'}
            </p>
            {(search || filterStatus !== 'all') && (
              <button
                onClick={() => { setSearch(''); setFilterStatus('all'); }}
                className="mt-2 text-brand text-sm font-medium hover:underline min-h-[36px]"
              >
                Clear filters
              </button>
            )}
            {!search && filterStatus === 'all' && (
              <button
                onClick={() => setShowNew(true)}
                className="mt-2 text-brand text-sm font-medium hover:underline min-h-[36px]"
              >
                Create your first customer
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 border-b border-neutral-100">
                <tr className="text-left text-xs text-neutral-500 uppercase tracking-wider">
                  <th className="p-3 font-medium whitespace-nowrap">Customer</th>
                  <th className="p-3 font-medium whitespace-nowrap">Phone</th>
                  <th className="p-3 font-medium whitespace-nowrap">Address</th>
                  <th className="p-3 text-right font-medium whitespace-nowrap">Credit Limit</th>
                  <th className="p-3 text-right font-medium whitespace-nowrap">Balance</th>
                  <th className="p-3 text-center font-medium whitespace-nowrap">Status</th>
                  <th className="p-3 text-center font-medium whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredCustomers.map(c => {
                  const isOwing = c.balance > 0;
                  const statusColor = isOwing ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700';
                  const statusText = isOwing ? 'Owing' : 'Settled';

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-neutral-50/80 transition cursor-pointer"
                      onClick={() => setSelected(c)}
                    >
                      <td className="p-3 whitespace-nowrap">
                        <div className="font-medium text-ink-950">{c.name}</div>
                        <div className="text-xs text-neutral-400">ID: #{c.id}</div>
                      </td>
                      <td className="p-3 text-neutral-600 whitespace-nowrap">
                        {c.phone || '—'}
                      </td>
                      <td className="p-3 text-neutral-600 text-sm whitespace-nowrap">
                        {c.address || '—'}
                      </td>
                      <td className="p-3 text-right font-medium text-ink-950 whitespace-nowrap">
                        {money(c.creditLimit || 0)}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <span className={`font-bold ${isOwing ? 'text-red-600' : 'text-emerald-600'}`}>
                          {money(c.balance)}
                        </span>
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor}`}>
                          {statusText}
                        </span>
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <button
                          className="text-brand text-xs font-medium hover:underline min-h-[36px] px-2"
                          onClick={(e) => { e.stopPropagation(); setSelected(c); }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-neutral-50 border-t-2 border-neutral-200">
                <tr>
                  <td colSpan="3" className="p-3 font-semibold text-ink-950 text-sm whitespace-nowrap">
                    Total Outstanding:
                  </td>
                  <td colSpan="4" className="p-3 text-right font-bold text-red-600 text-sm whitespace-nowrap">
                    {money(totalOutstanding)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Customer Drawer */}
      {selected && (
        <CustomerDrawer
          customer={selected}
          onClose={() => setSelected(null)}
          onChanged={() => { setSelected(null); load(); }}
        />
      )}

      {/* New Customer Drawer */}
      {showNew && (
        <NewCustomerDrawer
          onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); load(); }}
        />
      )}
    </div>
  );
}

// ============================================================================
// CUSTOMER DRAWER
// ============================================================================
function CustomerDrawer({ customer, onClose, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [writeoffReason, setWriteoffReason] = useState('');
  const [showWriteoff, setShowWriteoff] = useState(false);
  const [activeTab, setActiveTab] = useState('ledger');

  useEffect(() => {
    api.customer(customer.id).then(setDetail).catch(() => {});
  }, [customer.id]);

  async function repay() {
    if (!amount || Number(amount) <= 0) {
      setErr('Please enter a valid amount');
      return;
    }
    setBusy(true); setMsg(''); setErr('');
    const clientUuid = crypto.randomUUID();
    const payload = { customerId: customer.id, amount: Number(amount), notes: 'Repayment via Credit screen' };
    try {
      if (navigator.onLine) {
        await apiFetch(`/api/customers/${customer.id}/repay`, { method: 'POST', body: { amount: Number(amount), clientUuid } });
        setMsg('✅ Repayment recorded successfully.');
      } else {
        await enqueue('CREDIT_REPAYMENT', clientUuid, { customerId: customer.id, amount: Number(amount), clientUuid });
        setMsg('💾 Saved offline — will sync automatically.');
      }
      setAmount('');
      onChanged();
    } catch (e) {
      if (e instanceof OfflineError) {
        await enqueue('CREDIT_REPAYMENT', clientUuid, { customerId: customer.id, amount: Number(amount), clientUuid });
        setMsg('💾 Saved offline — will sync automatically.');
        onChanged();
      } else {
        setErr(e.message);
      }
    } finally { setBusy(false); }
  }

  async function writeOff() {
    if (!amount || !writeoffReason) {
      setErr('Please enter amount and reason');
      return;
    }
    setBusy(true); setErr('');
    try {
      await api.writeOff(customer.id, { amount: Number(amount), reason: writeoffReason });
      setMsg('✅ Write-off completed.');
      setTimeout(() => onChanged(), 1000);
    } catch (e) {
      setErr(e.message);
    } finally { setBusy(false); }
  }

  const isOwing = customer.balance > 0;

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-end z-50" onClick={onClose}>
      <div className="bg-white w-full sm:w-[460px] h-full overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 border-b border-neutral-100 p-4">
          <div className="flex justify-between items-start gap-2">
            <div className="flex-1 min-w-0">
              <h2 className="font-display text-lg font-semibold text-ink-950 truncate">{customer.name}</h2>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-400 mt-0.5">
                <span>{customer.phone || 'No phone'}</span>
                <span>•</span>
                <span>ID: #{customer.id}</span>
                <span>•</span>
                <span className={isOwing ? 'text-red-600' : 'text-emerald-600'}>
                  {isOwing ? 'Owing' : 'Settled'}
                </span>
              </div>
            </div>
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 w-9 h-9 flex items-center justify-center shrink-0">
              <IconClose className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-3">
            <button
              onClick={() => setActiveTab('ledger')}
              className={`px-3 py-2 text-xs font-medium rounded-lg transition min-h-[36px] ${
                activeTab === 'ledger'
                  ? 'bg-brand text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              Ledger
            </button>
            <button
              onClick={() => setActiveTab('payment')}
              className={`px-3 py-2 text-xs font-medium rounded-lg transition min-h-[36px] ${
                activeTab === 'payment'
                  ? 'bg-brand text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              Make Payment
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4">
          {err && (
            <div className="bg-rose-50 text-rose-700 text-sm rounded-lg p-3 mb-4 border border-rose-100">
              {err}
            </div>
          )}
          {msg && (
            <div className="bg-emerald-50 text-emerald-700 text-sm rounded-lg p-3 mb-4 border border-emerald-100">
              {msg}
            </div>
          )}

          {/* Balance Summary */}
          <div className="bg-neutral-50 rounded-xl p-4 mb-4 text-center">
            <div className="text-xs text-neutral-500 font-medium uppercase tracking-wider">Outstanding Balance</div>
            <div className={`text-2xl sm:text-3xl font-bold ${isOwing ? 'text-red-600' : 'text-emerald-600'}`}>
              {money(customer.balance)}
            </div>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-0.5 mt-1 text-xs text-neutral-400">
              <span>Limit: {money(customer.creditLimit || 0)}</span>
              <span className="hidden sm:inline">•</span>
              <span>Available: {money(Math.max(0, (customer.creditLimit || 0) - customer.balance))}</span>
            </div>
          </div>

          {activeTab === 'payment' && (
            <div className="space-y-3">
              {!showWriteoff ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1">Repayment Amount</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        className="flex-1 border border-neutral-200 rounded-lg px-3 py-2.5 text-base focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
                        placeholder="0.00"
                        autoFocus
                      />
                      <button
                        disabled={busy || !amount}
                        onClick={repay}
                        className="bg-brand hover:bg-brand-dark text-white px-5 rounded-lg font-semibold text-sm transition disabled:opacity-50 min-h-[44px]"
                      >
                        {busy ? '...' : 'Pay'}
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowWriteoff(true)}
                    className="text-xs text-red-500 hover:text-red-700 transition min-h-[36px]"
                  >
                    Write off debt instead
                  </button>
                </>
              ) : (
                <div className="border border-neutral-200 rounded-lg p-3 space-y-2 bg-amber-50">
                  <p className="text-xs text-amber-700 font-medium">⚠️ Write Off Debt</p>
                  <input
                    placeholder="Reason (required)"
                    value={writeoffReason}
                    onChange={e => setWriteoffReason(e.target.value)}
                    className="w-full border border-neutral-200 rounded-lg px-2.5 py-2.5 text-base focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Amount"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      className="flex-1 border border-neutral-200 rounded-lg px-2.5 py-2.5 text-base focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
                    />
                    <button
                      disabled={busy}
                      onClick={writeOff}
                      className="bg-red-500 hover:bg-red-600 text-white px-4 rounded-lg text-sm font-semibold transition disabled:opacity-50 min-h-[44px]"
                    >
                      {busy ? '...' : 'Write Off'}
                    </button>
                  </div>
                  <button
                    onClick={() => { setShowWriteoff(false); setWriteoffReason(''); }}
                    className="text-xs text-neutral-400 hover:text-neutral-600 transition min-h-[36px]"
                  >
                    ← Back to repayment
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'ledger' && (
            <div>
              <h3 className="font-semibold text-xs uppercase tracking-wider text-neutral-400 mb-2">Transaction History</h3>
              <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-lg overflow-hidden">
                {(detail?.ledger || []).length === 0 ? (
                  <div className="p-4 text-center text-neutral-400 text-sm">
                    No transactions yet
                  </div>
                ) : (
                  (detail?.ledger || []).map(l => {
                    const isCredit = l.type === 'SALE' || l.type === 'DEBT';
                    return (
                      <div key={l.id} className="flex flex-wrap justify-between items-center gap-2 p-3 hover:bg-neutral-50 transition">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-ink-950">{l.type}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${isCredit ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                              {isCredit ? 'Debit' : 'Credit'}
                            </span>
                          </div>
                          <div className="text-xs text-neutral-400 mt-0.5">
                            {new Date(l.created_at).toLocaleString()}
                            {l.notes && ` · ${l.notes}`}
                          </div>
                        </div>
                        <div className={`font-bold text-sm shrink-0 ${isCredit ? 'text-red-600' : 'text-emerald-600'}`}>
                          {isCredit ? '' : '-'}{money(l.amount)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// NEW CUSTOMER DRAWER
// ============================================================================
function NewCustomerDrawer({ onClose, onSaved }) {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    address: '',
    creditLimit: ''
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    if (!form.name.trim()) {
      setErr('Customer name is required');
      return;
    }
    setBusy(true); setErr('');
    try {
      await api.createCustomer({
        ...form,
        creditLimit: Number(form.creditLimit) || 0
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
      <div className="bg-white w-full sm:w-[420px] h-full overflow-y-auto shadow-2xl p-4 sm:p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-5 gap-2">
          <div>
            <h2 className="font-display text-lg sm:text-xl font-semibold text-ink-950">New Customer</h2>
            <p className="text-sm text-neutral-400 mt-0.5">Add a customer to the credit book</p>
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

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-neutral-500 mb-1 block">Customer Name *</label>
            <input
              placeholder="e.g. John Doe"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-base focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-medium text-neutral-500 mb-1 block">Phone Number</label>
            <input
              placeholder="e.g. 0712 345 678"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-base focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-neutral-500 mb-1 block">Address</label>
            <input
              placeholder="e.g. Nairobi, CBD"
              value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-base focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-neutral-500 mb-1 block">Credit Limit (KES)</label>
            <input
              type="number"
              placeholder="5000"
              value={form.creditLimit}
              onChange={e => setForm(f => ({ ...f, creditLimit: e.target.value }))}
              className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-base focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
            />
            <p className="text-xs text-neutral-400 mt-0.5">Default: 0 (no credit limit)</p>
          </div>
        </div>

        <button
          disabled={busy || !form.name}
          onClick={save}
          className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-xl text-base mt-5 transition disabled:opacity-50 min-h-[48px]"
        >
          {busy ? 'Creating...' : 'Create Customer'}
        </button>
      </div>
    </div>
  );
}