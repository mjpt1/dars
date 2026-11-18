const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const notifications = [];

  if (req.user.permissions.includes('inventory.view')) {
    const lowStock = db
      .prepare(
        `SELECT i.id, i.name, i.min_stock, COALESCE(SUM(b.quantity), 0) AS total
         FROM items i LEFT JOIN stock_balances b ON b.item_id = i.id
         WHERE i.is_active = 1
         GROUP BY i.id HAVING total <= i.min_stock`
      )
      .all();
    for (const it of lowStock) {
      notifications.push({
        id: `low-stock-${it.id}`,
        type: 'low_stock',
        severity: 'warning',
        title: `کمبود موجودی: ${it.name}`,
        detail: `موجودی فعلی ${it.total} است، کمتر یا مساوی حداقل مجاز (${it.min_stock})`,
        link: '/inventory/items',
      });
    }
  }

  if (req.user.permissions.includes('finance.view')) {
    const dueInvoices = db
      .prepare(
        `SELECT id, invoice_number, due_date, total_amount, paid_amount
         FROM invoices
         WHERE status IN ('unpaid','partial') AND due_date IS NOT NULL
               AND date(due_date) <= date('now', '+3 day')`
      )
      .all();
    for (const inv of dueInvoices) {
      const overdue = new Date(inv.due_date) < new Date();
      notifications.push({
        id: `invoice-due-${inv.id}`,
        type: 'invoice_due',
        severity: overdue ? 'danger' : 'warning',
        title: `${overdue ? 'سررسید گذشته' : 'نزدیک به سررسید'}: فاکتور ${inv.invoice_number}`,
        detail: `مانده ${inv.total_amount - inv.paid_amount} تومان — سررسید ${inv.due_date}`,
        link: '/finance/invoices',
      });
    }
  }

  res.json({ count: notifications.length, notifications });
});

module.exports = router;
