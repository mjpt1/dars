import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const NAV = [
  { section: 'کلی', items: [{ to: '/', label: 'داشبورد', icon: '◧', perm: null }] },
  {
    section: 'انبارداری',
    items: [
      { to: '/inventory/items', label: 'کالاها', icon: '▣', perm: 'inventory.view' },
      { to: '/inventory/documents', label: 'رسید و حواله', icon: '⇄', perm: 'inventory.view' },
      { to: '/inventory/warehouses', label: 'انبارها', icon: '⌂', perm: 'inventory.view' },
    ],
  },
  {
    section: 'کنترل پروژه',
    items: [{ to: '/projects', label: 'پروژه‌ها', icon: '◫', perm: 'project.view' }],
  },
  {
    section: 'مالی',
    items: [
      { to: '/finance/invoices', label: 'فاکتورها', icon: '⎙', perm: 'finance.view' },
      { to: '/finance/parties', label: 'مشتریان و تامین‌کنندگان', icon: '☰', perm: 'finance.view' },
    ],
  },
  {
    section: 'حسابداری',
    items: [
      { to: '/accounting/accounts', label: 'دفتر حساب‌ها', icon: '⎘', perm: 'accounting.view' },
      { to: '/accounting/journal-entries', label: 'اسناد حسابداری', icon: '⎗', perm: 'accounting.view' },
      { to: '/accounting/ledger', label: 'دفتر کل', icon: '⎖', perm: 'accounting.view' },
    ],
  },
  {
    section: 'گزارش‌ها',
    items: [
      { to: '/reports/item-ledger', label: 'کاردکس کالا', icon: '▤', perm: 'reports.view' },
      { to: '/reports/project-pl', label: 'سود و زیان پروژه', icon: '▥', perm: 'reports.view' },
      { to: '/reports/balance-summary', label: 'خلاصه مالی', icon: '▦', perm: 'reports.view' },
    ],
  },
  {
    section: 'مدیریت',
    items: [
      { to: '/users', label: 'کاربران و دسترسی‌ها', icon: '☺', perm: 'users.manage' },
      { to: '/backup', label: 'پشتیبان‌گیری', icon: '⟳', perm: 'backup.manage' },
    ],
  },
];

export default function Sidebar() {
  const { user, logout, can } = useAuth();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="logo">ا</div>
        <div>
          <div className="title">سامانه انبار و پروژه</div>
          <div className="subtitle">نسخه آفلاین شبکه محلی</div>
        </div>
      </div>

      {NAV.map((section) => {
        const items = section.items.filter((it) => !it.perm || can(it.perm));
        if (items.length === 0) return null;
        return (
          <div key={section.section}>
            <div className="nav-section-label">{section.section}</div>
            {items.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.to === '/'}
                className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
              >
                <span className="icon">{it.icon}</span>
                <span>{it.label}</span>
              </NavLink>
            ))}
          </div>
        );
      })}

      <div className="sidebar-footer">
        <div className="avatar">{user?.full_name?.[0] || '?'}</div>
        <div>
          <div className="name">{user?.full_name}</div>
          <div className="role">{user?.role}</div>
        </div>
        <div className="logout" onClick={logout} title="خروج">
          خروج
        </div>
      </div>
    </aside>
  );
}
