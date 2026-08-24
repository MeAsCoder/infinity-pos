// src/components/StockReconciliationModal.jsx
import React, { useState, useMemo } from 'react';

function money(n) { return `KES ${Number(n || 0).toLocaleString()}`; }

export default function StockReconciliationModal({ 
    data, 
    onClose, 
    onSaveNotes,
    loading 
}) {
    const [notes, setNotes] = useState(data?.notes || '');
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');

    if (!data) return null;

    const handleSaveNotes = async () => {
        setSaving(true);
        try {
            await onSaveNotes(data.shift_id, notes);
        } finally {
            setSaving(false);
        }
    };

    const hasSuspicious = data.has_suspicious || data.suspicious_items_count > 0;
    const hasVariance = data.total_variance_units > 0;

    // Filter items based on search term and status filter
    const filteredItems = useMemo(() => {
        if (!data.items) return [];
        
        return data.items.filter(item => {
            // Search filter
            const matchesSearch = item.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                 item.unit_name?.toLowerCase().includes(searchTerm.toLowerCase());
            
            // Status filter
            let matchesStatus = true;
            if (filterStatus === 'suspicious') {
                matchesStatus = item.is_suspicious === true;
            } else if (filterStatus === 'variance') {
                matchesStatus = Math.abs(item.variance) > 0 && !item.is_suspicious;
            } else if (filterStatus === 'ok') {
                matchesStatus = Math.abs(item.variance) === 0 && !item.is_suspicious;
            } else if (filterStatus === 'not_counted') {
                matchesStatus = item.was_counted === false;
            }
            
            return matchesSearch && matchesStatus;
        });
    }, [data.items, searchTerm, filterStatus]);

    // Count items by status for badges
    const statusCounts = useMemo(() => {
        if (!data.items) return { all: 0, suspicious: 0, variance: 0, ok: 0, not_counted: 0 };
        
        return data.items.reduce((acc, item) => {
            acc.all++;
            if (item.is_suspicious) acc.suspicious++;
            else if (Math.abs(item.variance) > 0) acc.variance++;
            else if (item.was_counted === false) acc.not_counted++;
            else acc.ok++;
            return acc;
        }, { all: 0, suspicious: 0, variance: 0, ok: 0, not_counted: 0 });
    }, [data.items]);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[95vh] overflow-y-auto p-3 sm:p-5">
                {/* Header - Compressed */}
                <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-lg font-semibold text-ink-950 flex items-center gap-1.5">
                            📊 Stock Reconciliation
                        </h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            data.status === 'SUSPICIOUS' 
                                ? 'bg-red-100 text-red-700' 
                                : data.status === 'DISCREPANCY'
                                    ? 'bg-amber-100 text-amber-700'
                                    : data.status === 'RECONCILED'
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-yellow-100 text-yellow-700'
                        }`}>
                            {data.status}
                        </span>
                        {data.suspicious_items_count > 0 && (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                                🚨 {data.suspicious_items_count}
                            </span>
                        )}
                    </div>
                    <button 
                        onClick={onClose}
                        className="text-neutral-400 hover:text-neutral-700 text-xl leading-none"
                    >
                        ×
                    </button>
                </div>

                {/* Shift Info - Compressed */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500 mb-2">
                    <span className="font-medium text-ink-950">Shift #{data.shift_id}</span>
                    <span>•</span>
                    <span>{data.waiter_name}</span>
                    <span>•</span>
                    <span>{data.shift_start && new Date(data.shift_start).toLocaleString()}</span>
                    {data.shift_end && (
                        <>
                            <span>→</span>
                            <span>{new Date(data.shift_end).toLocaleString()}</span>
                        </>
                    )}
                </div>

                {/* Info banner - Compressed */}
                {data.stocktake_submitted === false && (
                    <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-xs text-blue-700">
                            ℹ️ Physical stock count not submitted yet — variance and status are not meaningful.
                        </p>
                    </div>
                )}

                {/* Summary Cards - Compressed */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                    <div className="bg-neutral-50 rounded-lg p-2">
                        <p className="text-[10px] text-neutral-500">Expected Revenue</p>
                        <p className="text-base font-bold text-brand">{money(data.total_expected_revenue)}</p>
                    </div>
                    <div className="bg-neutral-50 rounded-lg p-2">
                        <p className="text-[10px] text-neutral-500">Cost of Sales</p>
                        <p className="text-base font-bold text-ink-950">{money(data.total_cost_of_sales)}</p>
                    </div>
                    <div className="bg-neutral-50 rounded-lg p-2">
                        <p className="text-[10px] text-neutral-500">Gross Profit</p>
                        <p className={`text-base font-bold ${data.total_gross_profit > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {money(data.total_gross_profit)}
                        </p>
                    </div>
                    <div className={`bg-neutral-50 rounded-lg p-2 ${data.total_variance_value > 0 ? 'border-l-2 border-red-400' : ''}`}>
                        <p className="text-[10px] text-neutral-500">Potential Fraud</p>
                        <p className={`text-base font-bold ${data.total_variance_value > 0 ? 'text-red-600' : 'text-neutral-500'}`}>
                            {money(data.total_potential_fraud_value || 0)}
                        </p>
                    </div>
                </div>

                {/* Suspicious Alert - Compressed */}
                {hasSuspicious && (
                    <div className="mb-2 p-2 bg-red-50 border border-red-300 rounded-lg">
                        <div className="flex items-start gap-2">
                            <span className="text-lg">🚨</span>
                            <div>
                                <p className="text-xs font-bold text-red-700">
                                    SUSPICIOUS: {data.suspicious_items_count} item(s) | Potential fraud: {money(data.total_potential_fraud_value || 0)}
                                </p>
                                <p className="text-[10px] text-red-600">
                                    Waiter recorded less physical stock than system shows. Investigate immediately.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* ============================================================
                    FILTER AREA - NEW
                ============================================================ */}
                <div className="flex flex-wrap items-center gap-2 mb-2 bg-neutral-50 rounded-lg p-2">
                    {/* Search Input */}
                    <div className="flex-1 min-w-[150px]">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="🔍 Search product or unit..."
                            className="w-full border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
                        />
                    </div>
                    
                    {/* Status Filter Buttons */}
                    <div className="flex flex-wrap gap-1">
                        <button
                            onClick={() => setFilterStatus('all')}
                            className={`text-[10px] px-2 py-1 rounded-full transition ${
                                filterStatus === 'all' 
                                    ? 'bg-brand text-white' 
                                    : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                            }`}
                        >
                            All ({statusCounts.all})
                        </button>
                        <button
                            onClick={() => setFilterStatus('suspicious')}
                            className={`text-[10px] px-2 py-1 rounded-full transition flex items-center gap-0.5 ${
                                filterStatus === 'suspicious' 
                                    ? 'bg-red-600 text-white' 
                                    : 'bg-white border border-neutral-200 text-red-600 hover:bg-red-50'
                            }`}
                        >
                            🚨 Suspicious ({statusCounts.suspicious})
                        </button>
                        <button
                            onClick={() => setFilterStatus('variance')}
                            className={`text-[10px] px-2 py-1 rounded-full transition ${
                                filterStatus === 'variance' 
                                    ? 'bg-amber-600 text-white' 
                                    : 'bg-white border border-neutral-200 text-amber-600 hover:bg-amber-50'
                            }`}
                        >
                            ⚠️ Variance ({statusCounts.variance})
                        </button>
                        <button
                            onClick={() => setFilterStatus('ok')}
                            className={`text-[10px] px-2 py-1 rounded-full transition ${
                                filterStatus === 'ok' 
                                    ? 'bg-emerald-600 text-white' 
                                    : 'bg-white border border-neutral-200 text-emerald-600 hover:bg-emerald-50'
                            }`}
                        >
                            ✅ OK ({statusCounts.ok})
                        </button>
                        <button
                            onClick={() => setFilterStatus('not_counted')}
                            className={`text-[10px] px-2 py-1 rounded-full transition ${
                                filterStatus === 'not_counted' 
                                    ? 'bg-neutral-600 text-white' 
                                    : 'bg-white border border-neutral-200 text-neutral-500 hover:bg-neutral-100'
                            }`}
                        >
                            ⏳ Not Counted ({statusCounts.not_counted})
                        </button>
                    </div>
                    
                    {/* Clear filters */}
                    {(searchTerm || filterStatus !== 'all') && (
                        <button
                            onClick={() => {
                                setSearchTerm('');
                                setFilterStatus('all');
                            }}
                            className="text-[10px] text-neutral-400 hover:text-neutral-600 underline"
                        >
                            Clear
                        </button>
                    )}
                </div>

                {/* Stock Table - Compressed with smaller font/padding */}
                <div className="overflow-x-auto border border-neutral-200 rounded-lg">
                    <table className="w-full text-xs">
                        <thead className="bg-neutral-50">
                            <tr>
                                <th className="p-1.5 text-left font-medium text-neutral-500 uppercase tracking-wider">Product</th>
                                <th className="p-1.5 text-left font-medium text-neutral-500 uppercase tracking-wider">Unit</th>
                                <th className="p-1.5 text-right font-medium text-neutral-500 uppercase tracking-wider">Actual</th>
                                <th className="p-1.5 text-right font-medium text-neutral-500 uppercase tracking-wider">Counted</th>
                                <th className="p-1.5 text-right font-medium text-neutral-500 uppercase tracking-wider">Var</th>
                                <th className="p-1.5 text-right font-medium text-neutral-500 uppercase tracking-wider">Sold</th>
                                <th className="p-1.5 text-right font-medium text-neutral-500 uppercase tracking-wider">Price</th>
                                <th className="p-1.5 text-right font-medium text-neutral-500 uppercase tracking-wider">Revenue</th>
                                <th className="p-1.5 text-right font-medium text-neutral-500 uppercase tracking-wider">COGS</th>
                                <th className="p-1.5 text-right font-medium text-neutral-500 uppercase tracking-wider">Profit</th>
                                <th className="p-1.5 text-center font-medium text-neutral-500 uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                            {filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan="11" className="p-4 text-center text-neutral-400 text-xs">
                                        {searchTerm || filterStatus !== 'all' ? 'No items match your filters' : 'No sales data for this shift'}
                                    </td>
                                </tr>
                            ) : (
                                filteredItems.map((item, idx) => {
                                    const isSuspicious = item.is_suspicious || false;
                                    const hasItemVariance = Math.abs(item.variance) > 0;
                                    
                                    return (
                                        <tr key={`${item.product_id}-${item.selling_unit_id}`} 
                                            className={`hover:bg-neutral-50 transition ${
                                                isSuspicious ? 'bg-red-50/70 border-l-2 border-red-500' : 
                                                hasItemVariance ? 'bg-amber-50/40' : ''
                                            }`}>
                                            <td className="p-1.5">
                                                <div className="font-medium text-ink-950 text-xs truncate max-w-[100px]">{item.product_name}</div>
                                                <div className="text-[10px] text-neutral-400">{item.volume_ml}ml</div>
                                            </td>
                                            <td className="p-1.5">
                                                <span className="text-[10px] bg-neutral-100 px-1.5 py-0.5 rounded">
                                                    {item.unit_name}
                                                </span>
                                            </td>
                                            <td className="p-1.5 text-right font-medium text-xs">{item.actual_stock}</td>
                                            <td className="p-1.5 text-right font-medium text-xs">{item.counted_stock}</td>
                                            <td className="p-1.5 text-right">
                                                <span className={`font-bold text-xs ${
                                                    item.variance > 0 
                                                        ? 'text-red-600' 
                                                        : item.variance < 0 
                                                            ? 'text-emerald-600' 
                                                            : 'text-neutral-500'
                                                }`}>
                                                    {item.variance > 0 ? '+' : ''}{item.variance}
                                                </span>
                                                {item.variance_percentage > 0 && (
                                                    <span className="text-[9px] block text-red-500">
                                                        ({item.variance_percentage}%)
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-1.5 text-right text-xs">{item.quantity_sold}</td>
                                            <td className="p-1.5 text-right text-xs">{money(item.unit_price)}</td>
                                            <td className="p-1.5 text-right font-medium text-brand text-xs">
                                                {money(item.expected_revenue)}
                                            </td>
                                            <td className="p-1.5 text-right text-neutral-600 text-xs">
                                                {money(item.cost_of_sales)}
                                            </td>
                                            <td className={`p-1.5 text-right font-medium text-xs ${
                                                item.gross_profit > 0 ? 'text-emerald-600' : 'text-rose-600'
                                            }`}>
                                                {money(item.gross_profit)}
                                            </td>
                                            <td className="p-1.5 text-center">
                                                {!item.was_counted ? (
                                                    <span className="text-[10px] bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                                        ⏳ Not counted
                                                    </span>
                                                ) : isSuspicious ? (
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold whitespace-nowrap">
                                                            🚨 SUSPICIOUS
                                                        </span>
                                                        <span className="text-[9px] text-red-500">
                                                            Missing: {money(item.variance_value)}
                                                        </span>
                                                    </div>
                                                ) : hasItemVariance ? (
                                                    <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                                        ⚠️ Variance
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                                        ✅ OK
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                        <tfoot className="bg-neutral-50 border-t-2 border-neutral-200">
                            <tr>
                                <td colSpan="9" className="p-1.5 text-right font-semibold text-ink-950 text-xs">
                                    Total Expected Revenue:
                                </td>
                                <td colSpan="2" className="p-1.5 text-right font-bold text-brand text-sm">
                                    {money(data.total_expected_revenue)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {/* Summary Statistics - Compressed */}
                {data.total_variance_units > 0 && (
                    <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                        <div className="bg-red-50 rounded-lg p-1.5 text-center">
                            <p className="text-[9px] text-red-600">Variance Units</p>
                            <p className="text-sm font-bold text-red-700">{data.total_variance_units}</p>
                        </div>
                        <div className="bg-red-50 rounded-lg p-1.5 text-center">
                            <p className="text-[9px] text-red-600">Fraud Value</p>
                            <p className="text-sm font-bold text-red-700">{money(data.total_potential_fraud_value || 0)}</p>
                        </div>
                        <div className="bg-amber-50 rounded-lg p-1.5 text-center">
                            <p className="text-[9px] text-amber-600">Missing Items</p>
                            <p className="text-sm font-bold text-amber-700">{data.missing_stock_items || 0}</p>
                        </div>
                        <div className="bg-amber-50 rounded-lg p-1.5 text-center">
                            <p className="text-[9px] text-amber-600">Suspicious</p>
                            <p className="text-sm font-bold text-amber-700">{data.suspicious_items_count || 0}</p>
                        </div>
                    </div>
                )}

                {/* Notes and Actions - Compressed */}
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                        <label className="block text-xs font-medium text-neutral-700 mb-0.5">
                            Reconciliation Notes
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
                            rows="2"
                            placeholder="Add notes about discrepancies or suspicious items..."
                        />
                    </div>
                    <div className="flex items-end gap-2 justify-end">
                        <button
                            onClick={handleSaveNotes}
                            disabled={saving}
                            className="px-4 py-1.5 bg-brand hover:bg-brand-dark text-white rounded-lg text-xs font-medium transition disabled:opacity-50"
                        >
                            {saving ? 'Saving...' : 'Save Notes'}
                        </button>
                        <button
                            onClick={onClose}
                            className="px-4 py-1.5 border border-neutral-200 hover:bg-neutral-50 rounded-lg text-xs transition"
                        >
                            Close
                        </button>
                    </div>
                </div>

                {/* Discrepancy Alert - Compressed */}
                {hasVariance && !hasSuspicious && (
                    <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-start gap-1.5">
                            <span className="text-amber-600 text-sm">⚠️</span>
                            <div>
                                <p className="text-xs font-medium text-amber-700">
                                    {data.items?.filter(i => Math.abs(i.variance) > 0).length || 0} item(s) have variances
                                </p>
                                <p className="text-[10px] text-amber-600">
                                    Total variance value: {money(data.total_variance_value)}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}