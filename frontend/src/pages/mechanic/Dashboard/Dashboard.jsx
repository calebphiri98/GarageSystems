import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../../api/api';
import { useAuth } from '../../../context/AuthContext';
import './Dashboard.css';

const STATUS_BADGE = {
  'Vehicle Checked In': 'badge-neutral',
  Inspection: 'badge-info',
  'Awaiting Approval': 'badge-warning',
  Approved: 'badge-info',
  'In Progress': 'badge-info',
  'Waiting for Parts': 'badge-warning',
  Completed: 'badge-success',
  'Ready for Collection': 'badge-success',
  Collected: 'badge-neutral',
};

export default function MechanicDashboard() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    api.get('/jobs').then((r) => setJobs(r.data.data));
  }, []);

  const active = jobs.filter((j) => j.status !== 'Collected');
  const done = jobs.filter((j) => j.status === 'Collected');

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Hi {user?.name?.split(' ')[0]}, here's your work</h1>
          <p>Jobs the administrator has assigned to you.</p>
        </div>
      </div>

      <div className="grid grid-stats">
        <div className="stat-card">
          <div className="stat-value">{active.length}</div>
          <div className="stat-label">Active assignments</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{jobs.filter((j) => j.status === 'Completed').length}</div>
          <div className="stat-label">Awaiting verification</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{done.length}</div>
          <div className="stat-label">Completed all-time</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h2 className="section-title">My jobs</h2>
        {active.length === 0 ? (
          <div className="empty-state">No jobs assigned to you right now.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Job #</th><th>Vehicle</th><th>Reported Problem</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {active.map((j) => (
                  <tr key={j.id}>
                    <td>{j.job_number}</td>
                    <td>{j.make} {j.model} ({j.plate_number})</td>
                    <td>{j.reported_problem}</td>
                    <td><span className={`badge ${STATUS_BADGE[j.status] || 'badge-neutral'}`}>{j.status}</span></td>
                    <td><Link to={`/mechanic/jobs/${j.id}`} className="btn btn-outline btn-sm">Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
