const express = require('express');
const db = require('../db');
const { authenticate, requirePermission } = require('../middleware/auth');
const { postInvoiceEntry, postPaymentEntry } = require('../services/accounting');

const router = express.Router();
router.use(authenticate);

// ---------- تامین‌کنندگان و مشتریان ----------
router.get('/suppliers', requirePermission('finance.view'), (req, res) => {
  res.json(db.prepare('SELECT * FROM suppliers ORDER BY name').all());
});
router.post('/suppliers', requirePermission('finance.manage'), (req, res) => {
  const { name, phone, address, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'نام تامین‌کننده الزامی است' });
  const info = db.prepare('INSERT INTO suppliers (name, phone, address, notes) VALUES (?, ?, ?, ?)').run(name, phone || null, address || null, notes || null);
  res.status(201).json({ id: info.lastInsertRowid });
});

router.get('/customers', requirePermission('finance.view'), (req, res) => {
  res.json(db.prepare('SELECT * FROM customers ORDER BY name').all());
});
router.post('/customers', requirePermission('finance.manage'), (req, res) => {
  const { name, phone, address, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'نام مشتری الزامی است' });
  const info = db.prepare('INSERT INTO customers (name, phone, address, notes) VALUES (?, ?, ?, ?)').run(name, phone || null, address || null, notes || null);
  res.status(201).json({ id: info.lastInsertRowid });
});

// ---------- فاکتورها ----------
router.get('/invoices', requirePermission('finance.view'), (req, res) => {
  res.json(
    db
      .prepare(
        `SELECT inv.*, s.name AS supplier_name, c.name AS customer_name
         FROM invoices inv
         LEFT JOIN suppliers s ON s.id = inv.supplier_id
         LEFT JOIN customers c ON c.id = inv.customer_id
         ORDER BY inv.id DESC LIMIT 200`
      )
      .all()
  );
});

router.post('/invoices', requirePermission('finance.manage'), (req, res) => {
  const { invoice_type, supplier_id, customer_id, stock_document_id, total_amount, tax_rate, due_date, post_to_accounting } = req.body;
  if (!invoice_type || !total_amount) return res.status(400).json({ error: 'نوع فاکتور و مبلغ الزامی است' });

  const subtotal = Number(total_amount);
  const rate = Number(tax_rate) || 0;
  const taxAmount = Math.round((subtotal * rate) / 100);
  const grandTotal = subtotal + taxAmount;
  const invoiceNumber = `${invoice_type === 'purchase' ? 'PUR' : 'SAL'}-${Date.now()}`;

  try {
    const info = db
      .prepare(
        `INSERT INTO invoices (invoice_number, invoice_type, supplier_id, customer_id, stock_document_id, subtotal_amount, tax_rate, tax_amount, total_amount, due_date, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        invoiceNumber,
        invoice_type,
        supplier_id || null,
        customer_id || null,
        stock_document_id || null,
        subtotal,
        rate,
        taxAmount,
        grandTotal,
        due_date || null,
        req.user.id
      );
    const invoiceId = info.lastInsertRowid;

    if (post_to_accounting !== false) {
      const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
      postInvoiceEntry(invoice, req.user.id);
    }

    res.status(201).json({ id: invoiceId, invoice_number: invoiceNumber, tax_amount: taxAmount, total_amount: grandTotal });
  } catch (e) {
    res.status(400).json({ error: 'خطا در ثبت فاکتور: ' + e.message });
  }
});

// ---------- پرداخت‌ها ----------
router.post('/invoices/:id/payments', requirePermission('finance.manage'), (req, res) => {
  const { amount, method, notes } = req.body;
  if (!amount) return res.status(400).json({ error: 'مبلغ پرداخت الزامی است' });

  const tx = db.transaction(() => {
    db.prepare('INSERT INTO payments (invoice_id, amount, method, notes) VALUES (?, ?, ?, ?)').run(
      req.params.id,
      amount,
      method || 'cash',
      notes || null
    );
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
    const newPaid = invoice.paid_amount + Number(amount);
    const status = newPaid >= invoice.total_amount ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid';
    db.prepare('UPDATE invoices SET paid_amount = ?, status = ? WHERE id = ?').run(newPaid, status, req.params.id);
    postPaymentEntry(invoice, Number(amount), req.user.id);
  });

  try {
    tx();
    res.status(201).json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: 'خطا در ثبت پرداخت: ' + e.message });
  }
});

module.exports = router;
