import React from 'react';

export default function StatCard({ icon, label, value, color = 'primary', hint }) {
  return (
    <div className="stat-card">
      <div className="icon-badge" style={{ background: `var(--${color}-soft)`, color: `var(--${color})` }}>
        {icon}
      </div>
      <div className="value">{value}</div>
      <div className="label">{label}</div>
      {hint && <div className="trend text-muted">{hint}</div>}
    </div>
  );
}
