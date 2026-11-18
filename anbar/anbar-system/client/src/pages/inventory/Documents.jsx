import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import Modal from '../../components/Modal';
import BarcodeScanner from '../../components/BarcodeScanner';
import { money, dateFa, DOC_TYPE_LABELS } from '../../utils/format';
import { useAuth } from '../../auth/AuthContext';

const DOC_TYPES = Object.keys(DOC_TYPE_LABELS);

export default function Documents() {
  const { can } = useAuth();
  const [docs, setDocs] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  const [docType, setDocType] = useState('receipt_purchase');
  const [warehouseId, setWarehouseId] = useState('');
  const [destWarehouseId, setDestWarehouseId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([{ item_id: '', quantity: '', unit_price: '' }]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanOpen, setScanOpen] = useState(false);
  const [scanMsg, setScanMsg] = useState('');

  function load() {
    api.get('/inventory/documents').then((res) => setDocs(res.data));
  }

  useEffect(() => {
    load();
    api.get('/inventory/warehouses').then((res) => setWarehouses(res.data));
    api.get('/inventory/items').then((res) => setItems(res.data));
  }, []);

  function updateLine(idx, field, value) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, { item_id: '', quantity: '', unit_price: '' }]);
  }
  function removeLine(idx) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  // افزودن سریع ردیف با بارکد: هم برای بارکدخوان هندهلد (که مثل صفحه‌کلید تایپ می‌کند
  // و در پایان Enter می‌زند) و هم برای نتیجه اسکن دوربین استفاده می‌شود.
  function addByBarcode(code) {
    const item = items.find((it) => it.barcode === code || it.code === code);
    if (!item) {
      setScanMsg(`کالایی با بارکد «${code}» پیدا نشد`);
      return;
    }
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.item_id === String(item.id));
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], quantity: Number(copy[idx].quantity || 0) + 1 };
        return copy;
      }
      const empty = prev.findIndex((l) => !l.item_id);
      const newLine = { item_id: String(item.id), quantity: 1, unit_price: item.sale_price || item.purchase_price || 0 };
      if (empty >= 0) {
        const copy = [...prev];
        copy[empty] = newLine;
        return copy;
      }
      return [...prev, newLine];
    });
    setScanMsg(`«${item.name}» به سند اضافه شد`);
    setBarcodeInput('');
  }

  function handleBarcodeKeyDown(e) {
    if (e.key === 'Enter' && barcodeInput.trim()) {
      e.preventDefault();
      addByBarcode(barcodeInput.trim());
    }
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    const payload = {
      doc_type: docType,
      warehouse_id: Number(warehouseId),
      dest_warehouse_id: docType === 'issue_transfer' ? Number(destWarehouseId) : undefined,
      notes,
      lines: lines
        .filter((l) => l.item_id && l.quantity)
        .map((l) => ({ item_id: Number(l.item_id), quantity: Number(l.quantity), unit_price: Number(l.unit_price) || 0 })),
    };
    try {
      await api.post('/inventory/documents', payload);
      setOpen(false);
      setLines([{ item_id: '', quantity: '', unit_price: '' }]);
      setNotes('');
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'خطا در ثبت سند');
    }
  }

  return (
    <div>
      <div className="toolbar">
        <div className="text-muted" style={{ fontSize: 12.5 }}>
          ثبت رسید (ورود کالا) و حواله (خروج کالا) با به‌روزرسانی خودکار موجودی انبار
        </div>
        {can('inventory.manage') && (
          <button className="btn btn-primary" onClick={() => setOpen(true)}>
            + سند جدید
          </button>
        )}
      </div>

      <div className="card">
        {docs.length === 0 ? (
          <div className="empty-state">هنوز سندی ثبت نشده است</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>شماره سند</th>
                <th>نوع</th>
                <th>انبار</th>
                <th>مقصد</th>
                <th>ثبت‌کننده</th>
                <th>تاریخ</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id}>
                  <td className="mono">{d.doc_number}</td>
                  <td>
                    <span className="pill pill-primary">{DOC_TYPE_LABELS[d.doc_type] || d.doc_type}</span>
                  </td>
                  <td>{d.warehouse_name}</td>
                  <td>{d.dest_warehouse_name || '-'}</td>
                  <td>{d.created_by_name || '-'}</td>
                  <td>{dateFa(d.doc_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <Modal title="ثبت سند انبار" onClose={() => setOpen(false)} width={640}>
          <form onSubmit={save} id="doc-form">
            <div className="grid grid-2">
              <div className="field">
                <label>نوع سند *</label>
                <select className="input" value={docType} onChange={(e) => setDocType(e.target.value)}>
                  {DOC_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {DOC_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>{docType === 'issue_transfer' ? 'انبار مبدا *' : 'انبار *'}</label>
                <select className="input" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required>
                  <option value="">انتخاب کنید</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {docType === 'issue_transfer' && (
              <div className="field">
                <label>انبار مقصد *</label>
                <select className="input" value={destWarehouseId} onChange={(e) => setDestWarehouseId(e.target.value)} required>
                  <option value="">انتخاب کنید</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="field">
              <label>افزودن سریع با بارکد (بارکدخوان هندهلد یا دوربین)</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  className="input"
                  placeholder="بارکد را اسکن کنید یا تایپ کرده Enter بزنید..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={handleBarcodeKeyDown}
                />
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setScanOpen(true)}>
                  اسکن با دوربین
                </button>
              </div>
              {scanMsg && (
                <div className="text-muted" style={{ fontSize: 11.5, marginTop: 4 }}>
                  {scanMsg}
                </div>
              )}
            </div>

            <div className="field">
              <label>اقلام سند</label>
              {lines.map((l, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <select
                    className="input"
                    value={l.item_id}
                    onChange={(e) => updateLine(idx, 'item_id', e.target.value)}
                    style={{ flex: 2 }}
                  >
                    <option value="">انتخاب کالا</option>
                    {items.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input"
                    type="number"
                    placeholder="تعداد"
                    value={l.quantity}
                    onChange={(e) => updateLine(idx, 'quantity', e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <input
                    className="input"
                    type="number"
                    placeholder="قیمت واحد"
                    value={l.unit_price}
                    onChange={(e) => updateLine(idx, 'unit_price', e.target.value)}
                    style={{ flex: 1 }}
                  />
                  {lines.length > 1 && (
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => removeLine(idx)}>
                      حذف
                    </button>
                  )}
                </div>
              ))}
              <button type="button" className="btn btn-outline btn-sm" onClick={addLine}>
                + افزودن ردیف
              </button>
            </div>

            <div className="field">
              <label>توضیحات</label>
              <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            {error && <div className="pill pill-danger" style={{ display: 'block', padding: '8px 12px' }}>{error}</div>}
          </form>
          <div className="modal-footer" style={{ marginTop: 12 }}>
            <button className="btn btn-outline" type="button" onClick={() => setOpen(false)}>
              انصراف
            </button>
            <button className="btn btn-primary" type="submit" form="doc-form">
              ثبت سند
            </button>
          </div>
        </Modal>
      )}

      {scanOpen && (
        <BarcodeScanner
          onDetected={(code) => {
            setScanOpen(false);
            addByBarcode(code);
          }}
          onClose={() => setScanOpen(false)}
        />
      )}
    </div>
  );
}
