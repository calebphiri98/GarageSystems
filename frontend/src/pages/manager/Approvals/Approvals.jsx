import { useEffect, useState } from 'react';
import api from '../../../api/api';
import './Approvals.css';

export default function ManagerApprovals() {
  const [invoices, setInvoices] = useState([]);
  const [cancelModal, setCancelModal] = useState(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function load() {
    api.get('/invoices').then((r) => setInvoices(r.data.data));
  }

  useEffect(load, []);

  async function submitCancel(e) {
    e.preventDefault();
    setError(''); setMessage('');
    try {
      await api.put(`/invoices/${cancelModal.id}/cancel`, { reason });
      setMessage(`Invoice ${cancelModal.invoice_number} cancelled.`);
      setCancelModal(null);
      setReason('');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not cancel invoice.');
    }
  }

  const cancellable = invoices.filter((i) => i.status !== 'Cancelled');

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Sensitive Approvals</h1>
          <p>Actions such as invoice cancellations require manager sign-off, per policy.</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Invoice #</th><th>Customer</th><th>Total</th><th>Status</th><th>Action</th></tr>
          </thead>
          <tbody>
            {cancellable.length === 0 && <tr><td colSpan={5} className="empty-state">Nothing requires your attention.</td></tr>}
            {cancellable.map((inv) => (
              <tr key={inv.id}>
                <td>{inv.invoice_number}</td>
                <td>{inv.customer_name}</td>
                <td>MK {Number(inv.total).toLocaleString()}</td>
                <td><span className="badge badge-info">{inv.status}</span></td>
                <td>
                  <button className="btn btn-danger btn-sm" onClick={() => setCancelModal(inv)}>Cancel Invoice</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {cancelModal && (
        <div className="modal-backdrop" onClick={() => setCancelModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Cancel invoice {cancelModal.invoice_number}</h2>
            <p className="muted-text">This keeps the record for audit purposes; it will not be deleted.</p>
            <form onSubmit={submitCancel}>
              <div className="form-group">
                <label>Reason for cancellation</label>
                <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} required />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setCancelModal(null)}>Back</button>
                <button type="submit" className="btn btn-danger">Confirm Cancellation</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
