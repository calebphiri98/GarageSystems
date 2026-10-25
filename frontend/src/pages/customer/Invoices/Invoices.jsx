import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../../api/api';
import { startPayment } from '../../../api/payments';
import './Invoices.css';

const STATUS_BADGE = {
  Unpaid: 'badge-danger',
  'Partially Paid': 'badge-warning',
  Paid: 'badge-success',
  Refunded: 'badge-info',
  Cancelled: 'badge-neutral',
};

export default function Invoices() {
  const [params] = useSearchParams();
  const [invoices, setInvoices] = useState([]);
  const [error, setError] = useState('');
  const [payingId, setPayingId] = useState(null);

  useEffect(() => {
    api.get('/invoices').then((r) => setInvoices(r.data.data));
  }, []);

  async function payNow(invoice) {
    setPayingId(invoice.id);
    setError('');
    try {
      await startPayment({ invoice_id: invoice.id });
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Could not start payment.');
      setPayingId(null);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Invoices</h1>
          <p>View your billing history, balances and payment status.</p>
        </div>
      </div>

      {params.get('payment') === 'cancelled' && (
        <div className="alert alert-error">Payment was cancelled. You have not been charged.</div>
      )}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Invoice #</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th>Date</th><th></th></tr>
          </thead>
          <tbody>
            {invoices.length === 0 && <tr><td colSpan={7} className="empty-state">No invoices yet.</td></tr>}
            {invoices.map((i) => (
              <tr key={i.id}>
                <td>{i.invoice_number}</td>
                <td>MK {Number(i.total).toLocaleString()}</td>
                <td>MK {Number(i.amount_paid).toLocaleString()}</td>
                <td>MK {Number(i.balance).toLocaleString()}</td>
                <td><span className={`badge ${STATUS_BADGE[i.status] || 'badge-neutral'}`}>{i.status}</span></td>
                <td>{new Date(i.created_at).toLocaleDateString()}</td>
                <td>
                  {Number(i.balance) > 0 && (i.status === 'Unpaid' || i.status === 'Partially Paid') && (
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={payingId === i.id}
                      onClick={() => payNow(i)}
                    >
                      {payingId === i.id ? 'Redirecting...' : 'Pay now'}
                    </button>
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