import { useEffect, useState } from 'react';
import api from '../../../api/api';
import './Dashboard.css';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/reports/summary').then((r) => setStats(r.data.data));
  }, []);

  if (!stats) return <div className="page">Loading…</div>;

  const cards = [
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
