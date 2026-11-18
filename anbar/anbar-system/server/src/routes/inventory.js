const express = require('express');
const db = require('../db');
const { authenticate, requirePermission } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ---------- انبارها ----------
router.get('/warehouses', requirePermission('inventory.view'), (req, res) => {
  res.json(db.prepare('SELECT * FROM warehouses ORDER BY name').all());
});
router.post('/warehouses', requirePermission('inventory.manage'), (req, res) => {
  const { name, location } = req.body;
  if (!name) return res.status(400).json({ error: 'نام انبار الزامی است' });
  const info = db.prepare('INSERT INTO warehouses (name, location) VALUES (?, ?)').run(name, location || null);
  res.status(201).json({ id: info.lastInsertRowid });
});

// ---------- دسته‌بندی و واحد ----------
router.get('/categories', requirePermission('inventory.view'), (req, res) => {
  res.json(db.prepare('SELECT * FROM item_categories ORDER BY name').all());
});
router.post('/categories', requirePermission('inventory.manage'), (req, res) => {
  const { name, parent_id } = req.body;
  const info = db.prepare('INSERT INTO item_categories (name, parent_id) VALUES (?, ?)').run(name, parent_id || null);
  res.status(201).json({ id: info.lastInsertRowid });
});

router.get('/units', requirePermission('inventory.view'), (req, res) => {
  res.json(db.prepare('SELECT * FROM units ORDER BY name').all());
});
router.post('/units', requirePermission('inventory.manage'), (req, res) => {
  const { name } = req.body;
  const info = db.prepare('INSERT OR IGNORE INTO units (name) VALUES (?)').run(name);
  res.status(201).json({ id: info.lastInsertRowid });
});

// ---------- کالاها ----------
router.get('/items', requirePermission('inventory.view'), (req, res) => {
  const { search } = req.query;
  let rows;
  if (search) {
    rows = db
      .prepare(
        `SELECT i.*, u.name AS unit_name, c.name AS category_name,
                COALESCE((SELECT SUM(b.quantity) FROM stock_balances b WHERE b.item_id = i.id), 0) AS total_stock
         FROM items i
         LEFT JOIN units u ON u.id = i.unit_id
         LEFT JOIN item_categories c ON c.id = i.category_id
         WHERE i.name LIKE ? OR i.code LIKE ? OR i.barcode LIKE ?
         ORDER BY i.name`
      )
      .all(`%${search}%`, `%${search}%`, `%${search}%`);
  } else {
    rows = db
      .prepare(
        `SELECT i.*, u.name AS unit_name, c.name AS category_name,
                COALESCE((SELECT SUM(b.quantity) FROM stock_balances b WHERE b.item_id = i.id), 0) AS total_stock
         FROM items i
         LEFT JOIN units u ON u.id = i.unit_id
         LEFT JOIN item_categories c ON c.id = i.category_id
         ORDER BY i.name`
      )
      .all();
  }
  res.json(rows);
});

