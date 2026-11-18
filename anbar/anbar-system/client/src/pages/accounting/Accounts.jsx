import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import Modal from '../../components/Modal';
import { useAuth } from '../../auth/AuthContext';

const TYPE_LABELS = { asset: 'دارایی', liability: 'بدهی', equity: 'سرمایه', revenue: 'درآمد', expense: 'هزینه' };

export default function Accounts() {
  const { can } = useAuth();
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', type: 'asset' });
  const [error, setError] = useState('');

  function load() {
    api.get('/accounting/accounts').then((res) => setList(res.data));
  }
  useEffect(load, []);

  async function save(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/accounting/accounts', form);
      setOpen(false);
      setForm({ code: '', name: '', type: 'asset' });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'خطا در ثبت حساب');
    }
  }

  return (
    <div>
      <div className="toolbar">
        <div className="text-muted" style={{ fontSize: 12.5 }}>
          دفتر حساب‌ها (Chart of Accounts) — پایه اسناد حسابداری و دفتر کل
        </div>
        {can('accounting.manage') && (
          <button className="btn btn-primary" onClick={() => setOpen(true)}>
            + حساب جدید
          </button>
        )}
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>کد</th>
              <th>نام حساب</th>
              <th>نوع</th>
              <th>سیستمی</th>
            </tr>
          </thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.id}>
                <td className="mono">{a.code}</td>
                <td>{a.name}</td>
                <td>
                  <span className="pill pill-muted">{TYPE_LABELS[a.type]}</span>
                </td>
                <td>{a.is_system ? 'بله' : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <Modal
          title="حساب جدید"
          onClose={() => setOpen(false)}
          footer={
            <>
              <button className="btn btn-outline" onClick={() => setOpen(false)}>انصراف</button>
              <button className="btn btn-primary" form="acc-form" type="submit">ثبت</button>
            </>
          }
        >
          <form id="acc-form" onSubmit={save}>
            <div className="grid grid-2">
              <div className="field">
                <label>کد حساب *</label>
                <input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
              </div>
              <div className="field">
                <label>نوع حساب *</label>
                <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <label>نام حساب *</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            {error && <div className="pill pill-danger" style={{ display: 'block', padding: '8px 12px' }}>{error}</div>}
          </form>
        </Modal>
      )}
    </div>
  );
}
