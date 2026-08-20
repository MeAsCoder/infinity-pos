import React, { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => { load(); }, []);
  async function load() {
    try { setUsers(await api.users()); setRoles(await api.roles()); } catch (e) {}
  }

  async function toggleActive(u) {
    await api.updateUser(u.id, { active: !u.active });
    load();
  }

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Users</h1>
        <button onClick={() => setShowNew(true)} className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold">+ New User</button>
      </div>
      <div className="bg-white rounded-xl shadow-sm divide-y">
        {users.map(u => (
          <div key={u.id} className="p-3 flex justify-between items-center">
            <div>
              <div className="font-medium">{u.name} <span className="text-xs text-neutral-400">@{u.username}</span></div>
              <div className="text-xs text-neutral-400">{u.role} · max discount {u.max_discount_percent}%</div>
            </div>
            <button onClick={() => toggleActive(u)} className={`text-xs px-3 py-1.5 rounded-full font-medium ${u.active ? 'bg-green-100 text-green-700' : 'bg-neutral-200 text-neutral-500'}`}>
              {u.active ? 'Active' : 'Disabled'}
            </button>
          </div>
        ))}
      </div>
      {showNew && <NewUserModal roles={roles} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load(); }} />}
    </div>
  );
}

function NewUserModal({ roles, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', username: '', phone: '', password: '', roleName: 'WAITER', maxDiscountPercent: 0 });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    if (!form.name || !form.username || !form.password) return;
    setBusy(true); setErr('');
    try { await api.createUser({ ...form, maxDiscountPercent: Number(form.maxDiscountPercent) }); onSaved(); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">New User</h2>
        {err && <div className="bg-red-50 text-red-700 text-sm rounded p-2 mb-2">{err}</div>}
        <div className="space-y-2">
          <input placeholder="Full name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border rounded-lg px-3 py-2" />
          <input placeholder="Username" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} className="w-full border rounded-lg px-3 py-2" />
          <input placeholder="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full border rounded-lg px-3 py-2" />
          <input placeholder="Password" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="w-full border rounded-lg px-3 py-2" />
          <select value={form.roleName} onChange={e => setForm(f => ({ ...f, roleName: e.target.value }))} className="w-full border rounded-lg px-3 py-2">
            {roles.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
          </select>
          <div>
            <label className="text-xs text-neutral-500">Max discount % this user can apply</label>
            <input type="number" value={form.maxDiscountPercent} onChange={e => setForm(f => ({ ...f, maxDiscountPercent: e.target.value }))} className="w-full border rounded-lg px-3 py-2" />
          </div>
        </div>
        <button disabled={busy} onClick={save} className="w-full bg-brand text-white font-semibold py-3 rounded-xl mt-4">Create User</button>
      </div>
    </div>
  );
}
