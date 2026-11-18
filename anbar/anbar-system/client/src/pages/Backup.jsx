import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { money, dateFa } from '../utils/format';
import { downloadFile } from '../utils/download';

export default function Backup() {
  const [data, setData] = useState(null);
  const [running, setRunning] = useState(false);

  function load() {
    api.get('/backup').then((res) => setData(res.data));
  }
  useEffect(load, []);

  async function runNow() {
    setRunning(true);
    try {
      await api.post('/backup/run');
      load();
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <div className="toolbar">
        <div className="text-muted" style={{ fontSize: 12.5 }}>
          هر شب ساعت ۲۳:۰۰ به‌صورت خودکار از دیتابیس پشتیبان تهیه می‌شود (قابل تغییر با BACKUP_CRON در فایل .env سرور).
          آخرین ۲۰ نسخه نگه‌داری می‌شود.
        </div>
        <button className="btn btn-primary" onClick={runNow} disabled={running}>
          {running ? 'در حال تهیه پشتیبان...' : 'تهیه پشتیبان دستی'}
        </button>
      </div>

      <div className="card">
        {!data || data.backups.length === 0 ? (
          <div className="empty-state">هنوز پشتیبانی تهیه نشده است</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>نام فایل</th>
                <th>حجم</th>
                <th>تاریخ ایجاد</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.backups.map((b) => (
                <tr key={b.name}>
                  <td className="mono">{b.name}</td>
                  <td className="mono">{money(Math.round(b.size / 1024))} کیلوبایت</td>
                  <td>{dateFa(b.created_at)}</td>
                  <td>
                    <button className="btn btn-outline btn-sm" onClick={() => downloadFile(`/backup/download/${b.name}`, b.name)}>
                      دانلود
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
