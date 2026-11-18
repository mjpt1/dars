// داده‌های اولیه: نقش‌ها، مجوزها و کاربر مدیر پیش‌فرض
const bcrypt = require('bcryptjs');
const db = require('./db');

const PERMISSIONS = [
  ['inventory.view', 'مشاهده انبار'],
  ['inventory.manage', 'مدیریت کالا و اسناد انبار'],
  ['project.view', 'مشاهده پروژه‌ها'],
  ['project.manage', 'مدیریت پروژه‌ها و وظایف'],
  ['finance.view', 'مشاهده مالی'],
  ['finance.manage', 'مدیریت فاکتور و پرداخت'],
  ['users.manage', 'مدیریت کاربران و نقش‌ها'],
  ['reports.view', 'مشاهده و خروجی گزارش‌ها'],
  ['accounting.view', 'مشاهده دفتر حساب‌ها و اسناد حسابداری'],
  ['accounting.manage', 'ثبت سند حسابداری و مدیریت دفتر حساب‌ها'],
  ['backup.manage', 'مدیریت پشتیبان‌گیری از دیتابیس'],
];

const ROLES = {
  'مدیر سیستم': PERMISSIONS.map((p) => p[0]),
  'انباردار': ['inventory.view', 'inventory.manage', 'project.view', 'reports.view'],
  'مدیر پروژه': ['project.view', 'project.manage', 'inventory.view', 'finance.view', 'reports.view'],
  'حسابدار': ['finance.view', 'finance.manage', 'inventory.view', 'reports.view', 'accounting.view', 'accounting.manage'],
};

// دفتر حساب‌های پیش‌فرض (کدینگ ساده حسابداری برای شروع سریع)
const DEFAULT_ACCOUNTS = [
  ['1000', 'صندوق و بانک', 'asset'],
  ['1100', 'حساب‌های دریافتنی (بدهکاران)', 'asset'],
  ['1200', 'موجودی کالا', 'asset'],
  ['2000', 'حساب‌های پرداختنی (بستانکاران)', 'liability'],
  ['2100', 'مالیات بر ارزش افزوده پرداختنی', 'liability'],
  ['3000', 'سرمایه', 'equity'],
  ['4000', 'درآمد فروش', 'revenue'],
  ['5000', 'بهای تمام‌شده کالای فروش‌رفته', 'expense'],
  ['5100', 'هزینه‌های اجرایی پروژه', 'expense'],
  ['5900', 'سایر هزینه‌ها', 'expense'],
];

function run() {
  const insertPerm = db.prepare('INSERT OR IGNORE INTO permissions (code, description) VALUES (?, ?)');
  for (const [code, desc] of PERMISSIONS) insertPerm.run(code, desc);

  const insertRole = db.prepare('INSERT OR IGNORE INTO roles (name) VALUES (?)');
  const getRole = db.prepare('SELECT id FROM roles WHERE name = ?');
  const getPerm = db.prepare('SELECT id FROM permissions WHERE code = ?');
  const linkPerm = db.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)');

  for (const [roleName, perms] of Object.entries(ROLES)) {
    insertRole.run(roleName);
    const role = getRole.get(roleName);
    for (const code of perms) {
      const perm = getPerm.get(code);
      if (perm) linkPerm.run(role.id, perm.id);
    }
  }

  const adminRole = getRole.get('مدیر سیستم');
  const existingAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!existingAdmin) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare(
      'INSERT INTO users (username, password_hash, full_name, role_id) VALUES (?, ?, ?, ?)'
    ).run('admin', hash, 'مدیر سیستم', adminRole.id);
    console.log('کاربر مدیر پیش‌فرض ساخته شد -> نام کاربری: admin | رمز عبور: admin123');
  }

  // واحدها و یک انبار پیش‌فرض برای شروع سریع
  const insertUnit = db.prepare('INSERT OR IGNORE INTO units (name) VALUES (?)');
  ['عدد', 'کیلوگرم', 'متر', 'بسته', 'کارتن', 'لیتر'].forEach((u) => insertUnit.run(u));

  db.prepare('INSERT OR IGNORE INTO warehouses (id, name, location) VALUES (1, ?, ?)').run(
    'انبار مرکزی',
    'دفتر اصلی'
  );

  const insertAccount = db.prepare(
    'INSERT OR IGNORE INTO accounts (code, name, type, is_system) VALUES (?, ?, ?, 1)'
  );
  for (const [code, name, type] of DEFAULT_ACCOUNTS) insertAccount.run(code, name, type);

  console.log('داده‌های اولیه با موفقیت درج شد.');
}

run();
