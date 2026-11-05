import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../../api/api';
import './MockCheckout.css';

export default function MockCheckout() {
  const { txRef } = useParams();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    api.post('/payments/verify', { tx_ref: txRef })
      .then(({ data }) => {
        if (!active) return;
        const result = data?.data || {};
        if (result.state === 'success') {
          navigate(`/customer/payment/result/${encodeURIComponent(txRef)}`, { replace: true });
          return;
        }
        if (result.state === 'unknown') {
          setError('This payment could not be found.');
          return;
        }
        setSummary(result);
      })
      .catch((err) => {
        if (!active) return;
        setError(err?.response?.data?.message || 'Could not load this payment.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [txRef, navigate]);

  async function pay() {
    setPaying(true);
    setError('');
    try {
      await api.post('/payments/mock-complete', { tx_ref: txRef });
      navigate(`/customer/payment/result/${encodeURIComponent(txRef)}`, { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not complete the demo payment.');
      setPaying(false);
    }
  }

  const money = summary?.amount ? `MK ${Number(summary.amount).toLocaleString()}` : '';

  return (
    <div className="page">
      <div className="mock-checkout">
        <span className="mock-checkout-badge">Demo checkout</span>
        <h1>Uptown Garage checkout</h1>
        <p className="mock-checkout-lead">
          This is a local payment simulator for your presentation. No real money will be charged.
        </p>

        {loading && <p className="mock-checkout-muted">Loading payment details...</p>}
        {error && <div className="alert alert-error">{error}</div>}

        {!loading && !error && (
          <div className="mock-checkout-summary">
            <div>
              <span>Invoice</span>
              <strong>{summary?.invoice_number || '—'}</strong>
            </div>
            <div>
              <span>Amount</span>
              <strong>{money || '—'}</strong>
            </div>
            <div>
              <span>Reference</span>
              <strong className="mock-checkout-ref">{txRef}</strong>
            </div>
          </div>
        )}

        <div className="mock-checkout-actions">
          <button className="btn btn-primary" onClick={pay} disabled={paying || loading || !!error}>
            {paying ? 'Processing...' : `Pay ${money || ''} (demo)`}
          </button>
          <button
            className="btn btn-outline"
            onClick={() => navigate('/customer/invoices?payment=cancelled')}
            disabled={paying}
          >
            Cancel
          </button>
        </div>

        <p className="mock-checkout-note">
          To use real PayChangu checkout, set PAYMENTS_MOCK=false in the backend .env and add your
          gateway keys.
        </p>
      </div>
    </div>
  );
}
