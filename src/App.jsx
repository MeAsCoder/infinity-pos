// App.js
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';

import Login from './pages/Login';
import POS from './pages/POS';
import ShiftScreen from './pages/ShiftScreen';
import WaiterDashboard from './pages/WaiterDashboard'; // Add this import
import AdminDashboard from './pages/AdminDashboard';
import Products from './pages/Products';
import StockManagement from './pages/StockManagement';
import Credit from './pages/Credit';
import Reports from './pages/Reports';
import Expenses from './pages/Expenses';
import Users from './pages/Users';
import AuditLog from './pages/AuditLog';

function Protected({ children, permission }) {
  const { user, loading, hasPermission } = useAuth();
  if (loading) return <div className="p-8 text-center text-neutral-400">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (permission && !hasPermission(permission)) {
    return (
      <div className="p-10 text-center max-w-md mx-auto mt-16">
        <div className="text-4xl mb-3">🔒</div>
        <p className="text-neutral-700 font-medium">You don't have permission to view this page.</p>
        <p className="text-neutral-400 text-sm mt-1">Ask a manager or Super Admin if you need access.</p>
      </div>
    );
  }
  return children;
}

export default function App() {
  const { user } = useAuth();

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <Routes>
          <Route path="/login" element={<Navigate to="/pos" replace />} />
          <Route path="/pos" element={<Protected permission="sales.create"><POS /></Protected>} />
          <Route path="/shift" element={<Protected><ShiftScreen /></Protected>} />
          <Route path="/waiter-dashboard" element={<Protected><WaiterDashboard /></Protected>} />
          <Route path="/admin" element={<Protected permission="reports.view"><AdminDashboard /></Protected>} />
          <Route path="/admin/products" element={<Protected permission="products.manage"><Products /></Protected>} />
          <Route path="/admin/stock" element={<Protected permission="stock.receive"><StockManagement /></Protected>} />
          <Route path="/admin/credit" element={<Protected permission="credit.manage"><Credit /></Protected>} />
          <Route path="/admin/reports" element={<Protected permission="reports.view"><Reports /></Protected>} />
          <Route path="/admin/expenses" element={<Protected permission="expenses.manage"><Expenses /></Protected>} />
          <Route path="/admin/users" element={<Protected permission="users.manage"><Users /></Protected>} />
          <Route path="/admin/audit" element={<Protected permission="audit.view"><AuditLog /></Protected>} />
          <Route path="*" element={<Navigate to="/pos" replace />} />
        </Routes>
      </div>
    </div>
  );
}