import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import Modal from '../components/Modal';
import { dateFa } from '../utils/format';

export default function Users() {
  const [list, setList] = useState([]);
  const [roles, setRoles] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', full_name: '', role_id: '' });
  const [error, setError] = useState('');

  function load() {
    api.get('/users').then((res) => setList(res.data));
    api.get('/users/roles').then((res) => setRoles(res.data));
  }
  useEffect(load, []);

  async function save(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/users', form);
      setOpen(false);
      setForm({ username: '', password: '', full_name: '', role_id: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'خطا در ثبت کاربر');
    }
  }

  async function toggleActive(u) {
    await api.put(`/users/${u.id}`, { full_name: u.full_name, role_id: u.role_id, is_active: u.is_active ? 0 : 1 });
    load();
  }

  return (
    <div>
      <div className="toolbar">
        <div className="text-muted" style={{ fontSize: 12.5 }}>
          مدیریت کاربران سیستم و نقش‌های دسترسی
        </div>
        <button className="btn btn-primary" onClick={() => setOpen(true)}>
          + کاربر جدید
        </button>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>نام کاربری</th>
              <th>نام کامل</th>
              <th>نقش</th>
              <th>آخرین ورود</th>
              <th>وضعیت</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id}>
                <td className="mono">{u.username}</td>
                <td>{u.full_name}</td>
                <td>
                  <span className="pill pill-primary">{u.role_name}</span>
                </td>
                <td>{u.last_login_at ? dateFa(u.last_login_at) : 'هرگز'}</td>
                <td>
                  <span className={'pill ' + (u.is_active ? 'pill-success' : 'pill-muted')}>
                    {u.is_active ? 'فعال' : 'غیرفعال'}
                  </span>
                </td>
                <td>
                  <button className="btn btn-outline btn-sm" onClick={() => toggleActive(u)}>
                    {u.is_active ? 'غیرفعال کردن' : 'فعال کردن'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <Modal title="کاربر جدید" onClose={() => setOpen(false)}>
          <form onSubmit={save} id="user-form">
            <div className="field">
              <label>نام کامل *</label>
              <input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            </div>
            <div className="grid grid-2">
              <div className="field">
                <label>نام کاربری *</label>
                <input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
              </div>
              <div className="field">
                <label>رمز عبور *</label>
                <input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              </div>
            </div>
            <div className="field">
              <label>نقش *</label>
              <select className="input" value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })} required>
                <option value="">انتخاب کنید</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            {error && <div className="pill pill-danger" style={{ display: 'block', padding: '8px 12px' }}>{error}</div>}
          </form>
          <div className="modal-footer" style={{ marginTop: 12 }}>
            <button className="btn btn-outline" type="button" onClick={() => setOpen(false)}>
              انصراف
            </button>
            <button className="btn btn-primary" type="submit" form="user-form">
              ثبت کاربر
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
