import { useEffect, useState } from 'react';
import api from '../../../api/api';
import './Dashboard.css';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [arrivalJobs, setArrivalJobs] = useState([]);
  const [invoices, setInvoices] = useState([]);

  useEffect(() => {
    api.get('/reports/summary').then((r) => setStats(r.data.data));
    api.get('/jobs').then((r) => setArrivalJobs(Array.isArray(r.data.data) ? r.data.data : []));
    api.get('/invoices').then((r) => setInvoices(Array.isArray(r.data.data) ? r.data.data : [])).catch(() => setInvoices([]));
  }, []);

  if (!stats) return <div className="page">Loading…</div>;

  const now = new Date();
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('-');

  const arrivals = arrivalJobs.filter(j => String(j.opened_at || '').slice(0, 10) === today);

  const cards = [
    { label: 'Vehicle visits today', value: arrivals.length },
    { label: 'Total recorded payments (MK)', value: invoices.reduce((sum, inv) => sum + Number(inv.amount_paid || 0), 0).toLocaleString() },
    { label: 'Outstanding invoice balances (MK)', value: invoices.reduce((sum, inv) => sum + (inv.status === 'Cancelled' ? 0 : Number(inv.balance || 0)), 0).toLocaleString() },
    { label: 'Different vehicles today', value: new Set(arrivals.map(j => j.vehicle_id)).size },
    { label: 'Pending appointments', value: stats.pending_appointments },
    { label: 'Active jobs', value: stats.active_jobs },
    { label: 'Awaiting approval', value: stats.jobs_awaiting_approval },
    { label: 'Ready for collection', value: stats.ready_for_collection },
    { label: 'Pending parts orders', value: stats.pending_orders },
    { label: 'Low stock parts', value: stats.low_stock_parts },
    { label: 'Unpaid invoices', value: stats.unpaid_invoices },
    { label: 'Active mechanics', value: stats.total_mechanics },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Admin Dashboard</h1>
          <p>Overview of today's garage operations.</p>
        </div>
      </div>

      <div className="grid grid-stats">
        {cards.map((c) => (
          <div className="stat-card" key={c.label}>
            <div className="stat-value">{c.value}</div>
            <div className="stat-label">{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
