import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { money, dateFa } from '../../utils/format';
import { downloadFile } from '../../utils/download';

export default function ItemLedger() {
  const [items, setItems] = useState([]);
  const [itemId, setItemId] = useState('');
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/inventory/items').then((res) => setItems(res.data));
  }, []);

  useEffect(() => {
    if (itemId) {
      api.get(`/reports/item-ledger/${itemId}`).then((res) => setData(res.data));
    } else {
      setData(null);
    }
  }, [itemId]);

  return (
    <div>
      <div className="toolbar no-print">
        <select className="input" style={{ maxWidth: 320 }} value={itemId} onChange={(e) => setItemId(e.target.value)}>
          <option value="">— یک کالا را برای مشاهده کاردکس انتخاب کنید —</option>
          {items.map((it) => (
            <option key={it.id} value={it.id}>
              {it.name} ({it.code})
            </option>
          ))}
        </select>
        {itemId && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-outline"
              onClick={() => downloadFile(`/reports/item-ledger/${itemId}/export`, `item-ledger-${itemId}.xlsx`)}
            >
              دانلود اکسل
            </button>
            <button className="btn btn-outline" onClick={() => window.print()}>
              چاپ / PDF
            </button>
          </div>
        )}
      </div>

      {!data ? (
        <div className="empty-state">برای مشاهده کاردکس، یک کالا انتخاب کنید</div>
      ) : (
        <div className="card">
          <div className="card-header">
            <h3>
              کاردکس کالا: {data.item.name} ({data.item.code})
            </h3>
            <span className="pill pill-primary">موجودی نهایی: {money(data.closing_balance)}</span>
          </div>
          {data.lines.length === 0 ? (
            <div className="empty-state">تراکنشی برای این کالا ثبت نشده است</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>شماره سند</th>
                  <th>نوع</th>
                  <th>انبار</th>
                  <th>تاریخ</th>
                  <th>ورود</th>
                  <th>خروج</th>
                  <th>موجودی</th>
                </tr>
              </thead>
              <tbody>
                {data.lines.map((l, i) => (
                  <tr key={i}>
                    <td className="mono">{l.doc_number}</td>
                    <td>
                      <span className="pill pill-muted">{l.doc_type_label}</span>
                    </td>
                    <td>{l.warehouse_name}</td>
                    <td>{dateFa(l.doc_date)}</td>
                    <td className="mono">{l.qty_in ? money(l.qty_in) : '-'}</td>
                    <td className="mono">{l.qty_out ? money(l.qty_out) : '-'}</td>
                    <td className="mono">{money(l.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
