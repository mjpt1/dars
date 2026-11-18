// سرویس مشترک حسابداری: ثبت خودکار سند حسابداری از رویدادهای دیگر ماژول‌ها
// (فاکتور فروش/خرید، دریافت/پرداخت وجه) طبق اصول حسابداری دوطرفه.
const db = require('../db');

function getAccountByCode(code) {
  return db.prepare('SELECT * FROM accounts WHERE code = ?').get(code);
}

const ACC = {
  CASH: '1000',
  RECEIVABLE: '1100',
  INVENTORY: '1200',
  PAYABLE: '2000',
  VAT_PAYABLE: '2100',
  SALES_REVENUE: '4000',
  COGS: '5000',
};

/**
 * ثبت یک سند حسابداری با چند ردیف بدهکار/بستانکار.
 * lines: [{ account_code, debit, credit, description }]
 * جمع بدهکار باید با جمع بستانکار برابر باشد وگرنه خطا برمی‌گرداند.
 */
function postEntry({ description, source = 'manual', source_id = null, created_by = null, lines }) {
  const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error('جمع بدهکار و بستانکار سند برابر نیست');
  }

  const entryNumber = `JE-${Date.now()}`;
  const insertEntry = db.prepare(
    `INSERT INTO journal_entries (entry_number, description, source, source_id, created_by) VALUES (?, ?, ?, ?, ?)`
  );
  const info = insertEntry.run(entryNumber, description || null, source, source_id, created_by);
  const entryId = info.lastInsertRowid;

  const insertLine = db.prepare(
    `INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit, description) VALUES (?, ?, ?, ?, ?)`
  );
  for (const l of lines) {
    const account = typeof l.account_id === 'number' ? { id: l.account_id } : getAccountByCode(l.account_code);
    if (!account) throw new Error(`حساب یافت نشد: ${l.account_code || l.account_id}`);
    insertLine.run(entryId, account.id, l.debit || 0, l.credit || 0, l.description || null);
  }

  return entryId;
}

/** سند خودکار برای صدور فاکتور فروش/خرید */
function postInvoiceEntry(invoice, userId) {
  const tx = db.transaction(() => {
    if (invoice.invoice_type === 'sale') {
      postEntry({
        description: `فاکتور فروش ${invoice.invoice_number}`,
        source: 'invoice',
        source_id: invoice.id,
        created_by: userId,
        lines: [
          { account_code: ACC.RECEIVABLE, debit: invoice.total_amount, credit: 0 },
          { account_code: ACC.SALES_REVENUE, debit: 0, credit: invoice.subtotal_amount },
          ...(invoice.tax_amount > 0
            ? [{ account_code: ACC.VAT_PAYABLE, debit: 0, credit: invoice.tax_amount }]
            : []),
        ],
      });
    } else {
      postEntry({
        description: `فاکتور خرید ${invoice.invoice_number}`,
        source: 'invoice',
        source_id: invoice.id,
        created_by: userId,
        lines: [
          { account_code: ACC.INVENTORY, debit: invoice.subtotal_amount, credit: 0 },
          ...(invoice.tax_amount > 0
            ? [{ account_code: ACC.VAT_PAYABLE, debit: invoice.tax_amount, credit: 0 }]
            : []),
          { account_code: ACC.PAYABLE, debit: 0, credit: invoice.total_amount },
        ],
      });
    }
  });
  tx();
}

/** سند خودکار برای دریافت/پرداخت وجه بابت فاکتور */
function postPaymentEntry(invoice, amount, userId) {
  const isSale = invoice.invoice_type === 'sale';
  postEntry({
    description: `${isSale ? 'دریافت' : 'پرداخت'} وجه بابت فاکتور ${invoice.invoice_number}`,
    source: 'payment',
    source_id: invoice.id,
    created_by: userId,
    lines: isSale
      ? [
          { account_code: ACC.CASH, debit: amount, credit: 0 },
          { account_code: ACC.RECEIVABLE, debit: 0, credit: amount },
        ]
      : [
          { account_code: ACC.PAYABLE, debit: amount, credit: 0 },
          { account_code: ACC.CASH, debit: 0, credit: amount },
        ],
  });
}

module.exports = { postEntry, postInvoiceEntry, postPaymentEntry, ACC };
