import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { IconPlus, IconClose } from '../components/Icons';

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('all');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { 
      const [usersData, rolesData] = await Promise.all([
        api.users(), 
        api.roles()
      ]);
      setUsers(usersData || []);
      setRoles(rolesData || []);
    } catch (e) {
      setUsers([]);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(user) {
    try {
      await api.updateUser(user.id, { active: !user.active });
      load();
    } catch (e) {
      alert('Failed to update user: ' + e.message);
    }
  }

  // Filter users
  const filteredUsers = useMemo(() => {
    let result = users;
    
    if (filterRole !== 'all') {
      result = result.filter(u => u.role === filterRole);
    }
    
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(u => 
        u.name?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q) ||
        u.phone?.includes(q)
      );
    }
    
    return result;
  }, [users, filterRole, search]);

  // Get unique roles for filter
  const roleOptions = useMemo(() => {
    const rolesSet = new Set(users.map(u => u.role).filter(Boolean));
    return ['all', ...Array.from(rolesSet)];
  }, [users]);

  const activeCount = users.filter(u => u.active).length;
  const inactiveCount = users.filter(u => !u.active).length;

  // Check if current user is SUPER_ADMIN
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  return (
    <div className="p-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-ink-950">Users</h1>
          <div className="flex flex-wrap gap-4 mt-1 text-sm text-neutral-500">
            <span>{users.length} total</span>
            <span>· <span className="text-emerald-600">{activeCount} active</span></span>
            {inactiveCount > 0 && <span>· <span className="text-rose-600">{inactiveCount} inactive</span></span>}
          </div>
        </div>
        {isSuperAdmin && (
          <button 
            onClick={() => setShowNew(true)} 
            className="flex items-center gap-2 bg-brand hover:bg-brand-dark text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition shadow-soft"
          >
            <IconPlus className="w-4 h-4" /> New User
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4 bg-white rounded-xl shadow-sm p-3 border border-neutral-100">
        <div className="flex-1 min-w-[140px] relative">
          <span className="text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 text-sm">🔍</span>
          <input 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Search users..." 
            className="w-full border border-neutral-200 rounded-lg pl-9 pr-3 py-2 text-sm bg-neutral-50 focus:bg-white focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
          />
        </div>
        
        <select
          value={filterRole}
          onChange={e => setFilterRole(e.target.value)}
          className="border border-neutral-200 rounded-lg px-3 py-2 text-sm bg-white focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
        >
          {roleOptions.map(role => (
            <option key={role} value={role}>
              {role === 'all' ? 'All Roles' : role}
            </option>
          ))}
        </select>
        
        {(search || filterRole !== 'all') && (
          <button
            onClick={() => { setSearch(''); setFilterRole('all'); }}
            className="text-sm text-neutral-400 hover:text-neutral-600 underline whitespace-nowrap"
          >
            Clear
          </button>
        )}
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-neutral-100 p-8 text-center text-neutral-400 text-sm">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand mx-auto"></div>
          <p className="mt-3">Loading users...</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-neutral-100 p-12 text-center text-neutral-400 text-sm">
          {search || filterRole !== 'all' ? 'No users match your filters' : 'No users found'}
          {(search || filterRole !== 'all') && (
            <button
              onClick={() => { setSearch(''); setFilterRole('all'); }}
              className="block mt-2 text-brand text-sm font-medium hover:underline"
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
                  <th className="p-3">User</th>
                  <th className="p-3">Username</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Role</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredUsers.map(u => {
                  const isCurrentUser = currentUser?.id === u.id;
                  const isActive = u.active;
                  
                  return (
                    <tr key={u.id} className="hover:bg-neutral-50 transition">
                      <td className="p-3">
                        <div className="font-medium text-ink-950">{u.name}</div>
                        <div className="text-xs text-neutral-400">
                          Max discount: {u.max_discount_percent || 0}%
                        </div>
                      </td>
                      <td className="p-3 text-neutral-600">@{u.username}</td>
                      <td className="p-3 text-neutral-500">{u.phone || '—'}</td>
                      <td className="p-3">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          u.role === 'SUPER_ADMIN' ? 'bg-amber-100 text-amber-700' :
                          u.role === 'ADMIN' ? 'bg-blue-100 text-blue-700' :
                          'bg-neutral-100 text-neutral-600'
                        }`}>
                          {u.role || 'WAITER'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                        }`}>
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {isSuperAdmin && (
                            <button 
                              onClick={() => {
                                setSelectedUser(u);
                                setShowEdit(true);
                              }} 
                              className="text-brand hover:text-brand-dark text-xs font-semibold transition"
                            >
                              Edit
                            </button>
                          )}
                          
                          {isSuperAdmin && !isCurrentUser && (
                            <button 
                              onClick={() => toggleActive(u)} 
                              className={`text-xs font-medium transition ${
                                isActive 
                                  ? 'text-rose-600 hover:text-rose-700' 
                                  : 'text-emerald-600 hover:text-emerald-700'
                              }`}
                            >
                              {isActive ? 'Disable' : 'Enable'}
                            </button>
                          )}
                          
                          {isCurrentUser && !isSuperAdmin && (
                            <span className="text-xs text-neutral-400">You</span>
                          )}
                          
                          {!isSuperAdmin && !isCurrentUser && (
                            <span className="text-xs text-neutral-400">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New User Modal */}
      {showNew && (
        <NewUserModal 
          roles={roles} 
          onClose={() => setShowNew(false)} 
          onSaved={() => { setShowNew(false); load(); }} 
        />
      )}

      {/* Edit User Modal */}
      {showEdit && selectedUser && (
        <EditUserModal 
          user={selectedUser}
          roles={roles}
          isCurrentUser={currentUser?.id === selectedUser?.id}
          onClose={() => { setShowEdit(false); setSelectedUser(null); }} 
          onSaved={() => { setShowEdit(false); setSelectedUser(null); load(); }} 
        />
      )}
    </div>
  );
}

// ============================================================================
// NEW USER MODAL
// ============================================================================
function NewUserModal({ roles, onClose, onSaved }) {
  const [form, setForm] = useState({ 
    name: '', 
    username: '', 
    phone: '', 
    password: '', 
    roleName: 'WAITER', 
    maxDiscountPercent: 0 
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    if (!form.name || !form.username || !form.password) {
      setErr('Name, username and password are required');
      return;
    }
    setBusy(true); 
    setErr('');
    try { 
      await api.createUser({ 
        ...form, 
        maxDiscountPercent: Number(form.maxDiscountPercent) || 0 
      }); 
      onSaved(); 
    } catch (e) { 
      setErr(e.message || 'Failed to create user'); 
    } finally { 
      setBusy(false); 
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-semibold text-ink-950">New User</h2>
            <p className="text-sm text-neutral-400">Add a user to the system</p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 p-1">
            <IconClose className="w-5 h-5" />
          </button>
        </div>

        {err && (
          <div className="bg-rose-50 text-rose-700 text-sm rounded-lg p-3 mb-4 border border-rose-100">
            {err}
          </div>
        )}

        <div className="space-y-3.5">
          <div>
            <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5 block">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <input 
              placeholder="e.g. John Doe" 
              value={form.name} 
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} 
              className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-base focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
              autoFocus
            />
          </div>
          
          <div>
            <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5 block">
              Username <span className="text-rose-500">*</span>
            </label>
            <input 
              placeholder="e.g. johndoe" 
              value={form.username} 
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))} 
              className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-base focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
            />
          </div>
          
          <div>
            <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5 block">
              Phone
            </label>
            <input 
              placeholder="e.g. 0712 345 678" 
              value={form.phone} 
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} 
              className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-base focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
            />
          </div>
          
          <div>
            <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5 block">
              Password <span className="text-rose-500">*</span>
            </label>
            <input 
              placeholder="Min 6 characters" 
              type="password" 
              value={form.password} 
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))} 
              className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-base focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
            />
          </div>
          
          <div>
            <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5 block">
              Role
            </label>
            <select 
              value={form.roleName} 
              onChange={e => setForm(f => ({ ...f, roleName: e.target.value }))} 
              className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-base focus:border-brand focus:ring-1 focus:ring-brand outline-none transition bg-white"
            >
              {roles.map(r => (
                <option key={r.name} value={r.name}>{r.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5 block">
              Max Discount %
            </label>
            <input 
              type="number" 
              placeholder="0" 
              value={form.maxDiscountPercent} 
              onChange={e => setForm(f => ({ ...f, maxDiscountPercent: e.target.value }))} 
              className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-base focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
            />
            <p className="text-xs text-neutral-400 mt-1">Maximum discount percentage this user can apply</p>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button 
            onClick={onClose} 
            className="flex-1 border border-neutral-200 rounded-xl py-3 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition"
          >
            Cancel
          </button>
          <button 
            disabled={busy || !form.name || !form.username || !form.password} 
            onClick={save} 
            className="flex-1 bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-xl text-sm transition disabled:opacity-50"
          >
            {busy ? 'Creating...' : 'Create User'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// EDIT USER MODAL - COMPACT VERSION
// ============================================================================
function EditUserModal({ user, roles, isCurrentUser, onClose, onSaved }) {
  const [form, setForm] = useState({ 
    name: '', 
    phone: '', 
    roleName: '', 
    maxDiscountPercent: 0 
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || '',
        phone: user.phone || '',
        roleName: user.role || 'WAITER',
        maxDiscountPercent: user.max_discount_percent || 0
      });
    }
  }, [user]);

  async function save() {
    if (!form.name) {
      setErr('Name is required');
      return;
    }
    setBusy(true); 
    setErr('');
    setSuccess('');
    
    try { 
      await api.updateUser(user.id, { 
        name: form.name,
        phone: form.phone || null,
        roleName: form.roleName,
        maxDiscountPercent: Number(form.maxDiscountPercent) || 0
      }); 
      
      setSuccess('User updated successfully!');
      
      if (isCurrentUser) {
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setTimeout(() => {
          onSaved();
        }, 1000);
      }
    } catch (e) { 
      setErr(e.message || 'Failed to update user'); 
    } finally { 
      setBusy(false); 
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-3">
          <div>
            <h2 className="text-lg font-semibold text-ink-950">Edit User</h2>
            <p className="text-xs text-neutral-400">Update user details</p>
            {isCurrentUser && (
              <span className="text-[10px] text-amber-600 font-medium">You are editing your own profile</span>
            )}
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 p-1">
            <IconClose className="w-4 h-4" />
          </button>
        </div>

        {err && (
          <div className="bg-rose-50 text-rose-700 text-xs rounded-lg p-2 mb-3 border border-rose-100">
            {err}
          </div>
        )}

        {success && (
          <div className="bg-emerald-50 text-emerald-700 text-xs rounded-lg p-2 mb-3 border border-emerald-100">
            {success}
          </div>
        )}

        <div className="space-y-2">
          {/* Username - Read Only */}
          <div>
            <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide mb-0.5 block">
              Username
            </label>
            <div className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm bg-neutral-50 text-neutral-500">
              @{user.username}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide mb-0.5 block">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <input 
              placeholder="e.g. John Doe" 
              value={form.name} 
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} 
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
              autoFocus
            />
          </div>
          
          {/* Phone */}
          <div>
            <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide mb-0.5 block">
              Phone
            </label>
            <input 
              placeholder="e.g. 0712 345 678" 
              value={form.phone} 
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} 
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
            />
          </div>
          
          {/* Role */}
          <div>
            <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide mb-0.5 block">
              Role
            </label>
            <select 
              value={form.roleName} 
              onChange={e => setForm(f => ({ ...f, roleName: e.target.value }))} 
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none transition bg-white"
            >
              {roles.map(r => (
                <option key={r.name} value={r.name}>{r.name}</option>
              ))}
            </select>
            {isCurrentUser && (
              <p className="text-[10px] text-amber-600 mt-0.5">Changing role may affect permissions</p>
            )}
          </div>
          
          {/* Max Discount */}
          <div>
            <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide mb-0.5 block">
              Max Discount %
            </label>
            <input 
              type="number" 
              placeholder="0" 
              value={form.maxDiscountPercent} 
              onChange={e => setForm(f => ({ ...f, maxDiscountPercent: e.target.value }))} 
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none transition"
            />
            <p className="text-[10px] text-neutral-400 mt-0.5">Max discount this user can apply</p>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button 
            onClick={onClose} 
            className="flex-1 border border-neutral-200 rounded-lg py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition"
          >
            Cancel
          </button>
          <button 
            disabled={busy || !form.name} 
            onClick={save} 
            className="flex-1 bg-brand hover:bg-brand-dark text-white font-semibold py-2 rounded-lg text-sm transition disabled:opacity-50"
          >
            {busy ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}