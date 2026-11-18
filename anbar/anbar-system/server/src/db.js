const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
// از ماژول داخلی node:sqlite استفاده می‌کنیم (به‌جای better-sqlite3) چون نیازی به
// دانلود باینری از GitHub یا نصب کامپایلر C++‌ (Visual Studio Build Tools) ندارد؛
// در Node.js نسخه ۲۲.۵ به بالا به‌صورت داخلی و بدون هیچ نصب اضافه‌ای موجود است.

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'anbar.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL'); // اجازه‌ی خواندن هم‌زمان چند کلاینت روی شبکه محلی
db.exec('PRAGMA foreign_keys = ON');

// سازگاری با متد pragma() که در سرویس پشتیبان‌گیری استفاده شده
db.pragma = function (stmt) {
  return db.exec(`PRAGMA ${stmt}`);
};

// سازگاری با الگوی db.transaction(fn) که در چند روت برای تراکنش اتمیک استفاده شده
db.transaction = function (fn) {
  return (...args) => {
    db.exec('BEGIN');
    try {
      const result = fn(...args);
      db.exec('COMMIT');
      return result;
    } catch (e) {
      try {
        db.exec('ROLLBACK');
      } catch (_) {
        /* ignore rollback errors */
      }
      throw e;
    }
  };
};

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// ---------------------------------------------------------------------
// مهاجرت سبک برای دیتابیس‌های قبلی: ستون‌های جدیدی که به جداول موجود
// اضافه شده‌اند اینجا به‌صورت ایمن (idempotent) اعمال می‌شوند.
// ---------------------------------------------------------------------
function columnExists(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
}
function addColumnIfMissing(table, column, definition) {
  if (!columnExists(table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

addColumnIfMissing('project_tasks', 'depends_on_task_id', 'INTEGER REFERENCES project_tasks(id)');
addColumnIfMissing('invoices', 'subtotal_amount', 'REAL NOT NULL DEFAULT 0');
addColumnIfMissing('invoices', 'tax_rate', 'REAL NOT NULL DEFAULT 0');
addColumnIfMissing('invoices', 'tax_amount', 'REAL NOT NULL DEFAULT 0');

module.exports = db;
