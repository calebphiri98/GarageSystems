import { useEffect, useState } from 'react';
import api from '../../../api/api';
import './Reports.css';

const mk = (n) => 'MK ' + Number(n || 0).toLocaleString();
const num = (n) => Number(n || 0).toLocaleString();

function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function StatusTable({ title, rows }) {
  return (
    <section className="rpt-section">
      <h3>{title}</h3>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Status</th><th>Count</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={2} className="empty-state">No records in this period.</td></tr>}
            {rows.map((r) => <tr key={r.status}><td>{r.status}</td><td>{num(r.count)}</td></tr>)}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function Reports() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stockFilter, setStockFilter] = useState('all');

  const load = (f = from, t = to) => {
    setLoading(true);
    setError('');
    api
      .get('/reports/overview', { params: { from: f || undefined, to: t || undefined } })
      .then((r) => setData(r.data.data))
      .catch((e) => setError(e.response?.data?.message || 'Could not load the report.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load('', ''); /* eslint-disable-next-line */ }, []);

  const clear = () => { setFrom(''); setTo(''); load('', ''); };

  const exportCsv = () => {
    if (!data) return;
    const rows = [];
    const add = (...r) => rows.push(r);
    add('Uptown Garage - System Report');
    add('Period', data.range.from || 'start', 'to', data.range.to || 'today');
    add('Generated', new Date(data.generated_at).toLocaleString());
    add();
    add('SUMMARY');
    add('Revenue collected', data.revenue.total);
    add('Outstanding balance', data.unpaid.outstanding);
    add('Unpaid / partially paid invoices', data.unpaid.count);
    add('Products', data.inventory.products);
    add('Units in stock', data.inventory.units);
    add('Stock value', data.inventory.stock_value);
    add('Low stock', data.inventory.low_stock);
    add('Out of stock', data.inventory.out_of_stock);
    add();
    add('MOST SOLD PRODUCTS (paid)');
    add('Product', 'SKU', 'Units', 'Revenue');
    data.top_sold.forEach((p) => add(p.name, p.sku, p.units, p.revenue));
    add();
    add('UNPAID INVOICES');
    add('Invoice', 'Customer', 'Status', 'Total', 'Paid', 'Balance');
    data.unpaid.items.forEach((u) => add(u.invoice_number, u.customer, u.status, u.total, u.paid, u.balance));
    add();
    add('INVENTORY');
    add('Product', 'SKU', 'Category', 'Brand', 'Qty', 'Min level', 'Unit price');
    data.inventory.items.forEach((p) => add(p.name, p.sku, p.category, p.brand, p.quantity, p.min_stock_level, p.unit_price));
    [
      ['ORDERS BY STATUS', data.orders_by_status],
      ['JOBS BY STATUS', data.jobs_by_status],
      ['APPOINTMENTS BY STATUS', data.appointments_by_status],
      ['INVOICES BY STATUS', data.invoices_by_status],
    ].forEach(([title, list]) => {
      add();
      add(title);
      list.forEach((r) => add(r.status, r.count, r.total ?? ''));
    });

    const csv = rows.map((r) => r.map(csvCell).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `uptown-garage-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (loading && !data) return <div className="page"><p>Loading report...</p></div>;
  if (error && !data) return <div className="page"><p className="error-text">{error}</p></div>;
  if (!data) return null;

  const inv = data.inventory;
  const items = inv.items.filter((p) => {
    if (stockFilter === 'low') return p.quantity > 0 && p.quantity <= p.min_stock_level;
    if (stockFilter === 'out') return p.quantity === 0;
    return true;
  });
  const stockLabel = (p) => (p.quantity === 0 ? 'Out of stock' : p.quantity <= p.min_stock_level ? 'Low' : 'OK');

  return (
    <div className="page rpt">
      <div className="page-header">
        <div>
          <h1>System Report</h1>
          <p>
            Period: {data.range.from || 'all time'}{data.range.to ? ` to ${data.range.to}` : ''} - generated{' '}
            {new Date(data.generated_at).toLocaleString()}
          </p>
        </div>
        <div className="rpt-actions no-print">
          <button className="btn" onClick={exportCsv}>Export CSV</button>
          <button className="btn" onClick={() => window.print()}>Print / Save PDF</button>
        </div>
      </div>

      <div className="rpt-filters no-print">
        <label>From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <button className="btn" onClick={() => load()} disabled={loading}>{loading ? 'Loading...' : 'Apply'}</button>
        <button className="btn" onClick={clear} disabled={loading}>Clear</button>
        {error && <span className="error-text">{error}</span>}
      </div>
      <p className="rpt-note no-print">
        The date range applies to sales, revenue, invoices, orders, jobs and appointments. Stock levels and unpaid invoices always show the current position.
      </p>

      <div className="rpt-cards">
        <div className="rpt-card"><span>Revenue collected</span><strong>{mk(data.revenue.total)}</strong><small>{num(data.revenue.payments)} payments</small></div>
        <div className="rpt-card"><span>Outstanding balance</span><strong>{mk(data.unpaid.outstanding)}</strong><small>{num(data.unpaid.count)} unpaid / part-paid invoices</small></div>
        <div className="rpt-card"><span>Products in store</span><strong>{num(inv.products)}</strong><small>{num(inv.units)} units</small></div>
        <div className="rpt-card"><span>Stock value</span><strong>{mk(inv.stock_value)}</strong><small>at unit price</small></div>
        <div className="rpt-card"><span>Low stock</span><strong>{num(inv.low_stock)}</strong><small>at or below minimum</small></div>
        <div className="rpt-card"><span>Out of stock</span><strong>{num(inv.out_of_stock)}</strong><small>quantity is 0</small></div>
      </div>

      <section className="rpt-section">
        <h3>Most sold products</h3>
        <p className="rpt-note">Counts parts on paid orders and paid job invoices.</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>#</th><th>Product</th><th>SKU</th><th>Units sold</th><th>Revenue</th></tr></thead>
            <tbody>
              {data.top_sold.length === 0 && <tr><td colSpan={5} className="empty-state">No paid sales in this period.</td></tr>}
              {data.top_sold.map((p, i) => (
                <tr key={p.id}><td>{i + 1}</td><td>{p.name}</td><td>{p.sku}</td><td>{num(p.units)}</td><td>{mk(p.revenue)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rpt-section">
        <h3>Unpaid and partially paid invoices</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Invoice</th><th>Customer</th><th>Status</th><th>Total</th><th>Paid</th><th>Balance</th><th>Created</th></tr></thead>
            <tbody>
              {data.unpaid.items.length === 0 && <tr><td colSpan={7} className="empty-state">Nothing outstanding.</td></tr>}
              {data.unpaid.items.map((u) => (
                <tr key={u.id}>
                  <td>{u.invoice_number}</td><td>{u.customer}</td><td>{u.status}</td>
                  <td>{mk(u.total)}</td><td>{mk(u.paid)}</td><td>{mk(u.balance)}</td>
                  <td>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="rpt-grid">
        <StatusTable title="Orders by status" rows={data.orders_by_status} />
        <StatusTable title="Job cards by status" rows={data.jobs_by_status} />
        <StatusTable title="Appointments by status" rows={data.appointments_by_status} />
        <section className="rpt-section">
          <h3>Invoices by status</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Status</th><th>Count</th><th>Total</th></tr></thead>
              <tbody>
                {data.invoices_by_status.length === 0 && <tr><td colSpan={3} className="empty-state">No invoices in this period.</td></tr>}
                {data.invoices_by_status.map((r) => <tr key={r.status}><td>{r.status}</td><td>{num(r.count)}</td><td>{mk(r.total)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </section>
        <section className="rpt-section">
          <h3>Payments by method</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Method</th><th>Count</th><th>Total</th></tr></thead>
              <tbody>
                {data.revenue.by_method.length === 0 && <tr><td colSpan={3} className="empty-state">No payments in this period.</td></tr>}
                {data.revenue.by_method.map((r) => <tr key={r.method}><td>{r.method}</td><td>{num(r.count)}</td><td>{mk(r.total)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </section>
        <section className="rpt-section">
          <h3>Active users</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Role</th><th>Count</th></tr></thead>
              <tbody>
                {data.people.map((r) => <tr key={r.role} style={{ textTransform: 'capitalize' }}><td>{r.role}</td><td>{num(r.count)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="rpt-section">
        <div className="rpt-inv-head">
          <h3>Products in store</h3>
          <select className="no-print" value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}>
            <option value="all">All products</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Brand</th><th>Qty</th><th>Min</th><th>Unit price</th><th>Stock</th></tr></thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={8} className="empty-state">No products match.</td></tr>}
              {items.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td><td>{p.sku}</td><td>{p.category || '-'}</td><td>{p.brand || '-'}</td>
                  <td>{num(p.quantity)}</td><td>{num(p.min_stock_level)}</td><td>{mk(p.unit_price)}</td>
                  <td className={'rpt-stock rpt-' + stockLabel(p).toLowerCase().replace(/\s/g, '-')}>{stockLabel(p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
