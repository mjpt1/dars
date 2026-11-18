const express = require('express');
const ExcelJS = require('exceljs');
const db = require('../db');
const { authenticate, requirePermission } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);
router.use(requirePermission('reports.view'));

const DOC_TYPE_LABELS = {
  receipt_purchase: 'رسید خرید',
  receipt_return: 'رسید مرجوعی از مشتری',
  receipt_transfer: 'رسید انتقال',
  issue_sale: 'حواله فروش',
  issue_project: 'حواله مصرف پروژه',
  issue_return: 'حواله مرجوعی به تامین‌کننده',
  issue_transfer: 'حواله انتقال',
  adjustment: 'اصلاح موجودی',
};
const IN_TYPES = ['receipt_purchase', 'receipt_return', 'receipt_transfer'];

// ============ کاردکس کالا (Item Ledger) ============
function buildItemLedger(itemId) {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(itemId);
  if (!item) return null;

  const rows = db
    .prepare(
      `SELECT sd.doc_number, sd.doc_type, sd.doc_date, w.name AS warehouse_name,
              sdi.quantity, sdi.unit_price
       FROM stock_document_items sdi
       JOIN stock_documents sd ON sd.id = sdi.document_id
       JOIN warehouses w ON w.id = sd.warehouse_id
       WHERE sdi.item_id = ? AND sd.status != 'cancelled'
       ORDER BY sd.doc_date, sd.id`
    )
    .all(itemId);

  let balance = 0;
  const lines = rows.map((r) => {
    const isIn = IN_TYPES.includes(r.doc_type) || r.doc_type === 'adjustment';
    const qtyIn = r.doc_type === 'adjustment' ? Math.max(r.quantity, 0) : IN_TYPES.includes(r.doc_type) ? r.quantity : 0;
    const qtyOut = r.doc_type === 'adjustment' ? Math.max(-r.quantity, 0) : !IN_TYPES.includes(r.doc_type) ? r.quantity : 0;
    balance += qtyIn - qtyOut;
    return {
      doc_number: r.doc_number,
      doc_type: r.doc_type,
      doc_type_label: DOC_TYPE_LABELS[r.doc_type] || r.doc_type,
      doc_date: r.doc_date,
      warehouse_name: r.warehouse_name,
      qty_in: qtyIn,
      qty_out: qtyOut,
      unit_price: r.unit_price,
      balance,
    };
  });

  return { item, lines, closing_balance: balance };
}

router.get('/item-ledger/:itemId', (req, res) => {
  const result = buildItemLedger(req.params.itemId);
  if (!result) return res.status(404).json({ error: 'کالا یافت نشد' });
  res.json(result);
});

router.get('/item-ledger/:itemId/export', async (req, res) => {
  const result = buildItemLedger(req.params.itemId);
  if (!result) return res.status(404).json({ error: 'کالا یافت نشد' });

  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('کاردکس کالا');
  sheet.views = [{ rightToLeft: true }];
  sheet.columns = [
    { header: 'شماره سند', key: 'doc_number', width: 24 },
    { header: 'نوع سند', key: 'doc_type_label', width: 20 },
    { header: 'تاریخ', key: 'doc_date', width: 18 },
    { header: 'انبار', key: 'warehouse_name', width: 16 },
    { header: 'ورود', key: 'qty_in', width: 12 },
    { header: 'خروج', key: 'qty_out', width: 12 },
    { header: 'موجودی', key: 'balance', width: 12 },
  ];
  sheet.getRow(1).font = { bold: true };
  result.lines.forEach((l) => sheet.addRow(l));

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=item-ledger-${result.item.code}.xlsx`);
  await wb.xlsx.write(res);
  res.end();
});

// ============ سود و زیان پروژه ============
function buildProjectPL(projectId) {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) return null;

  const costsByType = db
    .prepare(`SELECT cost_type, COALESCE(SUM(amount),0) AS total FROM project_costs WHERE project_id = ? GROUP BY cost_type`)
    .all(projectId);
  const totalCost = costsByType.reduce((s, c) => s + c.total, 0);

  return {
    project,
    budget: project.budget,
    costs_by_type: costsByType,
    total_cost: totalCost,
    remaining_budget: project.budget - totalCost,
    margin_percent: project.budget > 0 ? Math.round(((project.budget - totalCost) / project.budget) * 100) : null,
  };
}

router.get('/project-pl/:projectId', (req, res) => {
  const result = buildProjectPL(req.params.projectId);
  if (!result) return res.status(404).json({ error: 'پروژه یافت نشد' });
  res.json(result);
});

router.get('/project-pl/:projectId/export', async (req, res) => {
  const result = buildProjectPL(req.params.projectId);
  if (!result) return res.status(404).json({ error: 'پروژه یافت نشد' });

  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('سود و زیان پروژه');
  sheet.views = [{ rightToLeft: true }];
  sheet.addRow(['پروژه', result.project.name]);
  sheet.addRow(['بودجه', result.budget]);
  sheet.addRow([]);
  sheet.addRow(['نوع هزینه', 'مبلغ']).font = { bold: true };
  result.costs_by_type.forEach((c) => sheet.addRow([c.cost_type, c.total]));
  sheet.addRow([]);
  sheet.addRow(['جمع هزینه‌ها', result.total_cost]);
  sheet.addRow(['بودجه باقیمانده / سود تخمینی', result.remaining_budget]);
  sheet.columns.forEach((c) => (c.width = 28));

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=project-pl-${result.project.code}.xlsx`);
  await wb.xlsx.write(res);
  res.end();
});

// ============ خلاصه مالی (ترازنامه ساده) ============
function buildBalanceSummary() {
  const accounts = db.prepare('SELECT * FROM accounts ORDER BY code').all();
  const groups = { asset: [], liability: [], equity: [], revenue: [], expense: [] };

  for (const acc of accounts) {
    const sums = db
      .prepare('SELECT COALESCE(SUM(debit),0) d, COALESCE(SUM(credit),0) c FROM journal_entry_lines WHERE account_id = ?')
      .get(acc.id);
    const isDebitNature = acc.type === 'asset' || acc.type === 'expense';
    const balance = isDebitNature ? sums.d - sums.c : sums.c - sums.d;
    groups[acc.type].push({ code: acc.code, name: acc.name, balance });
  }

  const totals = {};
  for (const [type, list] of Object.entries(groups)) {
    totals[type] = list.reduce((s, a) => s + a.balance, 0);
  }

  return {
    groups,
    totals,
    total_assets: totals.asset,
    total_liabilities: totals.liability,
    total_equity_and_result: totals.equity + (totals.revenue - totals.expense),
  };
}

router.get('/balance-summary', (req, res) => {
  res.json(buildBalanceSummary());
});

router.get('/balance-summary/export', async (req, res) => {
  const result = buildBalanceSummary();
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('خلاصه مالی');
  sheet.views = [{ rightToLeft: true }];
  const LABELS = { asset: 'دارایی‌ها', liability: 'بدهی‌ها', equity: 'سرمایه', revenue: 'درآمدها', expense: 'هزینه‌ها' };

  for (const [type, list] of Object.entries(result.groups)) {
    if (list.length === 0) continue;
    sheet.addRow([LABELS[type]]).font = { bold: true };
    list.forEach((a) => sheet.addRow([a.code, a.name, a.balance]));
    sheet.addRow(['', 'جمع', result.totals[type]]);
    sheet.addRow([]);
  }
  sheet.columns = [{ width: 12 }, { width: 30 }, { width: 18 }];

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=balance-summary.xlsx');
  await wb.xlsx.write(res);
  res.end();
});

module.exports = router;
