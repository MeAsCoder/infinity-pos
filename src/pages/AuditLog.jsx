import React, { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function AuditLog() {
  const [tab, setTab] = useState('log');
  return (
    <div className="p-4 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Audit &amp; Corrections</h1>
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('log')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'log' ? 'bg-brand text-white' : 'bg-white border'}`}>Audit Log</button>
        <button onClick={() => setTab('corrections')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'corrections' ? 'bg-brand text-white' : 'bg-white border'}`}>Correction Requests</button>
      </div>
      {tab === 'log' ? <LogView /> : <CorrectionsView />}
    </div>
  );
}

function LogView() {
  const [rows, setRows] = useState([]);
  useEffect(() => { api.auditLog().then(setRows).catch(() => {}); }, []);
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-neutral-400 border-b"><th className="p-3">Time</th><th className="p-3">Event</th><th className="p-3">User</th><th className="p-3">Entity</th><th className="p-3">Reason</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="border-t align-top">
              <td className="p-3 whitespace-nowrap text-neutral-500">{new Date(r.created_at).toLocaleString()}</td>
              <td className="p-3 font-medium">{r.event}</td>
              <td className="p-3">{r.user_name || '—'} <span className="text-xs text-neutral-400">{r.role}</span></td>
              <td className="p-3 text-neutral-500">{r.entity_type} {r.entity_id ? `#${r.entity_id}` : ''}</td>
              <td className="p-3 text-neutral-500">{r.reason || '—'}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-neutral-400">No events yet</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function CorrectionsView() {
  const [rows, setRows] = useState([]);
  useEffect(() => { load(); }, []);
  async function load() { try { setRows(await api.corrections()); } catch (e) {} }

  async function resolve(id, status) {
    const notes = status === 'REJECTED' ? prompt('Reason for rejecting (optional):') || '' : '';
    await api.resolveCorrection(id, { status, resolutionNotes: notes });
    load();
  }

  return (
    <div className="bg-white rounded-xl shadow-sm divide-y">
      {rows.map(r => (
        <div key={r.id} className="p-3">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-medium">{r.type} — {r.ref_type} #{r.ref_id}</div>
              <div className="text-xs text-neutral-400">by {r.requested_by_name} · {new Date(r.created_at).toLocaleString()}</div>
              <div className="text-sm text-neutral-600 mt-1">{r.reason}</div>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${r.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' : r.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{r.status}</span>
          </div>
          {r.status === 'PENDING' && (
            <div className="flex gap-2 mt-2">
              <button onClick={() => resolve(r.id, 'APPROVED')} className="text-xs bg-green-500 text-white px-3 py-1.5 rounded-lg font-medium">Approve</button>
              <button onClick={() => resolve(r.id, 'REJECTED')} className="text-xs bg-neutral-200 px-3 py-1.5 rounded-lg font-medium">Reject</button>
            </div>
          )}
        </div>
      ))}
      {rows.length === 0 && <div className="p-6 text-center text-neutral-400">No correction requests</div>}
    </div>
  );
}
