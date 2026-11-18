import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import Modal from '../components/Modal';
import { money, PROJECT_STATUS_LABELS } from '../utils/format';
import { useAuth } from '../auth/AuthContext';

function StatusPill({ status, map }) {
  const cls = { active: 'pill-success', done: 'pill-success', planned: 'pill-primary', on_hold: 'pill-warning', blocked: 'pill-danger', cancelled: 'pill-danger' }[status] || 'pill-muted';
  return <span className={'pill ' + cls}>{map[status] || status}</span>;
}

export default function Projects() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', budget: 0, description: '' });

  function load() {
    api.get('/projects').then((res) => setList(res.data));
  }
  useEffect(load, []);

  async function save(e) {
    e.preventDefault();
    await api.post('/projects', form);
    setOpen(false);
    setForm({ code: '', name: '', budget: 0, description: '' });
    load();
  }

  return (
    <div>
      <div className="toolbar">
        <div className="text-muted" style={{ fontSize: 12.5 }}>
          مدیریت پروژه‌ها، وظایف، نمودار گانت و هزینه‌های اجرایی
        </div>
        {can('project.manage') && (
          <button className="btn btn-primary" onClick={() => setOpen(true)}>
            + پروژه جدید
          </button>
        )}
      </div>

      <div className="grid grid-3">
        {list.map((p) => {
          const pct = p.task_count ? Math.round((p.done_count / p.task_count) * 100) : 0;
          return (
            <div className="card card-pad" key={p.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/projects/${p.id}`)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{p.name}</div>
                  <div className="text-muted mono" style={{ fontSize: 11.5 }}>
                    {p.code}
                  </div>
                </div>
                <StatusPill status={p.status} map={PROJECT_STATUS_LABELS} />
              </div>
              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 6 }}>
                  <span className="text-muted">پیشرفت وظایف</span>
                  <span>{pct}%</span>
                </div>
                <div className="progress">
                  <div style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontSize: 12 }}>
                <span className="text-muted">بودجه: {money(p.budget)}</span>
                <span className="text-muted">هزینه‌شده: {money(p.spent)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {open && (
        <Modal
          title="پروژه جدید"
          onClose={() => setOpen(false)}
          footer={
            <>
              <button className="btn btn-outline" onClick={() => setOpen(false)}>
                انصراف
              </button>
              <button className="btn btn-primary" form="proj-form" type="submit">
                ثبت پروژه
              </button>
            </>
          }
        >
          <form id="proj-form" onSubmit={save}>
            <div className="grid grid-2">
              <div className="field">
                <label>کد پروژه *</label>
                <input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
              </div>
              <div className="field">
                <label>بودجه (تومان)</label>
                <input className="input" type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label>نام پروژه *</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="field">
              <label>توضیحات</label>
              <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
