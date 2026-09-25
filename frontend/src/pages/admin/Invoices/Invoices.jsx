import { useEffect, useState } from 'react';
import api from '../../../api/api';
import './Invoices.css';

const STATUS_BADGE = {
  Unpaid: 'badge-danger',
  'Partially Paid': 'badge-warning',
  Paid: 'badge-success',
  Refunded: 'badge-neutral',
  Cancelled: 'badge-neutral',
};

export default function AdminInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [payModal, setPayModal] = useState(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');

  function load() {
    api.get('/invoices').then((r) => setInvoices(r.data.data));
  }

  useEffect(load, []);

  async function submitPayment(e) {
    e.preventDefault();
    setError(''); setMessage('');
    try {
      await api.post(`/invoices/${payModal.id}/pay`, { amount: Number(amount), method });
      setMessage(`Payment recorded for invoice ${payModal.invoice_number}.`);
      setPayModal(null);
      setAmount('');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not record payment.');
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Invoices & Payments</h1>
          <p>Track balances and record customer payments.</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Invoice #</th><th>Customer</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {invoices.length === 0 && <tr><td colSpan={7} className="empty-state">No invoices yet.</td></tr>}
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td>{inv.invoice_number}</td>
                <td>{inv.customer_name || '—'}</td>
                <td>MK {Number(inv.total).toLocaleString()}</td>
                <td>MK {Number(inv.amount_paid).toLocaleString()}</td>
                <td>MK {Number(inv.balance).toLocaleString()}</td>
                <td><span className={`badge ${STATUS_BADGE[inv.status] || 'badge-neutral'}`}>{inv.status}</span></td>
                <td>
                  {inv.balance > 0 && inv.status !== 'Cancelled' && (
                    <button className="btn btn-primary btn-sm" onClick={() => setPayModal(inv)}>Record Payment</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {payModal && (
        <div className="modal-backdrop" onClick={() => setPayModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Record payment — {payModal.invoice_number}</h2>
            <p className="muted-text">Outstanding balance: MK {Number(payModal.balance).toLocaleString()}</p>
            <form onSubmit={submitPayment}>
              <div className="form-group">
                <label>Amount (MK)</label>
                <input type="number" step="0.01" max={payModal.balance} value={amount} onChange={(e) => setAmount(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Payment method</label>
                <select value={method} onChange={(e) => setMethod(e.target.value)}>
                  <option>Cash</option>
                  <option>Bank Transfer</option>
                  <option>Mobile Money</option>
                  <option>Card</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setPayModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Record Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
