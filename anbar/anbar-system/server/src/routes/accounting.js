const express = require('express');
const db = require('../db');
const { authenticate, requirePermission } = require('../middleware/auth');
const { postEntry } = require('../services/accounting');

const router = express.Router();
router.use(authenticate);

// ---------- دفتر حساب‌ها (Chart of Accounts) ----------
router.get('/accounts', requirePermission('accounting.view'), (req, res) => {
  res.json(db.prepare('SELECT * FROM accounts ORDER BY code').all());
});

router.post('/accounts', requirePermission('accounting.manage'), (req, res) => {
  const { code, name, type, parent_id } = req.body;
  if (!code || !name || !type) return res.status(400).json({ error: 'کد، نام و نوع حساب الزامی است' });
  try {
    const info = db
      .prepare('INSERT INTO accounts (code, name, type, parent_id) VALUES (?, ?, ?, ?)')
      .run(code, name, type, parent_id || null);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: 'کد حساب تکراری است' });
  }
});

// ---------- دفتر کل یک حساب ----------
router.get('/ledger/:accountId', requirePermission('accounting.view'), (req, res) => {
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.accountId);
  if (!account) return res.status(404).json({ error: 'حساب یافت نشد' });

  const lines = db
    .prepare(
      `SELECT jl.*, je.entry_number, je.entry_date, je.description AS entry_description, je.source
       FROM journal_entry_lines jl
       JOIN journal_entries je ON je.id = jl.entry_id
       WHERE jl.account_id = ?
       ORDER BY je.entry_date, je.id`
    )
    .all(req.params.accountId);

  let balance = 0;
  const isDebitNature = account.type === 'asset' || account.type === 'expense';
  const rows = lines.map((l) => {
    balance += isDebitNature ? l.debit - l.credit : l.credit - l.debit;
    return { ...l, running_balance: balance };
  });

  res.json({ account, lines: rows, closing_balance: balance });
});

// ---------- اسناد حسابداری ----------
router.get('/journal-entries', requirePermission('accounting.view'), (req, res) => {
  const entries = db
    .prepare(
      `SELECT je.*, u.full_name AS created_by_name,
              (SELECT COALESCE(SUM(debit),0) FROM journal_entry_lines WHERE entry_id = je.id) AS total
       FROM journal_entries je
       LEFT JOIN users u ON u.id = je.created_by
       ORDER BY je.id DESC LIMIT 200`
    )
    .all();
  res.json(entries);
});

router.get('/journal-entries/:id', requirePermission('accounting.view'), (req, res) => {
  const entry = db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(req.params.id);
  if (!entry) return res.status(404).json({ error: 'سند یافت نشد' });
  const lines = db
    .prepare(
      `SELECT jl.*, a.code AS account_code, a.name AS account_name
       FROM journal_entry_lines jl JOIN accounts a ON a.id = jl.account_id
       WHERE jl.entry_id = ?`
    )
    .all(req.params.id);
  res.json({ ...entry, lines });
});

router.post('/journal-entries', requirePermission('accounting.manage'), (req, res) => {
  const { description, lines } = req.body;
  if (!Array.isArray(lines) || lines.length < 2) {
    return res.status(400).json({ error: 'سند حسابداری باید حداقل دو ردیف (بدهکار و بستانکار) داشته باشد' });
  }
  try {
    const entryId = postEntry({
      description,
      source: 'manual',
      created_by: req.user.id,
      lines: lines.map((l) => ({ account_id: Number(l.account_id), debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 })),
    });
    res.status(201).json({ id: entryId });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
