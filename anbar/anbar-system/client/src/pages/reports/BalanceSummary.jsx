import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { money } from '../../utils/format';
import { downloadFile } from '../../utils/download';

const LABELS = { asset: 'دارایی‌ها', liability: 'بدهی‌ها', equity: 'سرمایه', revenue: 'درآمدها', expense: 'هزینه‌ها' };
const COLORS = { asset: 'primary', liability: 'danger', equity: 'accent', revenue: 'success', expense: 'warning' };

export default function BalanceSummary() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/reports/balance-summary').then((res) => setData(res.data));
  }, []);

  if (!data) return <div className="empty-state">در حال بارگذاری...</div>;

  return (
    <div>
      <div className="toolbar no-print">
        <div className="text-muted" style={{ fontSize: 12.5 }}>
          خلاصه‌ای از وضعیت مالی بر اساس مانده حساب‌های دفتر کل (برگرفته از اسناد حسابداری ثبت‌شده)
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={() => downloadFile('/reports/balance-summary/export', 'balance-summary.xlsx')}>
            دانلود اکسل
          </button>
          <button className="btn btn-outline" onClick={() => window.print()}>
            چاپ / PDF
          </button>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="label">جمع دارایی‌ها</div>
          <div className="value">{money(data.total_assets)}</div>
        </div>
        <div className="stat-card">
          <div className="label">جمع بدهی‌ها</div>
          <div className="value">{money(data.total_liabilities)}</div>
        </div>
        <div className="stat-card">
          <div className="label">سرمایه + نتیجه عملکرد</div>
          <div className="value">{money(data.total_equity_and_result)}</div>
        </div>
      </div>

      <div className="grid grid-2">
        {Object.entries(data.groups).map(([type, list]) =>
          list.length === 0 ? null : (
            <div className="card" key={type}>
              <div className="card-header">
                <h3>{LABELS[type]}</h3>
                <span className={`pill pill-${COLORS[type]}`}>{money(data.totals[type])}</span>
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th>کد</th>
                    <th>نام حساب</th>
                    <th>مانده</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((a) => (
                    <tr key={a.code}>
                      <td className="mono">{a.code}</td>
                      <td>{a.name}</td>
                      <td className="mono">{money(a.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}
