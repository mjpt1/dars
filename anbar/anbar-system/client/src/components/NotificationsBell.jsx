import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

const POLL_MS = 30000;

export default function NotificationsBell() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef(null);

  useEffect(() => {
    let cancelled = false;
    function load() {
      api
        .get('/notifications')
        .then((res) => {
          if (!cancelled) setItems(res.data.notifications);
        })
        .catch(() => {});
    }
    load();
    const t = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button
        className="btn btn-outline btn-sm"
        onClick={() => setOpen((v) => !v)}
        style={{ position: 'relative' }}
        title="اعلان‌ها"
      >
        اعلان‌ها
        {items.length > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -6,
              insetInlineStart: -6,
              background: 'var(--danger)',
              color: '#fff',
              borderRadius: 20,
              fontSize: 10,
              minWidth: 16,
              height: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 3px',
            }}
          >
            {items.length}
          </span>
        )}
      </button>

      {open && (
        <div
          className="card"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            insetInlineEnd: 0,
            width: 320,
            zIndex: 20,
            maxHeight: 360,
            overflowY: 'auto',
          }}
        >
          {items.length === 0 ? (
            <div className="empty-state" style={{ padding: 24 }}>
              اعلان جدیدی وجود ندارد
            </div>
          ) : (
            items.map((n) => (
              <div
                key={n.id}
                onClick={() => {
                  setOpen(false);
                  navigate(n.link);
                }}
                style={{
                  padding: '12px 14px',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  borderInlineStart: `3px solid var(--${n.severity})`,
                }}
              >
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{n.title}</div>
                <div className="text-muted" style={{ fontSize: 11.5, marginTop: 3 }}>
                  {n.detail}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
