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
  const [editModal, setEditModal] = useState(null); // { order, items: [{part_id, quantity, part_name, stock_available}] }
  const [saving, setSaving] = useState(false);

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

  async function cancelOrder(order) {
    const paid = Number(order.amount_paid || 0);
    const warning = paid > 0
      ? `This customer has already paid MK ${paid.toLocaleString()}. Cancelling does NOT refund them automatically - you will need to refund them yourself. Cancel this order?`
      : 'Cancel this order? Any reserved stock will be restored.';
    if (!window.confirm(warning)) return;
    setError('');
    setMessage('');
    try {
      const { data } = await api.put(`/orders/${order.id}/cancel`, {});
      setMessage(data?.message || 'Order cancelled.');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not cancel order.');
    }
  }

  function openEdit(order) {
    setEditModal({
      order,
      items: order.items.map((i) => ({ part_id: i.part_id, part_name: i.part_name, stock_available: i.stock_available, quantity: i.quantity })),
    });
  }

  function updateEditQty(partId, qty) {
    setEditModal((m) => ({
      ...m,
      items: m.items.map((it) => (it.part_id === partId ? { ...it, quantity: qty } : it)),
    }));
  }

  async function saveEdit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const items = editModal.items
        .filter((i) => Number(i.quantity) > 0)
        .map((i) => ({ part_id: i.part_id, quantity: Number(i.quantity) }));
      await api.put(`/orders/${editModal.order.id}/edit`, { items });
      setEditModal(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Parts Orders</h1>
          <p>Customers pay first, then you confirm the order. Stock reduces when you confirm.</p>
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
              const hasPayment = Number(o.amount_paid || 0) > 0;

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
                        {!hasPayment && (
                          <button className="btn btn-outline btn-sm" onClick={() => openEdit(o)}>Edit</button>
                        )}
                        <button
                          className="btn btn-success btn-sm"
                          disabled={!isPaid}
                          title={isPaid ? 'Approve this order' : 'The customer has not paid yet'}
                          onClick={() => review(o.id, 'Confirmed')}
                        >
                          Confirm
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => review(o.id, 'Rejected')}>Reject</button>
                      </>
                    )}
                    {o.status === 'Confirmed' && (
                      <button className="btn btn-outline btn-sm" onClick={() => markStatus(o.id, 'Ready for Collection')}>Ready for Collection</button>
                    )}
                    {o.status === 'Ready for Collection' && (
                      <button className="btn btn-outline btn-sm" onClick={() => markStatus(o.id, 'Completed')}>Mark Completed</button>
                    )}
                    {(o.status === 'Pending' || o.status === 'Confirmed') && (
                      <button className="btn btn-danger btn-sm" onClick={() => cancelOrder(o)}>Cancel</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editModal && (
        <div className="modal-backdrop" onClick={() => setEditModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Edit order #{editModal.order.id}</h2>
            <p className="muted-text">Adjust quantities before the customer pays. Cannot exceed current stock.</p>
            <form onSubmit={saveEdit}>
              {editModal.items.map((item) => (
                <div className="form-group" key={item.part_id}>
                  <label>{item.part_name} (in stock: {item.stock_available})</label>
                  <input
                    type="number"
                    min={0}
                    max={item.stock_available}
                    value={item.quantity}
                    onChange={(e) => {
                      let v = Number(e.target.value);
                      if (v > item.stock_available) v = item.stock_available;
                      if (v < 0) v = 0;
                      updateEditQty(item.part_id, v);
                    }}
                  />
                </div>
              ))}
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setEditModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}