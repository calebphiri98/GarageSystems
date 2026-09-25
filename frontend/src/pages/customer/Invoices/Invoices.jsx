import { useEffect, useState } from 'react';
import api from '../../../api/api';
import './Invoices.css';

const STATUS_BADGE = {
  Unpaid: 'badge-danger',
  'Partially Paid': 'badge-warning',
  Paid: 'badge-success',
  Refunded: 'badge-info',
  Cancelled: 'badge-neutral',
};

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);

  useEffect(() => {
    api.get('/invoices').then((r) => setInvoices(r.data.data));
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Invoices</h1>
          <p>View your billing history, balances and payment status.</p>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Invoice #</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th>Date</th></tr>
          </thead>
          <tbody>
            {invoices.length === 0 && <tr><td colSpan={6} className="empty-state">No invoices yet.</td></tr>}
            {invoices.map((i) => (
              <tr key={i.id}>
                <td>{i.invoice_number}</td>
                <td>MK {Number(i.total).toLocaleString()}</td>
                <td>MK {Number(i.amount_paid).toLocaleString()}</td>
                <td>MK {Number(i.balance).toLocaleString()}</td>
                <td><span className={`badge ${STATUS_BADGE[i.status] || 'badge-neutral'}`}>{i.status}</span></td>
                <td>{new Date(i.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
