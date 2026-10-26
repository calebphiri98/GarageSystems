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

const INVOICE_BADGE = {
  Unpaid: 'badge-danger',
  'Partially Paid': 'badge-warning',
  Paid: 'badge-success',
  Refunded: 'badge-neutral',
  Cancelled: 'badge-neutral',
};

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function load() {
    api.get('/orders').then((r) => setOrders(r.data.data));
  }

  useEffect(load, []);

  async function review(id, decision) {
    setError('');
    setMessage('');
    try {
      const { data } = await api.put(`/orders/${id}/review`, { decision });
      setMessage(data?.message || `Order ${decision}.`);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update order.');
    }
  }

  function reject(order) {
    const paid = Number(order.amount_paid || 0);
    const warning = paid > 0
      ? `This customer has already paid MK ${paid.toLocaleString()}. Rejecting does NOT refund them automatically - you will need to refund them yourself. Reject this order?`
      : 'Reject this order?';
    if (!window.confirm(warning)) return;
    review(order.id, 'Rejected');
  }

  async function markStatus(id, status) {
    setError('');
    setMessage('');
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
          <p>Customers pay first, then you accept or reject the order. Stock reduces when you accept.</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Order #</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {orders.length === 0 && <tr><td colSpan={7} className="empty-state">No orders yet.</td></tr>}
            {orders.map((o) => {
              const isPaid = o.invoice_status === 'Paid';

              return (
                <tr key={o.id}>
                  <td>#{o.id}</td>
                  <td>{o.customer_name}</td>
                  <td>{o.items?.map((i) => `${i.part_name} x${i.quantity}`).join(', ')}</td>
                  <td>MK {Number(o.total_amount || 0).toLocaleString()}</td>
                  <td>
                    {o.invoice_number ? (
                      <>
                        <span className={`badge ${INVOICE_BADGE[o.invoice_status] || 'badge-neutral'}`}>{o.invoice_status}</span>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>{o.invoice_number}</div>
                      </>
                    ) : (
                      <span style={{ color: 'var(--color-text-muted)' }}>No invoice</span>
                    )}
                  </td>
                  <td><span className={`badge ${STATUS_BADGE[o.status] || 'badge-neutral'}`}>{o.status}</span></td>
                  <td className="action-cell">
                    {o.status === 'Pending' && (
                      <>
                        <button
                          className="btn btn-success btn-sm"
                          disabled={!isPaid}
                          title={isPaid ? 'Accept this order' : 'The customer has not paid yet'}
                          onClick={() => review(o.id, 'Confirmed')}
                        >
                          Accept
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => reject(o)}>Reject</button>
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
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
