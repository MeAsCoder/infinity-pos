// components/Sidebar.jsx
import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo, { LogoMark } from './Logo';
import SyncBadge from './SyncBadge';
import {
  IconDashboard, IconPOS, IconClock, IconBottle, IconBox, IconCredit,
  IconChart, IconReceipt, IconUsers, IconShield, IconLogout, IconMenu, IconClose,
} from './Icons';

const NAV = [
  { to: '/pos', label: 'Point of Sale', icon: IconPOS, perm: 'sales.create' },
  { to: '/shift', label: 'My Shift', icon: IconClock, perm: null },
  { to: '/waiter-dashboard', label: 'My Dashboard', icon: IconChart, perm: 'sales.create' },
  { section: 'Management', perm: 'reports.view' },
  { to: '/admin', label: 'Dashboard', icon: IconDashboard, perm: 'reports.view' },
  { to: '/admin/products', label: 'Products', icon: IconBottle, perm: 'products.manage' },
  { to: '/admin/stock', label: 'Stock', icon: IconBox, perm: 'stock.receive' },
  { to: '/admin/credit', label: 'Credit Book', icon: IconCredit, perm: 'credit.manage' },
  { to: '/admin/reports', label: 'Reports', icon: IconChart, perm: 'reports.view' },
  { to: '/admin/expenses', label: 'Expenses', icon: IconReceipt, perm: 'expenses.manage' },
  { to: '/admin/users', label: 'Users', icon: IconUsers, perm: 'users.manage' },
  { to: '/admin/audit', label: 'Audit Log', icon: IconShield, perm: 'audit.view' },
];

export default function Sidebar() {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const visibleNav = NAV.filter(item => !item.perm || hasPermission(item.perm));
  
  // Find current page label for mobile header
  const currentPage = visibleNav.find(i => i.to && location.pathname === i.to);
  const currentLabel = currentPage?.label || 'Infinity';

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-30 bg-ink-950 text-white flex items-center justify-between px-3 h-14 shadow-soft">
        <button onClick={() => setOpen(true)} className="p-2 -ml-2 text-white/80 hover:text-white" aria-label="Open menu">
          <IconMenu className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <LogoMark className="w-6 h-6" />
          <span className="font-display text-sm tracking-wide">{currentLabel}</span>
        </div>
        <SyncBadge compact />
      </div>

      {/* Backdrop for mobile drawer */}
      {open && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Sidebar panel */}
      <aside className={`
        fixed lg:sticky top-0 left-0 h-screen z-50 w-72 bg-ink-950 text-white flex flex-col shrink-0
        transition-transform duration-200 ease-out
        ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
      `}>
        <div className="flex items-center justify-between px-5 pt-6 pb-5 border-b border-white/10">
          <Logo />
          <button onClick={() => setOpen(false)} className="lg:hidden text-white/60 hover:text-white p-1">
            <IconClose className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {visibleNav.map((item, idx) => {
            if (item.section) {
              return <div key={item.section + idx} className="px-3 pt-5 pb-2 text-[10px] font-semibold tracking-[0.18em] text-white/35 uppercase">{item.section}</div>;
            }
            const Icon = item.icon;
            const isActive = location.pathname === item.to;
            
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={({ isActive: navActive }) => `
                  group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative
                  ${(navActive || isActive) ? 'bg-white/[0.08] text-white' : 'text-white/60 hover:text-white hover:bg-white/[0.04]'}
                `}
              >
                {({ isActive: navActive }) => {
                  const active = navActive || isActive;
                  return (
                    <>
                      {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-gold-500" />}
                      <Icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-gold-400' : 'text-white/45 group-hover:text-white/70'}`} />
                      <span>{item.label}</span>
                    </>
                  );
                }}
              </NavLink>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-white/10">
          <div className="px-2 pb-3 hidden lg:block">
            <SyncBadge />
          </div>
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-white/[0.04]">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gold-500 to-brand flex items-center justify-center text-xs font-bold shrink-0">
              {user.name?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate">{user.name || 'User'}</div>
              <div className="text-[11px] text-white/45 truncate">{user.role?.replace('_', ' ') || 'User'}</div>
            </div>
            <button 
              onClick={handleLogout} 
              className="text-white/40 hover:text-white p-1.5 rounded-md hover:bg-white/10 transition" 
              aria-label="Log out"
            >
              <IconLogout className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}