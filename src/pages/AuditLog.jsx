import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../api/client';
import { IconCheck, IconClose, IconAlert } from '../components/Icons';

export default function AuditLog() {
  const [tab, setTab] = useState('log');
  
  return (
    <div className="p-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-950">Audit &amp; Corrections</h1>
          <p className="text-sm text-neutral-500">Track system activity and manage correction requests</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 bg-white rounded-xl p-1 border border-neutral-200 overflow-x-auto">
        <button 
          onClick={() => setTab('log')} 
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
            tab === 'log' ? 'bg-brand text-white' : 'text-neutral-600 hover:bg-neutral-50'
          }`}
        >
          Audit Log
        </button>
        <button 
          onClick={() => setTab('corrections')} 
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
            tab === 'corrections' ? 'bg-brand text-white' : 'text-neutral-600 hover:bg-neutral-50'
          }`}
        >
          Correction Requests
        </button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl shadow-sm border border-neutral-100 overflow-hidden">
        {tab === 'log' ? <LogView /> : <CorrectionsView />}
      </div>
    </div>
  );
}

// ============================================================================
// AUDIT LOG VIEW
// ============================================================================
function LogView() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterEvent, setFilterEvent] = useState('all');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await api.auditLog();
      setRows(data || []);
    } catch (e) {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  // Helper function to format time in Kenyan timezone
  const formatKenyanTime = (timestamp) => {
    if (!timestamp) return '—';
    return new Date(timestamp).toLocaleString('en-KE', {
      timeZone: 'Africa/Nairobi',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  // Get unique events for filter
  const eventTypes = useMemo(() => {
    const events = new Set(rows.map(r => r.event).filter(Boolean));
    return ['all', ...Array.from(events)];
  }, [rows]);

  // Filter rows
  const filteredRows = useMemo(() => {
    let result = rows;
    
    if (filterEvent !== 'all') {
      result = result.filter(r => r.event === filterEvent);
    }
    
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r => 
        r.event?.toLowerCase().includes(q) ||
        r.user_name?.toLowerCase().includes(q) ||
        r.entity_type?.toLowerCase().includes(q) ||
        r.reason?.toLowerCase().includes(q)
      );
    }
    
    return result;
  }, [rows, filterEvent, search]);

  if (loading) {
    return (
      <div className="p-6 text-center text-neutral-400 text-sm">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand mx-auto"></div>
        <p className="mt-2">Loading audit log...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-neutral-100">
        <div className="flex-1 min-w-[140px] relative">
          <span className="text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 text-xs">🔍</span>
          <input 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Search audit log..." 
            className="w-full border border-neutral-200 rounded-lg pl-7 pr-2.5 py-1.5 text-xs focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
          />
        </div>
        
        <select
          value={filterEvent}
          onChange={e => setFilterEvent(e.target.value)}
          className="border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
        >
          {eventTypes.map(event => (
            <option key={event} value={event}>
              {event === 'all' ? 'All Events' : event}
            </option>
          ))}
        </select>
        
        {(search || filterEvent !== 'all') && (
          <button
            onClick={() => { setSearch(''); setFilterEvent('all'); }}
            className="text-xs text-neutral-400 hover:text-neutral-600 underline whitespace-nowrap"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      {filteredRows.length === 0 ? (
        <div className="p-8 text-center text-neutral-400 text-sm">
          {search || filterEvent !== 'all' ? 'No events match your filters' : 'No audit events yet'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr className="text-left text-neutral-500 font-medium">
                <th className="p-2">Time</th>
                <th className="p-2">Event</th>
                <th className="p-2">User</th>
                <th className="p-2">Entity</th>
                <th className="p-2">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredRows.map(r => (
                <tr key={r.id} className="hover:bg-neutral-50/60 transition">
                  <td className="p-2 whitespace-nowrap text-neutral-500 text-[10px]">
                    {formatKenyanTime(r.created_at)}
                  </td>
                  <td className="p-2 font-medium text-ink-950 text-xs">
                    <span className="text-[10px] bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded">
                      {r.event}
                    </span>
                  </td>
                  <td className="p-2">
                    <span className="text-xs text-ink-950">{r.user_name || '—'}</span>
                    <span className="text-[10px] text-neutral-400 ml-1">{r.role}</span>
                  </td>
                  <td className="p-2 text-neutral-500 text-xs">
                    {r.entity_type} {r.entity_id ? `#${r.entity_id}` : ''}
                  </td>
                  <td className="p-2 text-neutral-500 text-xs max-w-[150px] truncate">
                    {r.reason || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CORRECTIONS VIEW
// ============================================================================
function CorrectionsView() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await api.corrections();
      setRows(data || []);
    } catch (e) {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function resolve(id, status) {
    const notes = status === 'REJECTED' ? prompt('Reason for rejecting (optional):') || '' : '';
    if (status === 'REJECTED' && !notes) {
      alert('Please provide a reason for rejection.');
      return;
    }
    try {
      await api.resolveCorrection(id, { status, resolutionNotes: notes });
      load();
    } catch (e) {
      alert('Failed to resolve correction: ' + e.message);
    }
  }

  // Helper function to format time in Kenyan timezone
  const formatKenyanTime = (timestamp) => {
    if (!timestamp) return '—';
    return new Date(timestamp).toLocaleString('en-KE', {
      timeZone: 'Africa/Nairobi',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  // Filter rows
  const filteredRows = useMemo(() => {
    if (filterStatus === 'all') return rows;
    return rows.filter(r => r.status === filterStatus);
  }, [rows, filterStatus]);

  const counts = useMemo(() => {
    return {
      all: rows.length,
      pending: rows.filter(r => r.status === 'PENDING').length,
      approved: rows.filter(r => r.status === 'APPROVED').length,
      rejected: rows.filter(r => r.status === 'REJECTED').length,
    };
  }, [rows]);

  if (loading) {
    return (
      <div className="p-6 text-center text-neutral-400 text-sm">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand mx-auto"></div>
        <p className="mt-2">Loading correction requests...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Status Filters */}
      <div className="flex flex-wrap items-center gap-1.5 p-3 border-b border-neutral-100">
        <span className="text-[10px] text-neutral-400 font-medium">Status:</span>
        <button
          onClick={() => setFilterStatus('all')}
          className={`text-[10px] px-2 py-0.5 rounded transition ${
            filterStatus === 'all' ? 'bg-gray-800 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
          }`}
        >
          All ({counts.all})
        </button>
        <button
          onClick={() => setFilterStatus('PENDING')}
          className={`text-[10px] px-2 py-0.5 rounded transition ${
            filterStatus === 'PENDING' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'
          }`}
        >
          Pending ({counts.pending})
        </button>
        <button
          onClick={() => setFilterStatus('APPROVED')}
          className={`text-[10px] px-2 py-0.5 rounded transition ${
            filterStatus === 'APPROVED' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
          }`}
        >
          Approved ({counts.approved})
        </button>
        <button
          onClick={() => setFilterStatus('REJECTED')}
          className={`text-[10px] px-2 py-0.5 rounded transition ${
            filterStatus === 'REJECTED' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-600 hover:bg-rose-100'
          }`}
        >
          Rejected ({counts.rejected})
        </button>
        {filterStatus !== 'all' && (
          <button
            onClick={() => setFilterStatus('all')}
            className="text-[10px] text-neutral-400 hover:text-neutral-600 underline"
          >
            clear
          </button>
        )}
      </div>

      {/* Correction Requests List */}
      {filteredRows.length === 0 ? (
        <div className="p-8 text-center text-neutral-400 text-sm">
          {filterStatus !== 'all' ? 'No corrections with this status' : 'No correction requests'}
        </div>
      ) : (
        <div className="divide-y divide-neutral-100">
          {filteredRows.map(r => {
            const statusColors = {
              PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
              APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
              REJECTED: 'bg-rose-50 text-rose-700 border-rose-200'
            };
            
            const statusIcons = {
              PENDING: '⏳',
              APPROVED: '✓',
              REJECTED: '✕'
            };

            return (
              <div key={r.id} className="p-3 hover:bg-neutral-50/60 transition">
                <div className="flex flex-wrap justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-ink-950">
                        {r.type} — {r.ref_type} #{r.ref_id}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${statusColors[r.status] || 'bg-neutral-100 text-neutral-600 border-neutral-200'}`}>
                        {statusIcons[r.status]} {r.status}
                      </span>
                    </div>
                    <div className="text-[10px] text-neutral-400 mt-0.5">
                      by {r.requested_by_name} · {formatKenyanTime(r.created_at)}
                    </div>
                    <div className="text-xs text-neutral-600 mt-1">{r.reason}</div>
                    {r.resolution_notes && (
                      <div className="text-[10px] text-neutral-500 mt-0.5 italic">
                        Resolution: {r.resolution_notes}
                      </div>
                    )}
                  </div>
                </div>
                
                {r.status === 'PENDING' && (
                  <div className="flex gap-2 mt-2">
                    <button 
                      onClick={() => resolve(r.id, 'APPROVED')} 
                      className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg font-medium transition flex items-center gap-1"
                    >
                      <IconCheck className="w-3 h-3" /> Approve
                    </button>
                    <button 
                      onClick={() => resolve(r.id, 'REJECTED')} 
                      className="text-[10px] bg-neutral-200 hover:bg-neutral-300 text-neutral-700 px-3 py-1 rounded-lg font-medium transition flex items-center gap-1"
                    >
                      <IconClose className="w-3 h-3" /> Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}