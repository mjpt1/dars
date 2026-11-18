import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Items from './pages/inventory/Items';
import Documents from './pages/inventory/Documents';
import Warehouses from './pages/inventory/Warehouses';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Invoices from './pages/finance/Invoices';
import Parties from './pages/finance/Parties';
import Users from './pages/Users';
import Backup from './pages/Backup';
import Accounts from './pages/accounting/Accounts';
import JournalEntries from './pages/accounting/JournalEntries';
import Ledger from './pages/accounting/Ledger';
import ItemLedger from './pages/reports/ItemLedger';
import ProjectPL from './pages/reports/ProjectPL';
import BalanceSummary from './pages/reports/BalanceSummary';

function ProtectedLayout({ title, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <Topbar title={title} />
        <div className="page">{children}</div>
      </div>
    </div>
  );
}

function Inner() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedLayout title="داشبورد"><Dashboard /></ProtectedLayout>} />
      <Route path="/inventory/items" element={<ProtectedLayout title="کالاها"><Items /></ProtectedLayout>} />
      <Route path="/inventory/documents" element={<ProtectedLayout title="رسید و حواله انبار"><Documents /></ProtectedLayout>} />
      <Route path="/inventory/warehouses" element={<ProtectedLayout title="انبارها"><Warehouses /></ProtectedLayout>} />
      <Route path="/projects" element={<ProtectedLayout title="کنترل پروژه"><Projects /></ProtectedLayout>} />
      <Route path="/projects/:id" element={<ProtectedLayout title="جزئیات پروژه"><ProjectDetail /></ProtectedLayout>} />
      <Route path="/finance/invoices" element={<ProtectedLayout title="فاکتورها"><Invoices /></ProtectedLayout>} />
      <Route path="/finance/parties" element={<ProtectedLayout title="مشتریان و تامین‌کنندگان"><Parties /></ProtectedLayout>} />
      <Route path="/accounting/accounts" element={<ProtectedLayout title="دفتر حساب‌ها"><Accounts /></ProtectedLayout>} />
      <Route path="/accounting/journal-entries" element={<ProtectedLayout title="اسناد حسابداری"><JournalEntries /></ProtectedLayout>} />
      <Route path="/accounting/ledger" element={<ProtectedLayout title="دفتر کل"><Ledger /></ProtectedLayout>} />
      <Route path="/reports/item-ledger" element={<ProtectedLayout title="کاردکس کالا"><ItemLedger /></ProtectedLayout>} />
      <Route path="/reports/project-pl" element={<ProtectedLayout title="سود و زیان پروژه"><ProjectPL /></ProtectedLayout>} />
      <Route path="/reports/balance-summary" element={<ProtectedLayout title="خلاصه مالی"><BalanceSummary /></ProtectedLayout>} />
      <Route path="/users" element={<ProtectedLayout title="کاربران و دسترسی‌ها"><Users /></ProtectedLayout>} />
      <Route path="/backup" element={<ProtectedLayout title="پشتیبان‌گیری"><Backup /></ProtectedLayout>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Inner />
    </AuthProvider>
  );
}
