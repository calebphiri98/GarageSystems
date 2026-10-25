import api from './api';

/** target = { order_id } or { invoice_id }. Redirects the browser to PayChangu checkout. */
export async function startPayment(target) {
  const { data } = await api.post('/payments/initiate', target);
  const url = data?.data?.checkout_url;
  if (!url) throw new Error('Could not start payment.');
  window.location.href = url;
}