import { useCallback, useEffect, useState } from 'react';
import api from '../../../api/api';
import '../../admin/Reports/Reports.css';
import './Reports.css';

const mk = (n) => 'MK ' + Number(n || 0).toLocaleString();
const num = (n) => Number(n || 0).toLocaleString();
const pct = (n) => `${Number(n || 0)}%`;

function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function toneFor(status) {
  const s = String(status || '').toLowerCase();
  if (/unpaid|cancel|reject|refund|fail|declin|out of stock/.test(s)) return 'red';
  if (/partial|pend|await|progress|low|assign|open/.test(s)) return 'amber';
  if (/^paid$|complete|collect|approv|confirm|close|deliver|verif|ready/.test(s)) return 'green';
  return 'gray';
}

function Pill({ status }) {
  return <span className={'rpt-pill rpt-pill-' + toneFor(status)}>{status}</span>;
}

function Panel({ title, note, children }) {
  return (
    <section className="rpt-panel">
      <header className="rpt-panel-head">
        <div>
          <h3>{title}</h3>
          {note && <p>{note}</p>}
        </div>
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

/* SQL timestamps arrive as "YYYY-MM-DD HH:MM:SS"; make them ISO so every
   browser parses them the same way. */
function toDate(value) {
  if (!value) return null;
  const d = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d;
}

function dateText(value) {
  const d = toDate(value);
  return d ? d.toLocaleDateString() : '-';
}

function dateTimeText(value) {
  const d = toDate(value);
  return d ? d.toLocaleString() : '-';
}

/* One completed job, expanded to show every activity recorded on it. */
function ServiceCard({ job }) {
  const [open, setOpen] = useState(false);
  const t = job.totals;

  return (
    <article className={'mgr-job' + (open ? ' mgr-job-open' : '')}>
      <button type="button" className="mgr-job-head" onClick={() => setOpen((v) => !v)}>
        <span className="mgr-job-toggle">{open ? '−' : '+'}</span>

        <span className="mgr-job-main">
          <strong>{job.job_number}</strong>
          <span className="mgr-job-sub">
            {job.customer} · {job.vehicle || 'Vehicle'} · {job.plate_number}
          </span>
        </span>

        <span className="mgr-job-meta">
          <span className="mgr-job-mech">{job.mechanic || 'Unassigned'}</span>
          <span className="mgr-job-date">{dateText(job.closed_at)}</span>
        </span>

        <span className="mgr-job-money">
          <strong>{mk(t.total)}</strong>
          <small>
            {!job.invoice
              ? 'No invoice'
              : t.paid >= t.total && t.total > 0
                ? 'Paid'
                : `${mk(t.total - t.paid)} due`}
          </small>
        </span>

        <Pill status={job.status} />
      </button>

      {open && (
        <div className="mgr-job-body">
          <div className="mgr-job-facts">
            <div>
              <span>Reported problem</span>
              <p>{job.reported_problem || '-'}</p>
            </div>
            <div>
              <span>Diagnosis</span>
              <p>{job.diagnosis || '-'}</p>
            </div>
            <div>
              <span>Work performed</span>
              <p>{job.work_performed || '-'}</p>
            </div>
            <div>
              <span>Completion notes</span>
              <p>{job.completion_notes || '-'}</p>
            </div>
            <div>
              <span>Opened</span>
              <p>{dateTimeText(job.opened_at)}</p>
            </div>
            <div>
              <span>Closed</span>
              <p>{dateTimeText(job.closed_at)}</p>
            </div>
          </div>

          <div className="mgr-job-tables">
            <div>
              <h4>Services charged</h4>
              <table className="rpt-table">
                <thead>
                  <tr><th>Service</th><th className="num">Qty</th><th className="num">Unit</th><th className="num">Amount</th></tr>
                </thead>
                <tbody>
                  {job.services.length === 0 && <Empty cols={4} text="No services recorded." />}
                  {job.services.map((s, i) => (
                    <tr key={i}>
                      <td>
                        <span className="rpt-strong">{s.service}</span>
                        {s.description && <span className="mgr-job-note">{s.description}</span>}
                      </td>
                      <td className="num">{num(s.quantity)}</td>
                      <td className="num">{mk(s.unit_price)}</td>
                      <td className="num rpt-strong">{mk(s.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <h4>Parts used</h4>
              <table className="rpt-table">
                <thead>
                  <tr><th>Part</th><th className="num">Qty</th><th className="num">Unit</th><th className="num">Amount</th></tr>
                </thead>
                <tbody>
                  {job.parts.length === 0 && <Empty cols={4} text="No parts used." />}
                  {job.parts.map((p, i) => (
                    <tr key={i}>
                      <td>
                        <span className="rpt-strong">{p.part}</span>
                        <span className="mgr-job-note">{p.sku}</span>
                      </td>
                      <td className="num">{num(p.quantity)}</td>
                      <td className="num">{mk(p.unit_price)}</td>
                      <td className="num rpt-strong">{mk(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {job.approvals.length > 0 && (
            <div className="mgr-job-approvals">
              <h4>Extra work approvals</h4>
              <ul>
                {job.approvals.map((a, i) => (
                  <li key={i}>
                    <Pill status={a.status} />
                    <span>{a.description}</span>
                    <strong>{mk(a.estimated_cost)}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mgr-job-invoice">
            {job.invoice ? (
              <>
                <div className="mgr-job-invoice-head">
                  <span>Invoice <strong>{job.invoice.invoice_number}</strong></span>
                  <Pill status={job.invoice.status} />
                </div>
                <dl>
                  <div><dt>Services</dt><dd>{mk(job.invoice.services_total)}</dd></div>
                  <div><dt>Parts</dt><dd>{mk(job.invoice.parts_total)}</dd></div>
                  <div><dt>Additional labour</dt><dd>{mk(job.invoice.additional_labour)}</dd></div>
                  <div><dt>Discount</dt><dd>−{mk(job.invoice.discount)}</dd></div>
                  <div className="mgr-job-total"><dt>Total</dt><dd>{mk(job.invoice.total)}</dd></div>
                  <div><dt>Paid</dt><dd>{mk(job.invoice.paid)}</dd></div>
                  <div><dt>Balance</dt><dd className={job.invoice.balance > 0 ? 'rpt-danger' : ''}>{mk(job.invoice.balance)}</dd></div>
                </dl>
                {job.invoice.payments.length > 0 && (
                  <ul className="mgr-job-payments">
                    {job.invoice.payments.map((p, i) => (
                      <li key={i}>
                        <span>{dateText(p.paid_at)}</span>
                        <span>{p.method || 'Cash'}</span>
                        <strong>{mk(p.amount)}</strong>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="mgr-job-noinvoice">No invoice generated for this job yet.</p>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

export default function ManagerReports() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback((f, t) => {
    setLoading(true);
    setError('');
    api
      .get('/reports/manager/activity', { params: { from: f || undefined, to: t || undefined } })
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
    setSearch('');
    load('', '');
  };

  const exportCsv = () => {
    if (!data) return;

    const rows = [];
    const add = (...r) => rows.push(r);

    add('Uptown Garage - Business Report');
    add('Period', data.range.from || 'start', 'to', data.range.to || 'today');
    add('Generated', new Date(data.generated_at).toLocaleString());
    add();

    add('CASH');
    add('Cash received', data.cash.received);
    add('Payments', data.cash.payments);
    add('Invoiced in period', data.cash.raised);
    add('Outstanding today', data.cash.outstanding);
    add('Collection rate %', data.analysis.collection_rate);
    add();
    add('Cash by method', 'Count', 'Total');
    data.cash.by_method.forEach((m) => add(m.method, m.count, m.total));
    add();
    add('Cash by source', 'Count', 'Total');
    data.cash.by_source.forEach((s) => add(s.source, s.count, s.total));
    add();

    add('BUSINESS ANALYSIS');
    add('Completed jobs', data.analysis.completed_jobs);
    add('Completed value', data.analysis.completed_value);
    add('Average job value', data.analysis.average_job_value);
    add('Labour revenue', data.analysis.labour_revenue);
    add('Parts revenue', data.analysis.parts_revenue);
    add('Unique customers', data.analysis.unique_customers);
    add('Repeat customers', data.analysis.repeat_customers);
    add();

    add('MOST SOLD PRODUCTS (descending by units)');
    add('Rank', 'Product', 'SKU', 'Units', 'Revenue', 'Share %');
    data.top_sold.forEach((p, i) => add(i + 1, p.name, p.sku, p.units, p.revenue, p.share));
    add();

    add('COMPLETED SERVICES');
    add('Job', 'Customer', 'Vehicle', 'Plate', 'Mechanic', 'Closed', 'Services', 'Parts', 'Total', 'Paid', 'Balance');
    data.completed_services.forEach((j) => add(
      j.job_number, j.customer, j.vehicle, j.plate_number, j.mechanic,
      j.closed_at, j.totals.services, j.totals.parts, j.totals.total, j.totals.paid,
      j.totals.total - j.totals.paid,
    ));
    add();
    add('ACTIVITY PER COMPLETED SERVICE');
    data.completed_services.forEach((j) => {
      add();
      add(j.job_number, j.customer, j.vehicle, j.plate_number);
      add('Problem', j.reported_problem || '');
      add('Diagnosis', j.diagnosis || '');
      add('Work performed', j.work_performed || '');
      add('Notes', j.completion_notes || '');
      add('Services', 'Qty', 'Unit', 'Amount');
      j.services.forEach((s) => add(s.service, s.quantity, s.unit_price, s.amount));
      add('Parts', 'Qty', 'Unit', 'Amount');
      j.parts.forEach((p) => add(p.part, p.quantity, p.unit_price, p.amount));
      if (j.invoice) {
        add('Invoice', j.invoice.invoice_number, j.invoice.status, j.invoice.total, j.invoice.paid);
      }
    });

    const csv = rows.map((r) => r.map(csvCell).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `uptown-garage-business-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (loading && !data) {
    return (
      <div className="page rpt mgr-report">
        <div className="rpt-loading">Preparing your report...</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="page rpt mgr-report">
        <div className="rpt-alert">{error}</div>
        <button className="rpt-btn rpt-btn-primary" onClick={() => load('', '')}>Try again</button>
      </div>
    );
  }

  if (!data) return null;

  const { cash, analysis, top_sold: topSold, completed_services: completed } = data;
  const periodText = `${data.range.from || 'Beginning'} - ${data.range.to || 'Today'}`;

  const term = search.trim().toLowerCase();
  const visibleJobs = term
    ? completed.filter((j) => [j.job_number, j.customer, j.plate_number, j.vehicle, j.mechanic]
      .join(' ').toLowerCase().includes(term))
    : completed;

  const kpis = [
    {
      tone: 'green',
      label: 'Total cash received',
      value: mk(cash.received),
      sub: `${num(cash.payments)} payment${Number(cash.payments) === 1 ? '' : 's'} in period`,
    },
    {
      tone: 'blue',
      label: 'Completed services',
      value: num(analysis.completed_jobs),
      sub: `${mk(analysis.completed_value)} of work completed`,
    },
    {
      tone: 'violet',
      label: 'Average job value',
      value: mk(analysis.average_job_value),
      sub: `${pct(analysis.labour_share)} labour, ${pct(analysis.parts_share)} parts`,
    },
    {
      tone: 'red',
      label: 'Outstanding today',
      value: mk(cash.outstanding),
      sub: `${num(cash.outstanding_count)} invoice${Number(cash.outstanding_count) === 1 ? '' : 's'} to collect`,
    },
  ];

  const maxUnits = Math.max(1, ...topSold.map((p) => Number(p.units)));

  return (
    <div className="page rpt mgr-report">
      <div className="rpt-print-header">
        <strong>Uptown Garage</strong>
        <span>Business Report - {periodText}</span>
        <span>Generated {new Date(data.generated_at).toLocaleString()}</span>
      </div>

      <div className="rpt-hero">
        <div>
          <h1>Business Report</h1>
          <p className="mgr-subtitle">
            What the business did in this period: every completed service and its activity,
            the cash it made, and what sells most.
          </p>
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
        <p>Dates filter completed services, cash received and sales. Outstanding balances always show today.</p>
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

      {/* ---------------- CASH ---------------- */}
      <div className="rpt-grid">
        <Panel title="Cash by payment method" note={`${mk(cash.received)} received in this period`}>
          <div className="rpt-scroll">
            <table className="rpt-table">
              <thead>
                <tr><th>Method</th><th className="num">Payments</th><th className="num">Amount</th></tr>
              </thead>
              <tbody>
                {cash.by_method.length === 0 && <Empty cols={3} text="No payments in this period." />}
                {cash.by_method.map((m) => (
                  <tr key={m.method}>
                    <td className="rpt-strong">{m.method}</td>
                    <td className="num">{num(m.count)}</td>
                    <td className="num rpt-strong">{mk(m.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Where the money came from" note="Workshop jobs vs parts orders">
          <div className="rpt-scroll">
            <table className="rpt-table">
              <thead>
                <tr><th>Source</th><th className="num">Payments</th><th className="num">Amount</th></tr>
              </thead>
              <tbody>
                {cash.by_source.length === 0 && <Empty cols={3} text="No payments in this period." />}
                {cash.by_source.map((s) => (
                  <tr key={s.source}>
                    <td className="rpt-strong">{s.source}</td>
                    <td className="num">{num(s.count)}</td>
                    <td className="num rpt-strong">{mk(s.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* ---------------- MOST SOLD ---------------- */}
      <Panel
        title="Most sold products"
        note={`Ranked by units sold, highest first - ${num(data.sales_totals.units)} units, ${mk(data.sales_totals.revenue)} in paid sales`}
      >
        <div className="rpt-scroll">
          <table className="rpt-table">
            <thead>
              <tr>
                <th>Rank</th><th>Product</th><th>SKU</th><th>Category</th>
                <th className="num">Units sold</th><th className="rpt-share-col">Volume</th>
                <th className="num">Revenue</th><th className="num">Share</th>
              </tr>
            </thead>
            <tbody>
              {topSold.length === 0 && <Empty cols={8} text="No paid sales in this period." />}
              {topSold.map((p, i) => (
                <tr key={p.id}>
                  <td><span className={'rpt-rank rpt-rank-' + (i < 3 ? i + 1 : 'n')}>{i + 1}</span></td>
                  <td className="rpt-strong">{p.name}</td>
                  <td className="rpt-muted">{p.sku}</td>
                  <td>{p.category || '-'}</td>
                  <td className="num rpt-strong">{num(p.units)}</td>
                  <td className="rpt-share-col">
                    <div className="rpt-bar"><span style={{ width: `${(Number(p.units) / maxUnits) * 100}%` }} /></div>
                  </td>
                  <td className="num rpt-strong">{mk(p.revenue)}</td>
                  <td className="num rpt-muted">{pct(p.share)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* ---------------- BUSINESS ANALYSIS ---------------- */}
      <div className="rpt-grid">
        <Panel title="Revenue mix" note="How completed work splits between labour and parts">
          <div className="mgr-mix">
            <div className="mgr-mix-row">
              <span>Labour (services + extra)</span>
              <strong>{mk(analysis.labour_revenue)}</strong>
              <div className="rpt-bar"><span style={{ width: `${analysis.labour_share}%` }} /></div>
              <small>{pct(analysis.labour_share)} of completed value</small>
            </div>
            <div className="mgr-mix-row">
              <span>Parts</span>
              <strong>{mk(analysis.parts_revenue)}</strong>
              <div className="rpt-bar"><span style={{ width: `${analysis.parts_share}%` }} /></div>
              <small>{pct(analysis.parts_share)} of completed value</small>
            </div>
            <div className="mgr-mix-row">
              <span>Collection rate</span>
              <strong>{pct(analysis.collection_rate)}</strong>
              <div className="rpt-bar"><span style={{ width: `${Math.min(100, analysis.collection_rate)}%` }} /></div>
              <small>{mk(cash.received)} received of {mk(cash.raised)} invoiced</small>
            </div>
            <div className="mgr-mix-row">
              <span>Customers served</span>
              <strong>{num(analysis.unique_customers)}</strong>
              <small>{num(analysis.repeat_customers)} came back more than once</small>
            </div>
          </div>
        </Panel>

        <Panel title="Mechanic productivity" note="Completed jobs per mechanic in this period">
          <div className="rpt-scroll">
            <table className="rpt-table">
              <thead>
                <tr><th>Mechanic</th><th className="num">Jobs</th><th className="num">Value</th><th className="num">Collected</th></tr>
              </thead>
              <tbody>
                {analysis.mechanics.length === 0 && <Empty cols={4} text="No completed jobs in this period." />}
                {analysis.mechanics.map((m) => (
                  <tr key={m.mechanic}>
                    <td className="rpt-strong">{m.mechanic}</td>
                    <td className="num">{num(m.jobs)}</td>
                    <td className="num">{mk(m.value)}</td>
                    <td className="num rpt-strong">{mk(m.paid)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Most requested services" note="Services charged on completed jobs">
          <div className="rpt-scroll">
            <table className="rpt-table">
              <thead>
                <tr><th>Service</th><th className="num">Times</th><th className="num">Revenue</th></tr>
              </thead>
              <tbody>
                {analysis.services.length === 0 && <Empty cols={3} text="No services recorded in this period." />}
                {analysis.services.map((s) => (
                  <tr key={s.service}>
                    <td className="rpt-strong">{s.service}</td>
                    <td className="num">{num(s.times)}</td>
                    <td className="num rpt-strong">{mk(s.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* ---------------- COMPLETED SERVICES ---------------- */}
      <Panel
        title="Completed services and their activity"
        note={`${num(visibleJobs.length)} of ${num(completed.length)} completed jobs - click a job to see everything that happened on it`}
      >
        <div className="mgr-job-search no-print">
          <input
            type="search"
            placeholder="Search job number, customer, plate or mechanic"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="mgr-jobs">
          {visibleJobs.length === 0 && (
            <p className="mgr-jobs-empty">
              {completed.length === 0
                ? 'No services were completed in this period.'
                : 'No completed job matches your search.'}
            </p>
          )}
          {visibleJobs.map((job) => (
            <ServiceCard key={job.id} job={job} />
          ))}
        </div>
      </Panel>
    </div>
  );
}
