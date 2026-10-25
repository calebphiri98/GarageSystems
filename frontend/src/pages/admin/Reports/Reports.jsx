import { useCallback, useEffect, useState } from 'react';
import api from '../../../api/api';
import './Reports.css';

const mk = (n) => 'MK ' + Number(n || 0).toLocaleString();
const num = (n) => Number(n || 0).toLocaleString();

function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function toneFor(status) {
  const s = String(status || '').toLowerCase();
  if (/unpaid|cancel|reject|refund|fail|declin|out of stock/.test(s)) return 'red';
  if (/partial|pend|await|progress|low|assign|open/.test(s)) return 'amber';
  if (/^paid$|complete|collect|approv|confirm|close|deliver|verif|^ok$|ready/.test(s)) return 'green';
  return 'gray';
}

function Pill({ status }) {
  return <span className={'rpt-pill rpt-pill-' + toneFor(status)}>{status}</span>;
}

function Panel({ title, note, action, children }) {
  return (
    <section className="rpt-panel">
      <header className="rpt-panel-head">
        <div>
          <h3>{title}</h3>
          {note && <p>{note}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function Empty({ cols, text }) {
  return (
    <tr>
      <td colSpan={cols} className="rpt-empty">{text}</td>
    </tr>
  );
}

function StatusPanel({ title, rows, emptyText }) {
  const total = rows.reduce((sum, r) => sum + Number(r.count), 0);
  return (
    <Panel title={title} note={total ? `${num(total)} in total` : null}>
      <div className="rpt-scroll">
        <table className="rpt-table">
          <thead>
            <tr><th>Status</th><th className="num">Count</th><th className="rpt-share-col">Share</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <Empty cols={3} text={emptyText} />}
            {rows.map((r) => (
              <tr key={r.status}>
                <td><Pill status={r.status} /></td>
                <td className="num">{num(r.count)}</td>
                <td className="rpt-share-col">
                  <div className="rpt-bar"><span style={{ width: `${total ? (Number(r.count) / total) * 100 : 0}%` }} /></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export default function Reports() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stockFilter, setStockFilter] = useState('all');

  const load = useCallback((f, t) => {
    setLoading(true);
    setError('');
    api
      .get('/reports/overview', { params: { from: f || undefined, to: t || undefined } })
      .then((r) => setData(r.data.data))
      .catch((e) => setError(e.response?.data?.message || 'Could not load the report.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load('', '');
  }, [load]);

  const clear = () => {
    setFrom('');
    setTo('');
    load('', '');
  };

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

  if (loading && !data) {
    return (
      <div className="page rpt">
        <div className="rpt-loading">Preparing your report...</div>
      </div>
    );
  }
  if (error && !data) {
    return (
      <div className="page rpt">
        <div className="rpt-alert">{error}</div>
        <button className="rpt-btn rpt-btn-primary" onClick={() => load('', '')}>Try again</button>
      </div>
    );
  }
  if (!data) return null;

  const inv = data.inventory;
  const items = inv.items.filter((p) => {
    if (stockFilter === 'low') return p.quantity > 0 && p.quantity <= p.min_stock_level;
    if (stockFilter === 'out') return p.quantity === 0;
    return true;
  });
  const stockLabel = (p) => (p.quantity === 0 ? 'Out of stock' : p.quantity <= p.min_stock_level ? 'Low' : 'OK');
  const maxUnits = Math.max(1, ...data.top_sold.map((p) => Number(p.units)));
  const periodText = `${data.range.from || 'Beginning'} - ${data.range.to || 'Today'}`;

  const kpis = [
    { tone: 'green', label: 'Revenue collected', value: mk(data.revenue.total), sub: `${num(data.revenue.payments)} payments received` },
    { tone: 'red', label: 'Outstanding balance', value: mk(data.unpaid.outstanding), sub: `${num(data.unpaid.count)} unpaid or part-paid invoices` },
    { tone: 'blue', label: 'Products in store', value: num(inv.products), sub: `${num(inv.units)} units on the shelf` },
    { tone: 'violet', label: 'Stock value', value: mk(inv.stock_value), sub: 'Quantity multiplied by unit price' },
    { tone: 'amber', label: 'Low stock', value: num(inv.low_stock), sub: 'At or below the minimum level' },
    { tone: 'rose', label: 'Out of stock', value: num(inv.out_of_stock), sub: 'Quantity is zero' },
  ];

  return (
    <div className="page rpt">
      <div className="rpt-print-header">
        <strong>Uptown Garage</strong>
        <span>System Report - {periodText}</span>
        <span>Generated {new Date(data.generated_at).toLocaleString()}</span>
      </div>

      <div className="rpt-hero">
        <div>
          <h1>System Report</h1>
          <div className="rpt-meta">
            <span className="rpt-chip">Period: {periodText}</span>
            <span className="rpt-chip">Generated {new Date(data.generated_at).toLocaleString()}</span>
          </div>
        </div>
        <div className="rpt-actions no-print">
          <button className="rpt-btn rpt-btn-ghost" onClick={exportCsv}>Export CSV</button>
          <button className="rpt-btn rpt-btn-primary" onClick={() => window.print()}>Print / Save PDF</button>
        </div>
      </div>

      <div className="rpt-toolbar no-print">
        <label>
          <span>From</span>
          <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          <span>To</span>
          <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button className="rpt-btn rpt-btn-primary" onClick={() => load(from, to)} disabled={loading}>
          {loading ? 'Loading...' : 'Apply'}
        </button>
        <button className="rpt-btn rpt-btn-ghost" onClick={clear} disabled={loading}>Reset</button>
        <p>Dates filter sales, revenue, invoices, orders, jobs and appointments. Stock and unpaid invoices always show today's position.</p>
      </div>

      {error && <div className="rpt-alert">{error}</div>}

      <div className="rpt-kpis">
        {kpis.map((k) => (
          <article key={k.label} className={'rpt-kpi rpt-tone-' + k.tone}>
            <span className="rpt-kpi-label">{k.label}</span>
            <strong>{k.value}</strong>
            <small>{k.sub}</small>
          </article>
        ))}
      </div>

      <Panel title="Most sold products" note="Parts on paid orders and paid job invoices, ranked by units sold">
        <div className="rpt-scroll">
          <table className="rpt-table">
            <thead>
              <tr><th>Rank</th><th>Product</th><th>SKU</th><th className="num">Units sold</th><th className="rpt-share-col">Volume</th><th className="num">Revenue</th></tr>
            </thead>
            <tbody>
              {data.top_sold.length === 0 && <Empty cols={6} text="No paid sales in this period." />}
              {data.top_sold.map((p, i) => (
                <tr key={p.id}>
                  <td><span className={'rpt-rank rpt-rank-' + (i < 3 ? i + 1 : 'n')}>{i + 1}</span></td>
                  <td className="rpt-strong">{p.name}</td>
                  <td className="rpt-muted">{p.sku}</td>
                  <td className="num">{num(p.units)}</td>
                  <td className="rpt-share-col">
                    <div className="rpt-bar"><span style={{ width: `${(Number(p.units) / maxUnits) * 100}%` }} /></div>
                  </td>
                  <td className="num rpt-strong">{mk(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        title="Unpaid and partially paid invoices"
        note={data.unpaid.count ? `${num(data.unpaid.count)} invoices - ${mk(data.unpaid.outstanding)} outstanding` : 'Everything is settled'}
      >
        <div className="rpt-scroll">
          <table className="rpt-table">
            <thead>
              <tr><th>Invoice</th><th>Customer</th><th>Status</th><th className="num">Total</th><th className="num">Paid</th><th className="num">Balance</th><th>Created</th></tr>
            </thead>
            <tbody>
              {data.unpaid.items.length === 0 && <Empty cols={7} text="Nothing outstanding." />}
              {data.unpaid.items.map((u) => (
                <tr key={u.id}>
                  <td className="rpt-strong">{u.invoice_number}</td>
                  <td>{u.customer}</td>
                  <td><Pill status={u.status} /></td>
                  <td className="num">{mk(u.total)}</td>
                  <td className="num">{mk(u.paid)}</td>
                  <td className="num rpt-strong rpt-danger">{mk(u.balance)}</td>
                  <td className="rpt-muted">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="rpt-grid">
        <StatusPanel title="Orders by status" rows={data.orders_by_status} emptyText="No orders in this period." />
        <StatusPanel title="Job cards by status" rows={data.jobs_by_status} emptyText="No jobs in this period." />
        <StatusPanel title="Appointments by status" rows={data.appointments_by_status} emptyText="No appointments in this period." />

        <Panel title="Invoices by status">
          <div className="rpt-scroll">
            <table className="rpt-table">
              <thead>
                <tr><th>Status</th><th className="num">Count</th><th className="num">Total</th></tr>
              </thead>
              <tbody>
                {data.invoices_by_status.length === 0 && <Empty cols={3} text="No invoices in this period." />}
                {data.invoices_by_status.map((r) => (
                  <tr key={r.status}>
                    <td><Pill status={r.status} /></td>
                    <td className="num">{num(r.count)}</td>
                    <td className="num rpt-strong">{mk(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Payments by method">
          <div className="rpt-scroll">
            <table className="rpt-table">
              <thead>
                <tr><th>Method</th><th className="num">Count</th><th className="num">Total</th></tr>
              </thead>
              <tbody>
                {data.revenue.by_method.length === 0 && <Empty cols={3} text="No payments in this period." />}
                {data.revenue.by_method.map((r) => (
                  <tr key={r.method}>
                    <td className="rpt-strong">{r.method}</td>
                    <td className="num">{num(r.count)}</td>
                    <td className="num rpt-strong">{mk(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Active users">
          <div className="rpt-scroll">
            <table className="rpt-table">
              <thead>
                <tr><th>Role</th><th className="num">Count</th></tr>
              </thead>
              <tbody>
                {data.people.map((r) => (
                  <tr key={r.role}>
                    <td className="rpt-strong rpt-cap">{r.role}</td>
                    <td className="num">{num(r.count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <Panel
        title="Products in store"
        note={`${num(items.length)} of ${num(inv.items.length)} products shown`}
        action={
          <select className="rpt-select no-print" value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}>
            <option value="all">All products</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
          </select>
        }
      >
        <div className="rpt-scroll">
          <table className="rpt-table">
            <thead>
              <tr>
                <th>Product</th><th>SKU</th><th>Category</th><th>Brand</th>
                <th className="num">Qty</th><th className="num">Min</th><th className="num">Unit price</th><th>Stock</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && <Empty cols={8} text="No products match this filter." />}
              {items.map((p) => (
                <tr key={p.id}>
                  <td className="rpt-strong">{p.name}</td>
                  <td className="rpt-muted">{p.sku}</td>
                  <td>{p.category || '-'}</td>
                  <td>{p.brand || '-'}</td>
                  <td className="num rpt-strong">{num(p.quantity)}</td>
                  <td className="num rpt-muted">{num(p.min_stock_level)}</td>
                  <td className="num">{mk(p.unit_price)}</td>
                  <td><Pill status={stockLabel(p)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}