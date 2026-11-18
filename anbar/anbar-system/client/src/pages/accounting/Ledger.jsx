import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { money, dateFa } from '../../utils/format';

export default function Ledger() {
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState('');
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/accounting/accounts').then((res) => setAccounts(res.data));
  }, []);

  useEffect(() => {
    if (accountId) {
      api.get(`/accounting/ledger/${accountId}`).then((res) => setData(res.data));
    } else {
      setData(null);
    }
  }, [accountId]);

  return (
    <div>
      <div className="toolbar no-print">
        <select className="input" style={{ maxWidth: 320 }} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">— یک حساب را برای مشاهده دفتر کل انتخاب کنید —</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} — {a.name}
            </option>
          ))}
        </select>
        {accountId && (
          <button className="btn btn-outline" onClick={() => window.print()}>
            چاپ / PDF
          </button>
        )}
      </div>

      {!data ? (
        <div className="empty-state">برای مشاهده دفتر کل، یک حساب انتخاب کنید</div>
      ) : (
        <div className="card">
          <div className="card-header">
            <h3>دفتر کل: {data.account.name}</h3>
            <span className="pill pill-primary">مانده: {money(data.closing_balance)}</span>
          </div>
          {data.lines.length === 0 ? (
            <div className="empty-state">تراکنشی برای این حساب ثبت نشده است</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>شماره سند</th>
                  <th>شرح</th>
                  <th>تاریخ</th>
                  <th>بدهکار</th>
                  <th>بستانکار</th>
                  <th>مانده</th>
                </tr>
              </thead>
              <tbody>
                {data.lines.map((l) => (
                  <tr key={l.id}>
                    <td className="mono">{l.entry_number}</td>
                    <td>{l.description || l.entry_description || '-'}</td>
                    <td>{dateFa(l.entry_date)}</td>
                    <td className="mono">{l.debit ? money(l.debit) : '-'}</td>
                    <td className="mono">{l.credit ? money(l.credit) : '-'}</td>
                    <td className="mono">{money(l.running_balance)}</td>
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
