import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { money, dateFa, PROJECT_STATUS_LABELS, TASK_STATUS_LABELS } from '../utils/format';
import { useAuth } from '../auth/AuthContext';
import GanttChart from '../components/GanttChart';

const TABS = [
  { key: 'tasks', label: 'وظایف' },
  { key: 'gantt', label: 'نمودار گانت' },
  { key: 'costs', label: 'هزینه‌ها' },
];

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const [detail, setDetail] = useState(null);
  const [tab, setTab] = useState('tasks');
  const [newTask, setNewTask] = useState('');
  const [newTaskDeps, setNewTaskDeps] = useState({ start_date: '', due_date: '', depends_on_task_id: '' });
  const [newCost, setNewCost] = useState({ cost_type: 'material', title: '', amount: '' });

  function load() {
    api.get(`/projects/${id}`).then((res) => setDetail(res.data));
  }
  useEffect(load, [id]);

  async function addTask(e) {
    e.preventDefault();
    if (!newTask.trim()) return;
    await api.post(`/projects/${id}/tasks`, {
      title: newTask,
      start_date: newTaskDeps.start_date || null,
      due_date: newTaskDeps.due_date || null,
      depends_on_task_id: newTaskDeps.depends_on_task_id || null,
    });
    setNewTask('');
    setNewTaskDeps({ start_date: '', due_date: '', depends_on_task_id: '' });
    load();
  }

  async function toggleTask(task) {
    const nextStatus = task.status === 'done' ? 'todo' : 'done';
    await api.put(`/projects/tasks/${task.id}`, {
      ...task,
      status: nextStatus,
      progress: nextStatus === 'done' ? 100 : task.progress,
    });
    load();
  }

  async function addCost(e) {
    e.preventDefault();
    if (!newCost.title || !newCost.amount) return;
    await api.post(`/projects/${id}/costs`, newCost);
    setNewCost({ cost_type: 'material', title: '', amount: '' });
    load();
  }

  if (!detail) return <div className="empty-state">در حال بارگذاری...</div>;

  return (
    <div>
      <button className="btn btn-outline btn-sm" onClick={() => navigate('/projects')} style={{ marginBottom: 16 }}>
        ← بازگشت به پروژه‌ها
      </button>

      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{detail.name}</div>
            <div className="text-muted mono" style={{ fontSize: 12 }}>
              {detail.code}
            </div>
          </div>
          <span className="pill pill-primary">{PROJECT_STATUS_LABELS[detail.status]}</span>
        </div>
        <div className="grid grid-3" style={{ marginTop: 16 }}>
          <div>
            <div className="text-muted" style={{ fontSize: 11.5 }}>بودجه</div>
            <div className="mono">{money(detail.budget)} تومان</div>
          </div>
          <div>
            <div className="text-muted" style={{ fontSize: 11.5 }}>هزینه‌شده</div>
            <div className="mono">{money(detail.costs.reduce((s, c) => s + c.amount, 0))} تومان</div>
          </div>
          <div>
            <div className="text-muted" style={{ fontSize: 11.5 }}>بازه زمانی</div>
            <div>
              {detail.start_date ? dateFa(detail.start_date) : '-'} تا {detail.end_date ? dateFa(detail.end_date) : '-'}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={'btn btn-sm ' + (tab === t.key ? 'btn-primary' : 'btn-outline')}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'tasks' && (
        <div className="card card-pad">
          {can('project.manage') && (
            <form onSubmit={addTask} style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <input
                className="input"
                placeholder="عنوان وظیفه جدید..."
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                style={{ flex: 2, minWidth: 180 }}
              />
              <input
                className="input"
                type="date"
                value={newTaskDeps.start_date}
                onChange={(e) => setNewTaskDeps({ ...newTaskDeps, start_date: e.target.value })}
                style={{ flex: 1, minWidth: 130 }}
                title="تاریخ شروع"
              />
              <input
                className="input"
                type="date"
                value={newTaskDeps.due_date}
                onChange={(e) => setNewTaskDeps({ ...newTaskDeps, due_date: e.target.value })}
                style={{ flex: 1, minWidth: 130 }}
                title="سررسید"
              />
              <select
                className="input"
                value={newTaskDeps.depends_on_task_id}
                onChange={(e) => setNewTaskDeps({ ...newTaskDeps, depends_on_task_id: e.target.value })}
                style={{ flex: 1, minWidth: 160 }}
              >
                <option value="">بدون وابستگی</option>
                {detail.tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    بعد از: {t.title}
                  </option>
                ))}
              </select>
              <button className="btn btn-primary btn-sm">افزودن وظیفه</button>
            </form>
          )}

          {detail.tasks.length === 0 ? (
            <div className="empty-state">وظیفه‌ای ثبت نشده است</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>عنوان</th>
                  <th>شروع</th>
                  <th>سررسید</th>
                  <th>وابسته به</th>
                  <th>وضعیت</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {detail.tasks.map((t) => (
                  <tr key={t.id}>
                    <td style={{ textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>{t.title}</td>
                    <td>{t.start_date ? dateFa(t.start_date) : '-'}</td>
                    <td>{t.due_date ? dateFa(t.due_date) : '-'}</td>
                    <td className="text-muted" style={{ fontSize: 12 }}>
                      {detail.tasks.find((x) => x.id === t.depends_on_task_id)?.title || '-'}
                    </td>
                    <td>
                      <span className="pill pill-muted">{TASK_STATUS_LABELS[t.status]}</span>
                    </td>
                    <td>
                      <button className="btn btn-outline btn-sm" onClick={() => toggleTask(t)}>
                        {t.status === 'done' ? 'بازگشایی' : 'اتمام'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'gantt' && (
        <div className="card card-pad">
          <GanttChart tasks={detail.tasks} />
        </div>
      )}

      {tab === 'costs' && (
        <div className="card card-pad">
          {can('project.manage') && (
            <form onSubmit={addCost} style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <select
                className="input"
                value={newCost.cost_type}
                onChange={(e) => setNewCost({ ...newCost, cost_type: e.target.value })}
                style={{ flex: 1, minWidth: 130 }}
              >
                <option value="material">مصالح</option>
                <option value="labor">نیروی انسانی</option>
                <option value="service">خدمات</option>
                <option value="other">سایر</option>
              </select>
              <input
                className="input"
                placeholder="عنوان هزینه"
                value={newCost.title}
                onChange={(e) => setNewCost({ ...newCost, title: e.target.value })}
                style={{ flex: 2, minWidth: 160 }}
              />
              <input
                className="input"
                type="number"
                placeholder="مبلغ"
                value={newCost.amount}
                onChange={(e) => setNewCost({ ...newCost, amount: e.target.value })}
                style={{ flex: 1, minWidth: 120 }}
              />
              <button className="btn btn-primary btn-sm">ثبت هزینه</button>
            </form>
          )}
          {detail.costs.length === 0 ? (
            <div className="empty-state">هزینه‌ای ثبت نشده است</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>عنوان</th>
                  <th>نوع</th>
                  <th>مبلغ</th>
                  <th>تاریخ</th>
                </tr>
              </thead>
              <tbody>
                {detail.costs.map((c) => (
                  <tr key={c.id}>
                    <td>{c.title}</td>
                    <td>{{ material: 'مصالح', labor: 'نیروی انسانی', service: 'خدمات', other: 'سایر' }[c.cost_type]}</td>
                    <td className="mono">{money(c.amount)}</td>
                    <td>{dateFa(c.cost_date)}</td>
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
