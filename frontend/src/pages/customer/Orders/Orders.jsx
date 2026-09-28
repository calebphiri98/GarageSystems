import { useEffect, useMemo, useState } from 'react';
import api from '../../../api/api';
import './Orders.css';

const STATUS_BADGE = {
  Pending: 'badge-warning',
  Confirmed: 'badge-info',
  Rejected: 'badge-danger',
  Cancelled: 'badge-neutral',
  'Ready for Collection': 'badge-success',
  Completed: 'badge-neutral',
};

const money = (n) => `MK ${Number(n).toLocaleString()}`;

export default function Orders() {
  const [parts, setParts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [cart, setCart] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [search, setSearch] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  const [selectedId, setSelectedId] = useState('');
  const [qtyInput, setQtyInput] = useState('1');

  function loadParts() {
    const params = {};
    if (search.trim()) params.search = search.trim();
    if (minPrice !== '') params.min_price = minPrice;
    if (maxPrice !== '') params.max_price = maxPrice;
    api
      .get('/inventory', { params })
      .then((r) => setParts(Array.isArray(r.data?.data) ? r.data.data : []))
      .catch((err) => setError(err.response?.data?.message || 'Could not load parts: ' + err.message));
  }

  function loadOrders() {
    api
      .get('/orders')
      .then((r) => setOrders(Array.isArray(r.data?.data) ? r.data.data : []))
      .catch((err) => setError(err.response?.data?.message || 'Could not load orders: ' + err.message));
  }

  function showTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    const t = setTimeout(loadParts, 250);
    return () => clearTimeout(t);
  }, [search, minPrice, maxPrice]);

  const selectedPart = useMemo(
    () => parts.find((p) => String(p.id) === String(selectedId)) || null,
    [parts, selectedId]
  );

  const priceRange = useMemo(() => {
    const prices = parts.filter((p) => p.quantity > 0).map((p) => Number(p.unit_price));
    if (prices.length === 0) return null;
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }, [parts]);

  const cartTotal = cart.reduce((sum, i) => sum + Number(i.unit_price) * i.quantity, 0);

  function clearFilters() {
    setSearch('');
    setMinPrice('');
    setMaxPrice('');
  }

  function addToOrder() {
    setError('');
    setMessage('');
    if (!selectedPart) {
      setError('Select a part first.');
      return;
    }
    const qty = Math.floor(Number(qtyInput));
    if (!qty || qty <= 0) {
      setError('Enter a quantity of at least 1.');
      return;
    }
    const existing = cart.find((i) => i.part_id === selectedPart.id);
    const total = (existing ? existing.quantity : 0) + qty;
    if (total > selectedPart.quantity) {
      setError(`Only ${selectedPart.quantity} of ${selectedPart.name} available.`);
      return;
    }
    setCart((c) =>
      existing
        ? c.map((i) => (i.part_id === selectedPart.id ? { ...i, quantity: total } : i))
        : [
            ...c,
            {
              part_id: selectedPart.id,
              name: selectedPart.name,
              unit_price: selectedPart.unit_price,
              quantity: qty,
            },
          ]
    );
    setSelectedId('');
    setQtyInput('1');
  }

  function removeFromOrder(partId) {
    setCart((c) => c.filter((i) => i.part_id !== partId));
  }

  function reviewOrder() {
    setError('');
    setMessage('');
    if (cart.length === 0) {
      setError('Add at least one part to your order.');
      showTop();
      return;
    }
    setShowConfirm(true);
  }

  async function submitOrder() {
    setSubmitting(true);
    setError('');
    setMessage('');
    const items = cart.map((i) => ({ part_id: Number(i.part_id), quantity: Number(i.quantity) }));
    try {
      await api.post('/orders', { items });
      setMessage('Order submitted and pending review.');
      setCart([]);
      loadParts();
      loadOrders();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not place order.');
    } finally {
      setSubmitting(false);
      setShowConfirm(false);
      showTop();
    }
  }

  async function cancelOrder(id) {
    if (!window.confirm('Cancel this order? This cannot be undone.')) return;
    setError('');
    setMessage('');
    setCancellingId(id);
    try {
      await api.put(`/orders/${id}/cancel`, {});
      setMessage('Order cancelled.');
      loadOrders();
      loadParts();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not cancel order.');
    } finally {
      setCancellingId(null);
      showTop();
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Order Parts</h1>
          <p>Choose a part, check its price and availability, then review your order before submitting.</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <div className="filter-bar">
        <input
          className="filter-search"
          type="text"
          placeholder="Search parts by name, SKU or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <input
          type="number"
          min={0}
          placeholder="Min price"
          value={minPrice}
          onChange={(e) => setMinPrice(e.target.value)}
        />
        <input
          type="number"
          min={0}
          placeholder="Max price"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
        />
        {(search || minPrice !== '' || maxPrice !== '') && (
          <button type="button" className="btn btn-outline btn-sm" onClick={clearFilters}>Clear</button>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2 className="section-title">Select a part</h2>

        <div style={{ display: 'grid', gap: 14, maxWidth: 520 }}>
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Part</label>
            <select
              value={selectedId}
              onChange={(e) => {
                setSelectedId(e.target.value);
                setQtyInput('1');
              }}
              style={{ width: '100%' }}
            >
              <option value="">Select a part...</option>
              {parts.map((p) => (
                <option key={p.id} value={p.id} disabled={p.quantity === 0}>
                  {p.name}
                  {p.quantity === 0 ? ' (out of stock)' : ''}
                </option>
              ))}
            </select>
            {parts.length === 0 && (
              <div className="empty-state" style={{ marginTop: 8 }}>No parts match your filters.</div>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Price</label>
            {selectedPart ? (
              <div style={{ fontSize: 20, fontWeight: 700 }}>{money(selectedPart.unit_price)}</div>
            ) : priceRange ? (
              <div style={{ fontSize: 16 }}>
                {priceRange.min === priceRange.max
                  ? money(priceRange.min)
                  : `${money(priceRange.min)} to ${money(priceRange.max)}`}
                <div style={{ fontSize: 13, opacity: 0.7, marginTop: 2 }}>
                  Select a part to see its exact price.
                </div>
              </div>
            ) : (
              <div style={{ opacity: 0.7 }}>No priced parts available.</div>
            )}
          </div>

          {selectedPart && (
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              {selectedPart.image_url ? (
                <img
                  src={selectedPart.image_url}
                  alt={selectedPart.name}
                  style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8 }}
                />
              ) : (
                <div style={{ width: 72, height: 72, borderRadius: 8, background: '#f1f1f1' }} />
              )}
              <div>
                <div style={{ fontWeight: 600 }}>{selectedPart.name}</div>
                {selectedPart.sku && <div style={{ fontSize: 13, opacity: 0.7 }}>SKU: {selectedPart.sku}</div>}
                <div style={{ fontSize: 13, opacity: 0.7 }}>{selectedPart.quantity} available</div>
              </div>
            </div>
          )}

          {selectedPart && (
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Quantity</label>
              <input
                type="number"
                min={1}
                max={selectedPart.quantity}
                className="qty-input"
                value={qtyInput}
                onChange={(e) => setQtyInput(e.target.value)}
              />
              <div style={{ marginTop: 6, fontSize: 14 }}>
                Line total: <strong>{money(Number(selectedPart.unit_price) * (Number(qtyInput) || 0))}</strong>
              </div>
            </div>
          )}

          <div>
            <button type="button" className="btn btn-outline" disabled={!selectedPart} onClick={addToOrder}>
              Add to order
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h2 className="section-title">Your order</h2>
        {cart.length === 0 ? (
          <div className="empty-state">No parts added yet.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Part</th><th>Unit price</th><th>Qty</th><th>Total</th><th></th></tr>
              </thead>
              <tbody>
                {cart.map((i) => (
                  <tr key={i.part_id}>
                    <td>{i.name}</td>
                    <td>{money(i.unit_price)}</td>
                    <td>{i.quantity}</td>
                    <td>{money(Number(i.unit_price) * i.quantity)}</td>
                    <td>
                      <button className="btn btn-danger btn-sm" onClick={() => removeFromOrder(i.part_id)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={3} style={{ textAlign: 'right', fontWeight: 600 }}>Order total</td>
                  <td colSpan={2} style={{ fontWeight: 700 }}>{money(cartTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <button
          className="btn btn-primary"
          style={{ marginTop: 16 }}
          disabled={cart.length === 0}
          onClick={reviewOrder}
        >
          Review and submit order
        </button>
      </div>

      <div className="card" style={{ marginTop: 28 }}>
        <h2 className="section-title">My orders</h2>
        {orders.length === 0 ? (
          <div className="empty-state">You haven't placed any orders yet.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Order #</th><th>Items</th><th>Status</th><th>Placed</th><th></th></tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>#{o.id}</td>
                    <td>{o.items?.map((i) => `${i.part_name} x${i.quantity}`).join(', ')}</td>
                    <td><span className={`badge ${STATUS_BADGE[o.status] || 'badge-neutral'}`}>{o.status}</span></td>
                    <td>{new Date(o.created_at).toLocaleDateString()}</td>
                    <td>
                      {o.status === 'Pending' && (
                        <button
                          className="btn btn-danger btn-sm"
                          disabled={cancellingId === o.id}
                          onClick={() => cancelOrder(o.id)}
                        >
                          {cancellingId === o.id ? 'Cancelling...' : 'Cancel'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: '#fff',
              color: '#222',
              borderRadius: 10,
              padding: 24,
              width: '92%',
              maxWidth: 520,
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
          >
            <h2 style={{ marginTop: 0 }}>Confirm your order</h2>
            <p style={{ marginTop: 0 }}>Please check that these are the parts and quantities you want.</p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Part</th><th>Qty</th><th>Unit price</th><th>Total</th></tr>
                </thead>
                <tbody>
                  {cart.map((i) => (
                    <tr key={i.part_id}>
                      <td>{i.name}</td>
                      <td>{i.quantity}</td>
                      <td>{money(i.unit_price)}</td>
                      <td>{money(Number(i.unit_price) * i.quantity)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'right', fontWeight: 600 }}>Order total</td>
                    <td style={{ fontWeight: 700 }}>{money(cartTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
              <button className="btn btn-outline" disabled={submitting} onClick={() => setShowConfirm(false)}>
                Go back
              </button>
              <button className="btn btn-primary" disabled={submitting} onClick={submitOrder}>
                {submitting ? 'Placing order...' : 'Yes, place order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}