import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import Modal from '../../components/Modal';
import BarcodeScanner from '../../components/BarcodeScanner';
import { money } from '../../utils/format';
import { useAuth } from '../../auth/AuthContext';

const emptyForm = {
  code: '',
  barcode: '',
  name: '',
  category_id: '',
  unit_id: '',
  min_stock: 0,
  purchase_price: 0,
  sale_price: 0,
  notes: '',
};

export default function Items() {
  const { can } = useAuth();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [scanOpen, setScanOpen] = useState(false);

  async function load() {
    const [i, c, u] = await Promise.all([
      api.get('/inventory/items', { params: search ? { search } : {} }),
      api.get('/inventory/categories'),
      api.get('/inventory/units'),
    ]);
    setItems(i.data);
    setCategories(c.data);
    setUnits(u.data);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function save(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/inventory/items', form);
      setOpen(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'خطا در ثبت کالا');
    }
  }

  return (
    <div>
      <div className="toolbar">
        <input
          className="input"
          style={{ maxWidth: 320 }}
          placeholder="جستجوی نام، کد یا بارکد کالا..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {can('inventory.manage') && (
          <button className="btn btn-primary" onClick={() => setOpen(true)}>
            + کالای جدید
          </button>
        )}
      </div>

      <div className="card">
        {items.length === 0 ? (
          <div className="empty-state">کالایی ثبت نشده است</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>کد</th>
                <th>نام کالا</th>
                <th>دسته‌بندی</th>
                <th>واحد</th>
                <th>موجودی کل</th>
                <th>حداقل موجودی</th>
                <th>قیمت فروش</th>
                <th>وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td className="mono">{it.code}</td>
                  <td>{it.name}</td>
                  <td>{it.category_name || '-'}</td>
                  <td>{it.unit_name}</td>
                  <td className="mono">{money(it.total_stock)}</td>
                  <td className="mono">{money(it.min_stock)}</td>
                  <td className="mono">{money(it.sale_price)}</td>
                  <td>
                    {it.total_stock <= it.min_stock ? (
                      <span className="pill pill-warning">کمبود موجودی</span>
                    ) : (
                      <span className="pill pill-success">مطلوب</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <Modal title="ثبت کالای جدید" onClose={() => setOpen(false)} width={520}>
          <form onSubmit={save} id="item-form">
            <div className="grid grid-2">
              <div className="field">
                <label>کد کالا *</label>
                <input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
              </div>
              <div className="field">
                <label>بارکد</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="input" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setScanOpen(true)} title="اسکن با دوربین">
                    ⌗ اسکن
                  </button>
                </div>
              </div>
            </div>
            <div className="field">
              <label>نام کالا *</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="grid grid-2">
              <div className="field">
                <label>دسته‌بندی</label>
                <select className="input" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                  <option value="">— بدون دسته —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>واحد اندازه‌گیری *</label>
                <select className="input" value={form.unit_id} onChange={(e) => setForm({ ...form, unit_id: e.target.value })} required>
                  <option value="">انتخاب کنید</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-3">
              <div className="field">
                <label>حداقل موجودی</label>
                <input
                  className="input"
                  type="number"
                  value={form.min_stock}
                  onChange={(e) => setForm({ ...form, min_stock: e.target.value })}
                />
              </div>
              <div className="field">
                <label>قیمت خرید</label>
                <input
                  className="input"
                  type="number"
                  value={form.purchase_price}
                  onChange={(e) => setForm({ ...form, purchase_price: e.target.value })}
                />
              </div>
              <div className="field">
                <label>قیمت فروش</label>
                <input
                  className="input"
                  type="number"
                  value={form.sale_price}
                  onChange={(e) => setForm({ ...form, sale_price: e.target.value })}
                />
              </div>
            </div>
            {error && <div className="pill pill-danger" style={{ display: 'block', padding: '8px 12px' }}>{error}</div>}
          </form>
          <div className="modal-footer" style={{ marginTop: 12 }}>
            <button className="btn btn-outline" type="button" onClick={() => setOpen(false)}>
              انصراف
            </button>
            <button className="btn btn-primary" type="submit" form="item-form">
              ثبت کالا
            </button>
          </div>
        </Modal>
      )}

      {scanOpen && (
        <BarcodeScanner
          onDetected={(code) => {
            setForm((f) => ({ ...f, barcode: code }));
            setScanOpen(false);
          }}
          onClose={() => setScanOpen(false)}
        />
      )}
    </div>
  );
}
