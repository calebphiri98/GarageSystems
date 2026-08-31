import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../../api/api';
import './Dashboard.css';

export default function ManagerDashboard() {
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
    { label: 'Total customers', value: stats.total_customers },
    { label: 'Active mechanics', value: stats.total_mechanics },
    { label: 'Total revenue collected (MK)', value: Number(stats.total_revenue_paid).toLocaleString() },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Manager Overview</h1>
          <p>Full-business visibility across operations, staff and finances.</p>
        </div>
        <Link to="/manager/approvals" className="btn btn-primary">Review Approvals</Link>
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
