import { useEffect, useState } from 'react';
import api from '../../../api/api';
import { uploadImage } from '../../../api/cloudinary';
import './Inventory.css';

export default function Inventory() {
  const [parts, setParts] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [stockModal, setStockModal] = useState(null);
  const [form, setForm] = useState({ name: '', sku: '', description: '', unit_price: '', quantity: '', min_stock_level: '5', image_url: '' });
  const [stockForm, setStockForm] = useState({ quantity: '', reason: '' });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  function load() {
    api.get('/inventory').then((r) => setParts(r.data.data));
  }

  useEffect(load, []);

  async function handleImageChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const url = await uploadImage(file);
      setForm((f) => ({ ...f, image_url: url }));
    } catch (err) {
      setError(err.message || 'Image upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/inventory', form);
      setShowAdd(false);
      setForm({ name: '', sku: '', description: '', unit_price: '', quantity: '', min_stock_level: '5', image_url: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not add part.');
    }
  }

  async function handleStockAction(e) {
    e.preventDefault();
    setError('');
    try {
      if (stockModal.mode === 'in') {
        await api.post(`/inventory/${stockModal.part.id}/stock-in`, { quantity: Number(stockForm.quantity), reason: stockForm.reason });
      } else {
        await api.post(`/inventory/${stockModal.part.id}/adjust`, { quantity: Number(stockForm.quantity), reason: stockForm.reason });
      }
      setStockModal(null);
      setStockForm({ quantity: '', reason: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Stock update failed.');
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Inventory</h1>
          <p>Manage spare parts stock levels.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Part</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Image</th><th>Part</th><th>SKU</th><th>Price</th><th>Stock</th><th>Min level</th><th></th></tr>
          </thead>
          <tbody>
            {parts.map((p) => (
              <tr key={p.id}>
                <td>
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6 }} />
                  ) : (
                    <div style={{ width: 44, height: 44, borderRadius: 6, background: '#f1f1f1' }} />
                  )}
                </td>
                <td>{p.name}</td>
                <td>{p.sku}</td>
                <td>MK {Number(p.unit_price).toLocaleString()}</td>
                <td>
                  {p.quantity}
                  {p.low_stock && <span className="badge badge-warning" style={{ marginLeft: 8 }}>Low</span>}
                </td>
                <td>{p.min_stock_level}</td>
                <td className="action-cell">
                  <button className="btn btn-outline btn-sm" onClick={() => setStockModal({ part: p, mode: 'in' })}>StockIn</button>
                  <button className="btn btn-outline btn-sm" onClick={() => setStockModal({ part: p, mode: 'adjust' })}>Adjust</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div className="modal-backdrop" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add new part</h2>
            <form onSubmit={handleAdd}>
              <div className="form-row">
                <div className="form-group"><label>Name</label><input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required /></div>
                <div className="form-group"><label>SKU</label><input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} required /></div>
              </div>
              <div className="form-group"><label>Description</label><textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
              <div className="form-row">
                <div className="form-group"><label>Unit price (MK)</label><input type="number" value={form.unit_price} onChange={(e) => setForm((f) => ({ ...f, unit_price: e.target.value }))} required /></div>
                <div className="form-group"><label>Initial quantity</label><input type="number" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} /></div>
              </div>
              <div className="form-group"><label>Minimum stock level (for low-stock alerts)</label><input type="number" value={form.min_stock_level} onChange={(e) => setForm((f) => ({ ...f, min_stock_level: e.target.value }))} /></div>
              <div className="form-group">
                <label>Photo</label>
                <input type="file" accept="image/*" onChange={handleImageChange} />
                {uploading && <p style={{ fontSize: '0.85rem', marginTop: 4 }}>Uploading…</p>}
                {form.image_url && !uploading && (
                  <img src={form.image_url} alt="Preview" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6, marginTop: 8 }} />
                )}
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowAdd(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={uploading}>Add Part</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {stockModal && (
        <div className="modal-backdrop" onClick={() => setStockModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{stockModal.mode === 'in' ? 'Receive stock' : 'Adjust stock'} — {stockModal.part.name}</h2>
            <form onSubmit={handleStockAction}>
              <div className="form-group">
                <label>{stockModal.mode === 'in' ? 'Quantity received' : 'Quantity change (use negative to reduce)'}</label>
                <input type="number" value={stockForm.quantity} onChange={(e) => setStockForm((f) => ({ ...f, quantity: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label>Reason</label>
                <input value={stockForm.reason} onChange={(e) => setStockForm((f) => ({ ...f, reason: e.target.value }))} placeholder="e.g. Supplier delivery, stock count correction" required={stockModal.mode === 'adjust'} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setStockModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
