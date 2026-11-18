import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { money } from '../../utils/format';
import { downloadFile } from '../../utils/download';

const COST_LABELS = { material: 'مصالح', labor: 'نیروی انسانی', service: 'خدمات', other: 'سایر' };

export default function ProjectPL() {
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/projects').then((res) => setProjects(res.data));
  }, []);

  useEffect(() => {
    if (projectId) {
      api.get(`/reports/project-pl/${projectId}`).then((res) => setData(res.data));
    } else {
      setData(null);
    }
  }, [projectId]);

  return (
    <div>
      <div className="toolbar no-print">
        <select className="input" style={{ maxWidth: 320 }} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">— یک پروژه را برای مشاهده سود و زیان انتخاب کنید —</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.code})
            </option>
          ))}
        </select>
        {projectId && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-outline"
              onClick={() => downloadFile(`/reports/project-pl/${projectId}/export`, `project-pl-${projectId}.xlsx`)}
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
        <div className="empty-state">برای مشاهده گزارش، یک پروژه انتخاب کنید</div>
      ) : (
        <div className="grid grid-2">
          <div className="grid" style={{ gridTemplateColumns: '1fr', gap: 12 }}>
            <div className="stat-card">
              <div className="label">بودجه پروژه</div>
              <div className="value">{money(data.budget)}</div>
            </div>
            <div className="stat-card">
              <div className="label">جمع هزینه‌های اجرایی</div>
              <div className="value">{money(data.total_cost)}</div>
            </div>
            <div className="stat-card">
              <div className="label">بودجه باقیمانده / سود تخمینی</div>
              <div className="value" style={{ color: data.remaining_budget >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {money(data.remaining_budget)}
              </div>
              {data.margin_percent !== null && (
                <div className="trend text-muted">حاشیه سود تخمینی: {data.margin_percent}%</div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>تفکیک هزینه‌ها بر اساس نوع</h3>
            </div>
            {data.costs_by_type.length === 0 ? (
              <div className="empty-state">هزینه‌ای ثبت نشده است</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>نوع هزینه</th>
                    <th>مبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {data.costs_by_type.map((c) => (
                    <tr key={c.cost_type}>
                      <td>{COST_LABELS[c.cost_type] || c.cost_type}</td>
                      <td className="mono">{money(c.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
