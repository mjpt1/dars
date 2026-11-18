import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import Modal from '../../components/Modal';
import { useAuth } from '../../auth/AuthContext';

function PartyList({ title, endpoint, can }) {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', address: '' });

  function load() {
    api.get(endpoint).then((res) => setList(res.data));
  }
  useEffect(load, []);

  async function save(e) {
    e.preventDefault();
    await api.post(endpoint, form);
    setOpen(false);
    setForm({ name: '', phone: '', address: '' });
    load();
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3>{title}</h3>
        {can && (
          <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>
            + افزودن
          </button>
        )}
      </div>
      {list.length === 0 ? (
        <div className="empty-state">موردی ثبت نشده است</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>نام</th>
              <th>تلفن</th>
              <th>آدرس</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td className="mono">{p.phone || '-'}</td>
                <td>{p.address || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {open && (
        <Modal
          title={`${title} جدید`}
          onClose={() => setOpen(false)}
          footer={
            <>
              <button className="btn btn-outline" onClick={() => setOpen(false)}>انصراف</button>
              <button className="btn btn-primary" form={`f-${endpoint}`} type="submit">ثبت</button>
            </>
          }
        >
          <form id={`f-${endpoint}`} onSubmit={save}>
            <div className="field">
              <label>نام *</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="field">
              <label>تلفن</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="field">
              <label>آدرس</label>
              <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default function Parties() {
  const { can } = useAuth();
  const manage = can('finance.manage');
  return (
    <div className="grid grid-2">
      <PartyList title="مشتریان" endpoint="/finance/customers" can={manage} />
      <PartyList title="تامین‌کنندگان" endpoint="/finance/suppliers" can={manage} />
    </div>
  );
}
