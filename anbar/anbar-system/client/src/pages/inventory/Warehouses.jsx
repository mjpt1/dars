import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import Modal from '../../components/Modal';
import { useAuth } from '../../auth/AuthContext';

export default function Warehouses() {
  const { can } = useAuth();
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', location: '' });

  function load() {
    api.get('/inventory/warehouses').then((res) => setList(res.data));
  }
  useEffect(load, []);

  async function save(e) {
    e.preventDefault();
    await api.post('/inventory/warehouses', form);
    setOpen(false);
    setForm({ name: '', location: '' });
    load();
  }

  return (
    <div>
      <div className="toolbar">
        <div />
        {can('inventory.manage') && (
          <button className="btn btn-primary" onClick={() => setOpen(true)}>
            + انبار جدید
          </button>
        )}
      </div>
      <div className="grid grid-3">
        {list.map((w) => (
          <div className="card card-pad" key={w.id}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{w.name}</div>
            <div className="text-muted" style={{ fontSize: 12.5 }}>
              {w.location || 'بدون آدرس ثبت‌شده'}
            </div>
            <span className={'pill ' + (w.is_active ? 'pill-success' : 'pill-muted')} style={{ marginTop: 10 }}>
              {w.is_active ? 'فعال' : 'غیرفعال'}
            </span>
          </div>
        ))}
      </div>

      {open && (
        <Modal
          title="انبار جدید"
          onClose={() => setOpen(false)}
          footer={
            <>
              <button className="btn btn-outline" onClick={() => setOpen(false)}>
                انصراف
              </button>
              <button className="btn btn-primary" form="wh-form" type="submit">
                ثبت
              </button>
            </>
          }
        >
          <form id="wh-form" onSubmit={save}>
            <div className="field">
              <label>نام انبار *</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="field">
              <label>مکان / آدرس</label>
              <input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
