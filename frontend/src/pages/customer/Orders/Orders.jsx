import { useEffect, useState } from 'react';
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

export default function Orders() {
  const [parts, setParts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [cart, setCart] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Search & price-range filter for the parts catalog.
  const [search, setSearch] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  function loadParts() {
    const params = {};
    if (search.trim()) params.search = search.trim();
    if (minPrice !== '') params.min_price = minPrice;
    if (maxPrice !== '') params.max_price = maxPrice;
    api.get('/inventory', { params }).then((r) => setParts(r.data.data));
  }

  function loadOrders() {
    api.get('/orders').then((r) => setOrders(r.data.data));
  }

  useEffect(loadOrders, []);
  useEffect(() => {
    const t = setTimeout(loadParts, 250); // debounce while typing
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, minPrice, maxPrice]);

  function clearFilters() {
    setSearch('');
    setMinPrice('');
    setMaxPrice('');
  }

  // A customer can never key in more than what's currently in stock.
  function setQty(part, rawQty) {
    let qty = Number(rawQty);
    if (Number.isNaN(qty)) qty = '';
    if (qty !== '' && qty > part.quantity) qty = part.quantity;
    if (qty !== '' && qty < 0) qty = 0;
    setCart((c) => ({ ...c, [part.id]: qty }));
  }

  async function submitOrder() {
    setError('');
    setMessage('');
    const items = Object.entries(cart)
      .filter(([, qty]) => Number(qty) > 0)
      .map(([part_id, quantity]) => ({ part_id: Number(part_id), quantity: Number(quantity) }));

    if (items.length === 0) {
      setError('Add a quantity for at least one part.');
      return;
    }
    try {
      await api.post('/orders', { items });
      setMessage('Order submitted and pending review.');
      setCart({});
      loadParts();
      loadOrders();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not place order.');
    }
  }

  async function cancelOrder(id) {
    if (!window.confirm('Cancel this order? This cannot be undone.')) return;
    setError('');
    setMessage('');
    try {
      await api.put(`/orders/${id}/cancel`, {});
      setMessage('Order cancelled.');
      loadOrders();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not cancel order.');
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Order Parts</h1>
          <p>Browse available spare parts and submit an order.</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <div className="filter-bar">
        <input
          className="filter-search"
          type="text"
          placeholder="Search parts by name, SKU or description…"
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

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Image</th><th>Part</th><th>Price</th><th>Available</th><th>Quantity</th></tr>
          </thead>
          <tbody>
            {parts.length === 0 && <tr><td colSpan={5} className="empty-state">No parts match your filters.</td></tr>}
            {parts.map((p) => (
              <tr key={p.id}>
                <td>
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }} />
                  ) : (
                    <div style={{ width: 48, height: 48, borderRadius: 6, background: '#f1f1f1' }} />
                  )}
                </td>
                <td>{p.name}</td>
                <td>MK {Number(p.unit_price).toLocaleString()}</td>
                <td>{p.quantity > 0 ? p.quantity : <span className="badge badge-danger">Out of stock</span>}</td>
                <td>
                  <input
                    type="number"
                    min={0}
                    max={p.quantity}
                    disabled={p.quantity === 0}
                    className="qty-input"
                    value={cart[p.id] ?? ''}
                    onChange={(e) => setQty(p, e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={submitOrder}>Submit Order</button>

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
                        <button className="btn btn-danger btn-sm" onClick={() => cancelOrder(o.id)}>Cancel</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
