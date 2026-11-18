import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import Modal from '../../components/Modal';
import { money, dateFa } from '../../utils/format';
import { useAuth } from '../../auth/AuthContext';

const SOURCE_LABELS = { manual: 'دستی', invoice: 'خودکار (فاکتور)', payment: 'خودکار (پرداخت)' };

export default function JournalEntries() {
  const { can } = useAuth();
  const [list, setList] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState([
    { account_id: '', debit: '', credit: '' },
    { account_id: '', debit: '', credit: '' },
  ]);
  const [error, setError] = useState('');

  function load() {
    api.get('/accounting/journal-entries').then((res) => setList(res.data));
  }
  useEffect(() => {
    load();
    api.get('/accounting/accounts').then((res) => setAccounts(res.data));
  }, []);

  function updateLine(idx, field, value) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, { account_id: '', debit: '', credit: '' }]);
  }
  function removeLine(idx) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = totalDebit === totalCredit && totalDebit > 0;

  async function save(e) {
    e.preventDefault();
    setError('');
    if (!balanced) {
      setError('جمع بدهکار و بستانکار باید برابر و بزرگ‌تر از صفر باشد');
      return;
    }
    try {
      await api.post('/accounting/journal-entries', {
        description,
        lines: lines.filter((l) => l.account_id).map((l) => ({ account_id: Number(l.account_id), debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 })),
      });
      setOpen(false);
      setDescription('');
      setLines([{ account_id: '', debit: '', credit: '' }, { account_id: '', debit: '', credit: '' }]);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'خطا در ثبت سند');
    }
  }

  return (
    <div>
      <div className="toolbar">
        <div className="text-muted" style={{ fontSize: 12.5 }}>
          اسناد حسابداری — برخی به‌صورت خودکار از فاکتور/پرداخت و برخی به‌صورت دستی ثبت می‌شوند
        </div>
        {can('accounting.manage') && (
          <button className="btn btn-primary" onClick={() => setOpen(true)}>
            + سند دستی جدید
          </button>
        )}
      </div>

      <div className="card">
        {list.length === 0 ? (
          <div className="empty-state">سندی ثبت نشده است</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>شماره سند</th>
                <th>شرح</th>
                <th>منبع</th>
                <th>مبلغ</th>
                <th>تاریخ</th>
                <th>ثبت‌کننده</th>
              </tr>
            </thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.id}>
                  <td className="mono">{e.entry_number}</td>
                  <td>{e.description || '-'}</td>
                  <td>
                    <span className="pill pill-muted">{SOURCE_LABELS[e.source]}</span>
                  </td>
                  <td className="mono">{money(e.total)}</td>
                  <td>{dateFa(e.entry_date)}</td>
                  <td>{e.created_by_name || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <Modal title="سند حسابداری دستی" onClose={() => setOpen(false)} width={620}>
          <form onSubmit={save} id="je-form">
            <div className="field">
              <label>شرح سند</label>
              <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            {lines.map((l, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <select className="input" style={{ flex: 2 }} value={l.account_id} onChange={(e) => updateLine(idx, 'account_id', e.target.value)}>
                  <option value="">انتخاب حساب</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </option>
                  ))}
                </select>
                <input
                  className="input"
                  type="number"
                  placeholder="بدهکار"
                  style={{ flex: 1 }}
                  value={l.debit}
                  onChange={(e) => updateLine(idx, 'debit', e.target.value)}
                />
                <input
                  className="input"
                  type="number"
                  placeholder="بستانکار"
                  style={{ flex: 1 }}
                  value={l.credit}
                  onChange={(e) => updateLine(idx, 'credit', e.target.value)}
                />
                {lines.length > 2 && (
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => removeLine(idx)}>
                    حذف
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="btn btn-outline btn-sm" onClick={addLine}>
              + افزودن ردیف
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontSize: 12.5 }}>
              <span className="text-muted">جمع بدهکار: {money(totalDebit)}</span>
              <span className="text-muted">جمع بستانکار: {money(totalCredit)}</span>
              <span className={balanced ? 'pill pill-success' : 'pill pill-warning'}>{balanced ? 'موازنه صحیح' : 'موازنه نشده'}</span>
            </div>

            {error && <div className="pill pill-danger" style={{ display: 'block', padding: '8px 12px', marginTop: 10 }}>{error}</div>}
          </form>
          <div className="modal-footer" style={{ marginTop: 12 }}>
            <button className="btn btn-outline" type="button" onClick={() => setOpen(false)}>
              انصراف
            </button>
            <button className="btn btn-primary" type="submit" form="je-form">
              ثبت سند
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
