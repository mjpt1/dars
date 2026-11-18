import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import StatCard from '../components/StatCard';
import { money, dateFa, DOC_TYPE_LABELS } from '../utils/format';

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/dashboard/summary').then((res) => setData(res.data));
  }, []);

  if (!data) return <div className="empty-state">در حال بارگذاری...</div>;

  return (
    <div>
      <div className="grid grid-4">
        <StatCard icon="▣" label="تعداد کالاهای فعال" value={data.itemCount} color="primary" />
        <StatCard
          icon="⚠"
          label="کالاهای زیر حداقل موجودی"
          value={data.lowStockCount}
          color="warning"
          hint={data.lowStockCount > 0 ? 'نیاز به سفارش مجدد' : 'وضعیت مطلوب'}
        />
        <StatCard icon="◫" label="پروژه‌های فعال" value={data.activeProjects} color="accent" />
        <StatCard
          icon="⎙"
          label="فاکتورهای پرداخت‌نشده"
          value={data.unpaidInvoiceCount}
          color="danger"
          hint={`مانده: ${money(data.unpaidInvoiceTotal)} تومان`}
        />
      </div>

      <div className="grid grid-2" style={{ marginTop: 20 }}>
        <div className="card">
          <div className="card-header">
            <h3>آخرین اسناد انبار</h3>
          </div>
          {data.recentDocs.length === 0 ? (
            <div className="empty-state">هنوز سندی ثبت نشده است</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>شماره سند</th>
                  <th>نوع</th>
                  <th>انبار</th>
                  <th>تاریخ</th>
                </tr>
              </thead>
              <tbody>
                {data.recentDocs.map((d) => (
                  <tr key={d.id}>
                    <td className="mono">{d.doc_number}</td>
                    <td>
                      <span className="pill pill-primary">{DOC_TYPE_LABELS[d.doc_type] || d.doc_type}</span>
                    </td>
                    <td>{d.warehouse}</td>
                    <td>{dateFa(d.doc_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h3>هشدار کمبود موجودی</h3>
          </div>
          {data.lowStockItems.length === 0 ? (
            <div className="empty-state">همه کالاها موجودی کافی دارند ✓</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>کالا</th>
                  <th>موجودی فعلی</th>
                  <th>حداقل مجاز</th>
                </tr>
              </thead>
              <tbody>
                {data.lowStockItems.map((it) => (
                  <tr key={it.id}>
                    <td>{it.name}</td>
                    <td className="mono">{money(it.total)}</td>
                    <td className="mono">{money(it.min_stock)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
