import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import Modal from '../../components/Modal';
import { money, dateFa } from '../../utils/format';
import { useAuth } from '../../auth/AuthContext';

const STATUS_LABELS = { unpaid: 'پرداخت‌نشده', partial: 'پرداخت جزئی', paid: 'تسویه‌شده', cancelled: 'لغوشده' };
const STATUS_CLASS = { unpaid: 'pill-danger', partial: 'pill-warning', paid: 'pill-success', cancelled: 'pill-muted' };

export default function Invoices() {
  const { can } = useAuth();
  const [list, setList] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ invoice_type: 'sale', total_amount: '', customer_id: '', supplier_id: '', tax_rate: 9, due_date: '' });
  const [payFor, setPayFor] = useState(null);
  const [payAmount, setPayAmount] = useState('');

  function load() {
    api.get('/finance/invoices').then((res) => setList(res.data));
  }
  useEffect(() => {
    load();
    api.get('/finance/suppliers').then((res) => setSuppliers(res.data));
    api.get('/finance/customers').then((res) => setCustomers(res.data));
  }, []);

  async function save(e) {
    e.preventDefault();
    await api.post('/finance/invoices', { ...form, total_amount: Number(form.total_amount), tax_rate: Number(form.tax_rate) || 0 });
    setOpen(false);
    setForm({ invoice_type: 'sale', total_amount: '', customer_id: '', supplier_id: '', tax_rate: 9, due_date: '' });
    load();
  }

  async function pay(e) {
    e.preventDefault();
    await api.post(`/finance/invoices/${payFor.id}/payments`, { amount: Number(payAmount) });
    setPayFor(null);
    setPayAmount('');
    load();
  }

  return (
    <div>
      <div className="toolbar">
        <div className="text-muted" style={{ fontSize: 12.5 }}>
          فاکتورهای خرید و فروش و پیگیری وضعیت تسویه
        </div>
        {can('finance.manage') && (
          <button className="btn btn-primary" onClick={() => setOpen(true)}>
            + فاکتور جدید
          </button>
        )}
      </div>

      <div className="card">
        {list.length === 0 ? (
          <div className="empty-state">فاکتوری ثبت نشده است</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>شماره فاکتور</th>
                <th>نوع</th>
                <th>طرف حساب</th>
                <th>مبلغ کل</th>
                <th>پرداخت‌شده</th>
                <th>وضعیت</th>
                <th>تاریخ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((inv) => (
                <tr key={inv.id}>
                  <td className="mono">{inv.invoice_number}</td>
                  <td>{inv.invoice_type === 'sale' ? 'فروش' : 'خرید'}</td>
                  <td>{inv.customer_name || inv.supplier_name || '-'}</td>
                  <td className="mono">{money(inv.total_amount)}</td>
                  <td className="mono">{money(inv.paid_amount)}</td>
                  <td>
                    <span className={'pill ' + STATUS_CLASS[inv.status]}>{STATUS_LABELS[inv.status]}</span>
                  </td>
                  <td>{dateFa(inv.issue_date)}</td>
                  <td>
                    {inv.status !== 'paid' && can('finance.manage') && (
                      <button className="btn btn-outline btn-sm" onClick={() => setPayFor(inv)}>
                        ثبت پرداخت
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <Modal
          title="فاکتور جدید"
          onClose={() => setOpen(false)}
          footer={
            <>
              <button className="btn btn-outline" onClick={() => setOpen(false)}>انصراف</button>
              <button className="btn btn-primary" form="inv-form" type="submit">ثبت</button>
            </>
          }
        >
          <form id="inv-form" onSubmit={save}>
            <div className="field">
              <label>نوع فاکتور</label>
              <select className="input" value={form.invoice_type} onChange={(e) => setForm({ ...form, invoice_type: e.target.value })}>
                <option value="sale">فروش</option>
                <option value="purchase">خرید</option>
              </select>
            </div>
            {form.invoice_type === 'sale' ? (
              <div className="field">
                <label>مشتری</label>
                <select className="input" value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
                  <option value="">— انتخاب کنید —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="field">
                <label>تامین‌کننده</label>
                <select className="input" value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
                  <option value="">— انتخاب کنید —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid grid-2">
              <div className="field">
                <label>مبلغ (قبل از مالیات، تومان) *</label>
                <input className="input" type="number" value={form.total_amount} onChange={(e) => setForm({ ...form, total_amount: e.target.value })} required />
              </div>
              <div className="field">
                <label>درصد مالیات بر ارزش افزوده</label>
                <input className="input" type="number" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label>سررسید پرداخت</label>
              <input className="input" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
          </form>
        </Modal>
      )}

      {payFor && (
        <Modal
          title={`ثبت پرداخت برای ${payFor.invoice_number}`}
          onClose={() => setPayFor(null)}
          footer={
            <>
              <button className="btn btn-outline" onClick={() => setPayFor(null)}>انصراف</button>
              <button className="btn btn-primary" form="pay-form" type="submit">ثبت پرداخت</button>
            </>
          }
        >
          <form id="pay-form" onSubmit={pay}>
            <p className="text-muted" style={{ fontSize: 12.5 }}>
              مانده قابل پرداخت: {money(payFor.total_amount - payFor.paid_amount)} تومان
            </p>
            <div className="field">
              <label>مبلغ پرداخت *</label>
              <input className="input" type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} required />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
