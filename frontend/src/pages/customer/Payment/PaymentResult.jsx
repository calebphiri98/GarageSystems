import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../../api/api';

const MAX_TRIES = 6;

export default function PaymentResult() {
  const { txRef } = useParams();
  const [state, setState] = useState('checking');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const tries = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let timer;

    async function check() {
      tries.current += 1;
      try {
        const { data } = await api.post('/payments/verify', { tx_ref: txRef });
        if (cancelled) return;
        const r = data?.data || {};
        setResult(r);

        // Payment can take a few seconds to show up - ask again before giving up.
        if ((r.state === 'pending' || r.state === 'error') && tries.current < MAX_TRIES) {
          timer = setTimeout(check, 3000);
          return;
        }
        setState(r.state || 'error');
      } catch (err) {
        if (cancelled) return;
        setError(err?.response?.data?.message || 'Could not check the payment.');
        setState('error');
      }
    }

    check();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [txRef]);

  const money = result?.amount ? `MK ${Number(result.amount).toLocaleString()}` : '';

  const content = {
    checking: { title: 'Confirming your payment...', text: 'Please wait a moment. Do not close this page.' },
    success: {
      title: 'Payment received',
      text: `${money} was paid for invoice ${result?.invoice_number || ''}. ${
        result?.order_id ? 'Your order is now waiting for the manager to approve it.' : ''
      }`,
    },
    pending: {
      title: 'Payment still processing',
      text: 'We have not received confirmation yet. This can take a few minutes. Check your invoices shortly - if you were charged it will appear there.',
    },
    failed: { title: 'Payment was not completed', text: 'You have not been charged. You can try again from your orders or invoices.' },
    review: {
      title: 'Payment needs review',
      text: 'We received your payment but something did not match, so the garage will check it manually. Please contact us if you do not hear back.',
    },
    unknown: { title: 'Payment not found', text: 'We could not find this payment.' },
    error: { title: 'Could not confirm the payment', text: error || 'Something went wrong while checking. Check your invoices shortly.' },
  }[state] || { title: 'Payment', text: '' };

  return (
    <div className="page">
      <div style={{ maxWidth: 520, margin: '40px auto', textAlign: 'center' }}>
        <h1>{content.title}</h1>
        <p>{content.text}</p>

        {state !== 'checking' && (
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24 }}>
            <Link className="btn btn-primary" to="/customer/orders">My orders</Link>
            <Link className="btn btn-outline" to="/customer/invoices">My invoices</Link>
          </div>
        )}
      </div>
    </div>
  );
}