router.post('/items', requirePermission('inventory.manage'), (req, res) => {
  const { code, barcode, name, category_id, unit_id, min_stock, max_stock, purchase_price, sale_price, notes } =
    req.body;
  if (!code || !name || !unit_id) return res.status(400).json({ error: 'کد، نام و واحد کالا الزامی است' });
  try {
    const info = db
      .prepare(
        `INSERT INTO items (code, barcode, name, category_id, unit_id, min_stock, max_stock, purchase_price, sale_price, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        code,
        barcode || null,
        name,
        category_id || null,
        unit_id,
        min_stock || 0,
        max_stock || null,
        purchase_price || 0,
        sale_price || 0,
        notes || null
      );
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: 'کد یا بارکد تکراری است' });
  }
});

router.put('/items/:id', requirePermission('inventory.manage'), (req, res) => {
  const { name, category_id, unit_id, min_stock, max_stock, purchase_price, sale_price, is_active, notes } =
    req.body;
  db.prepare(
    `UPDATE items SET name=?, category_id=?, unit_id=?, min_stock=?, max_stock=?, purchase_price=?, sale_price=?, is_active=?, notes=?
     WHERE id=?`
  ).run(
    name,
    category_id || null,
    unit_id,
    min_stock || 0,
    max_stock || null,
    purchase_price || 0,
    sale_price || 0,
    is_active === undefined ? 1 : is_active,
    notes || null,
    req.params.id
  );
  res.json({ ok: true });
});

// موجودی فعلی یک کالا به تفکیک انبار
router.get('/items/:id/stock', requirePermission('inventory.view'), (req, res) => {
  res.json(
    db
      .prepare(
        `SELECT b.warehouse_id, w.name AS warehouse_name, b.quantity
         FROM stock_balances b JOIN warehouses w ON w.id = b.warehouse_id
         WHERE b.item_id = ?`
      )
      .all(req.params.id)
  );
});

// ---------- اسناد انبار (رسید/حواله) ----------
function applyStockMovement(db, doc, lines) {
  const IN_TYPES = ['receipt_purchase', 'receipt_return', 'receipt_transfer'];
  const OUT_TYPES = ['issue_sale', 'issue_project', 'issue_return', 'issue_transfer'];

  const upsertBalance = db.prepare(`
    INSERT INTO stock_balances (item_id, warehouse_id, quantity, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(item_id, warehouse_id) DO UPDATE SET
      quantity = quantity + excluded.quantity, updated_at = datetime('now')
  `);

  for (const line of lines) {
    if (doc.doc_type === 'adjustment') {
      // adjustment: quantity می‌تواند مثبت یا منفی باشد (اصلاح مستقیم)
      upsertBalance.run(line.item_id, doc.warehouse_id, line.quantity);
      continue;
    }
    if (IN_TYPES.includes(doc.doc_type)) {
      upsertBalance.run(line.item_id, doc.warehouse_id, line.quantity);
    } else if (OUT_TYPES.includes(doc.doc_type)) {
      upsertBalance.run(line.item_id, doc.warehouse_id, -line.quantity);
    }
    // اسناد انتقال: هم از انبار مبدا کم و هم به انبار مقصد اضافه می‌شود
    if (doc.doc_type === 'issue_transfer' && doc.dest_warehouse_id) {
      upsertBalance.run(line.item_id, doc.dest_warehouse_id, line.quantity);
    }
  }
}

router.get('/documents', requirePermission('inventory.view'), (req, res) => {
  const rows = db
    .prepare(
      `SELECT sd.*, w.name AS warehouse_name, dw.name AS dest_warehouse_name, u.full_name AS created_by_name
       FROM stock_documents sd
       JOIN warehouses w ON w.id = sd.warehouse_id
       LEFT JOIN warehouses dw ON dw.id = sd.dest_warehouse_id
       LEFT JOIN users u ON u.id = sd.created_by
       ORDER BY sd.id DESC LIMIT 200`
    )
    .all();
  res.json(rows);
});

router.get('/documents/:id', requirePermission('inventory.view'), (req, res) => {
  const doc = db.prepare('SELECT * FROM stock_documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'سند یافت نشد' });
  const lines = db
    .prepare(
      `SELECT sdi.*, i.name AS item_name, i.code AS item_code, u.name AS unit_name
       FROM stock_document_items sdi
       JOIN items i ON i.id = sdi.item_id
       JOIN units u ON u.id = i.unit_id
       WHERE sdi.document_id = ?`
    )
    .all(req.params.id);
  res.json({ ...doc, lines });
});

router.post('/documents', requirePermission('inventory.manage'), (req, res) => {
  const { doc_type, warehouse_id, dest_warehouse_id, project_id, supplier_id, customer_id, notes, lines } = req.body;
  if (!doc_type || !warehouse_id || !Array.isArray(lines) || lines.length === 0) {
    return res.status(400).json({ error: 'نوع سند، انبار و حداقل یک ردیف کالا الزامی است' });
  }

  const docNumber = `${doc_type.toUpperCase()}-${Date.now()}`;

  const tx = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO stock_documents (doc_number, doc_type, warehouse_id, dest_warehouse_id, project_id, supplier_id, customer_id, created_by, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        docNumber,
        doc_type,
        warehouse_id,
        dest_warehouse_id || null,
        project_id || null,
        supplier_id || null,
        customer_id || null,
        req.user.id,
        notes || null
      );
    const docId = info.lastInsertRowid;

    const insertLine = db.prepare(
      `INSERT INTO stock_document_items (document_id, item_id, batch_id, quantity, unit_price, notes)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const l of lines) {
      insertLine.run(docId, l.item_id, l.batch_id || null, l.quantity, l.unit_price || 0, l.notes || null);
    }

    applyStockMovement(db, { doc_type, warehouse_id, dest_warehouse_id }, lines);

    return docId;
  });

  try {
    const docId = tx();
    res.status(201).json({ id: docId, doc_number: docNumber });
  } catch (e) {
    res.status(400).json({ error: 'ثبت سند با خطا مواجه شد: ' + e.message });
  }
});

module.exports = router;
