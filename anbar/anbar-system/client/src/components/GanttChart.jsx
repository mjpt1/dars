import React, { useMemo } from 'react';

const STATUS_COLOR = {
  todo: '#9aa1b1',
  in_progress: '#3b5bfd',
  review: '#e8a725',
  done: '#1cb56a',
  blocked: '#e5484d',
};

const DAY_MS = 24 * 60 * 60 * 1000;

function toDate(str) {
  if (!str) return null;
  const d = new Date(str.includes('T') ? str : str + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

// نمودار گانت واقعی: محور زمان بر اساس تاریخ شروع/پایان وظایف رسم می‌شود و
// وابستگی بین وظایف (پایان یک وظیفه → شروع وظیفه بعدی) با یک خط اتصال نمایش داده می‌شود.
export default function GanttChart({ tasks }) {
  const dated = tasks.filter((t) => toDate(t.start_date) && toDate(t.due_date));

  const { rangeStart, rangeEnd, rows } = useMemo(() => {
    if (dated.length === 0) return { rangeStart: null, rangeEnd: null, rows: [] };
    let min = toDate(dated[0].start_date);
    let max = toDate(dated[0].due_date);
    dated.forEach((t) => {
      const s = toDate(t.start_date);
      const e = toDate(t.due_date);
      if (s < min) min = s;
      if (e > max) max = e;
    });
    min = new Date(min.getTime() - DAY_MS);
    max = new Date(max.getTime() + DAY_MS);
    const totalMs = max.getTime() - min.getTime();

    const rows = dated.map((t, idx) => {
      const s = toDate(t.start_date);
      const e = toDate(t.due_date);
      const left = ((s.getTime() - min.getTime()) / totalMs) * 100;
      const width = Math.max(((e.getTime() - s.getTime()) / totalMs) * 100, 1.5);
      return { ...t, rowIndex: idx, left, width, endPercent: left + width };
    });

    return { rangeStart: min, rangeEnd: max, rows };
  }, [dated]);

  if (rows.length === 0) {
    return (
      <div className="empty-state">
        برای نمایش نمودار گانت، تاریخ شروع و سررسید حداقل یک وظیفه را مشخص کنید
      </div>
    );
  }

  const totalMs = rangeEnd.getTime() - rangeStart.getTime();
  const todayPercent = ((Date.now() - rangeStart.getTime()) / totalMs) * 100;
  const rowHeight = 34;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => new Date(rangeStart.getTime() + totalMs * f));

  const byId = Object.fromEntries(rows.map((r) => [r.id, r]));

  return (
    <div>
      <div style={{ display: 'flex', fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, paddingRight: 180 }}>
        {ticks.map((d, i) => (
          <div key={i} style={{ flex: 1, textAlign: i === 0 ? 'right' : i === ticks.length - 1 ? 'left' : 'center' }}>
            {d.toLocaleDateString('fa-IR')}
          </div>
        ))}
      </div>

      <div style={{ position: 'relative', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        {rows.map((r) => (
          <div
            key={r.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              height: rowHeight,
              borderBottom: '1px solid var(--border)',
              background: r.rowIndex % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)',
            }}
          >
            <div
              style={{
                width: 180,
                flexShrink: 0,
                padding: '0 10px',
                fontSize: 12,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                borderLeft: '1px solid var(--border)',
              }}
              title={r.title}
            >
              {r.title}
              {r.depends_on_task_id && byId[r.depends_on_task_id] && (
                <span style={{ display: 'block', fontSize: 10, color: 'var(--text-soft)' }}>
                  ⤷ بعد از: {byId[r.depends_on_task_id].title}
                </span>
              )}
            </div>
            <div style={{ position: 'relative', flex: 1, height: '100%' }}>
              <div
                style={{
                  position: 'absolute',
                  insetInlineEnd: `${r.left}%`,
                  width: `${r.width}%`,
                  top: 7,
                  height: rowHeight - 14,
                  borderRadius: 6,
                  background: STATUS_COLOR[r.status] || 'var(--primary)',
                  opacity: r.status === 'done' ? 0.55 : 0.9,
                }}
                title={`${r.title} (${r.progress || 0}%)`}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${r.progress || 0}%`,
                    background: 'rgba(255,255,255,0.35)',
                    borderRadius: 6,
                  }}
                />
              </div>
            </div>
          </div>
        ))}

        {/* خط امروز */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            insetInlineEnd: `calc(180px + (100% - 180px) * ${todayPercent / 100})`,
            width: 2,
            background: 'var(--danger)',
            opacity: todayPercent >= 0 && todayPercent <= 100 ? 0.6 : 0,
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 11.5, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
        {Object.entries(STATUS_COLOR).map(([k, c]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: c, display: 'inline-block' }} />
            {{ todo: 'در انتظار', in_progress: 'در حال انجام', review: 'بازبینی', done: 'انجام‌شده', blocked: 'مسدود' }[k]}
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 2, background: 'var(--danger)', display: 'inline-block' }} />
          امروز
        </div>
      </div>
    </div>
  );
}
