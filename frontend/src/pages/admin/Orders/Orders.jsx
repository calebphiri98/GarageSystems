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

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');

  function load() {
    api.get('/orders').then((r) => setOrders(r.data.data));
  }

  useEffect(load, []);

  async function review(id, decision) {
    setError('');
    try {
      await api.put(`/orders/${id}/review`, { decision });
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update order.');
    }
  }

  async function markStatus(id, status) {
    setError('');
    try {
      await api.put(`/orders/${id}/status`, { status });
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update order.');
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Parts Orders</h1>
          <p>Review and process customer spare-part orders.</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Order #</th><th>Customer</th><th>Items</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {orders.length === 0 && <tr><td colSpan={5} className="empty-state">No orders yet.</td></tr>}
            {orders.map((o) => (
              <tr key={o.id}>
                <td>#{o.id}</td>
                <td>{o.customer_name}</td>
                <td>{o.items?.map((i) => `${i.part_name} x${i.quantity}`).join(', ')}</td>
                <td><span className={`badge ${STATUS_BADGE[o.status] || 'badge-neutral'}`}>{o.status}</span></td>
                <td className="action-cell">
                  {o.status === 'Pending' && (
                    <>
                      <button className="btn btn-success btn-sm" onClick={() => review(o.id, 'Confirmed')}>Confirm</button>
                      <button className="btn btn-danger btn-sm" onClick={() => review(o.id, 'Rejected')}>Reject</button>
                    </>
                  )}
                  {o.status === 'Confirmed' && (
                    <button className="btn btn-outline btn-sm" onClick={() => markStatus(o.id, 'Ready for Collection')}>Ready for Collection</button>
                  )}
                  {o.status === 'Ready for Collection' && (
                    <button className="btn btn-outline btn-sm" onClick={() => markStatus(o.id, 'Completed')}>Mark Completed</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
