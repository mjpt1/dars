import React from 'react';
import NotificationsBell from './NotificationsBell';

export default function Topbar({ title }) {
  return (
    <div className="topbar">
      <h1>{title}</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="badge-net">● متصل به سرور شبکه محلی</span>
        <NotificationsBell />
      </div>
    </div>
  );
}
