const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const db = require('../db');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'anbar.db');
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(path.dirname(DB_PATH), 'backups');
const RETENTION_COUNT = Number(process.env.BACKUP_RETENTION_COUNT || 20);

fs.mkdirSync(BACKUP_DIR, { recursive: true });

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function runBackup() {
  // تخلیه کامل WAL به فایل اصلی تا نسخه پشتیبان همیشه سازگار و کامل باشد
  db.pragma('wal_checkpoint(TRUNCATE)');
  const dest = path.join(BACKUP_DIR, `anbar-backup-${timestamp()}.db`);
  fs.copyFileSync(DB_PATH, dest);
  cleanupOldBackups();
  return dest;
}

function cleanupOldBackups() {
  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.db'))
    .map((f) => ({ name: f, time: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
    .sort((a, b) => b.time - a.time);

  for (const old of files.slice(RETENTION_COUNT)) {
    fs.unlinkSync(path.join(BACKUP_DIR, old.name));
  }
}

function listBackups() {
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.db'))
    .map((f) => {
      const stat = fs.statSync(path.join(BACKUP_DIR, f));
      return { name: f, size: stat.size, created_at: stat.mtime };
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

// زمان‌بندی پیش‌فرض: هر روز ساعت ۲۳:۰۰ (قابل تغییر با BACKUP_CRON در .env)
// مثال‌ها: هر ۶ ساعت -> "0 */6 * * *"    |    هر شب ساعت ۲۳ -> "0 23 * * *"
function startScheduler() {
  const cronExpr = process.env.BACKUP_CRON || '0 23 * * *';
  cron.schedule(cronExpr, () => {
    try {
      const dest = runBackup();
      console.log(`[پشتیبان‌گیری خودکار] با موفقیت انجام شد: ${dest}`);
    } catch (e) {
      console.error('[پشتیبان‌گیری خودکار] خطا:', e.message);
    }
  });
  console.log(`زمان‌بندی پشتیبان‌گیری خودکار فعال شد (${cronExpr})`);
}

module.exports = { runBackup, listBackups, startScheduler, BACKUP_DIR };
