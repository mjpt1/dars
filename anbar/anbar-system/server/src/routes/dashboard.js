const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/summary', (req, res) => {
  const itemCount = db.prepare('SELECT COUNT(*) c FROM items WHERE is_active = 1').get().c;
  const lowStock = db
    .prepare(
      `SELECT i.id, i.name, i.min_stock, COALESCE(SUM(b.quantity), 0) AS total
       FROM items i LEFT JOIN stock_balances b ON b.item_id = i.id
       WHERE i.is_active = 1
       GROUP BY i.id HAVING total <= i.min_stock`
    )
    .all();
  const activeProjects = db.prepare("SELECT COUNT(*) c FROM projects WHERE status = 'active'").get().c;
  const openTasks = db
    .prepare("SELECT COUNT(*) c FROM project_tasks WHERE status NOT IN ('done')")
    .get().c;
  const unpaidInvoices = db
    .prepare("SELECT COUNT(*) c, COALESCE(SUM(total_amount - paid_amount),0) s FROM invoices WHERE status IN ('unpaid','partial')")
    .get();
  const recentDocs = db
    .prepare(
      `SELECT sd.id, sd.doc_number, sd.doc_type, sd.doc_date, w.name AS warehouse
       FROM stock_documents sd JOIN warehouses w ON w.id = sd.warehouse_id
       ORDER BY sd.id DESC LIMIT 8`
    )
    .all();

  res.json({
    itemCount,
    lowStockCount: lowStock.length,
    lowStockItems: lowStock.slice(0, 6),
    activeProjects,
    openTasks,
    unpaidInvoiceCount: unpaidInvoices.c,
    unpaidInvoiceTotal: unpaidInvoices.s,
    recentDocs,
  });
});

module.exports = router;
