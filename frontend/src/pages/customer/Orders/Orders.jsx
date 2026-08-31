import { useEffect, useState } from 'react';
import api from '../../../api/api';
import './Orders.css';

const STATUS_BADGE = {
  Pending: 'badge-warning',
  Confirmed: 'badge-info',
  Rejected: 'badge-danger',
  'Ready for Collection': 'badge-success',
  Completed: 'badge-neutral',
};

export default function Orders() {
  const [parts, setParts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [cart, setCart] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function load() {
    api.get('/inventory').then((r) => setParts(r.data.data));
    api.get('/orders').then((r) => setOrders(r.data.data));
  }

  useEffect(load, []);

  function setQty(partId, qty) {
    setCart((c) => ({ ...c, [partId]: qty }));
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
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not place order.');
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

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Part</th><th>Price</th><th>Available</th><th>Quantity</th></tr>
          </thead>
          <tbody>
            {parts.map((p) => (
              <tr key={p.id}>
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
                    value={cart[p.id] || ''}
                    onChange={(e) => setQty(p.id, e.target.value)}
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
              <thead><tr><th>Order #</th><th>Items</th><th>Status</th><th>Placed</th></tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>#{o.id}</td>
                    <td>{o.items?.map((i) => `${i.part_name} x${i.quantity}`).join(', ')}</td>
                    <td><span className={`badge ${STATUS_BADGE[o.status] || 'badge-neutral'}`}>{o.status}</span></td>
                    <td>{new Date(o.created_at).toLocaleDateString()}</td>
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
