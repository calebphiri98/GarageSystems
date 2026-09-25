import { useEffect, useState } from 'react';
import api from '../../../api/api';
import { useAuth } from '../../../context/AuthContext';
import './Dashboard.css';

export default function CustomerDashboard() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [appointments, setAppointments] = useState([]);

  useEffect(() => {
    api.get('/vehicles').then((r) => setVehicles(r.data.data));
    api.get('/jobs').then((r) => setJobs(r.data.data));
    api.get('/appointments').then((r) => setAppointments(r.data.data));
  }, []);

  const activeJobs = jobs.filter((j) => j.status !== 'Collected');

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Welcome back, {user?.name?.split(' ')[0]}</h1>
          <p>Here's a quick look at your vehicles and services.</p>
        </div>
      </div>

      <div className="grid grid-stats">
        <div className="stat-card">
          <div className="stat-value">{vehicles.length}</div>
          <div className="stat-label">Registered vehicles</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{activeJobs.length}</div>
          <div className="stat-label">Active service jobs</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{appointments.filter((a) => a.status === 'Pending').length}</div>
          <div className="stat-label">Pending appointments</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h2 className="section-title">Recent jobs</h2>
        {activeJobs.length === 0 ? (
          <div className="empty-state">No active service jobs right now.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Job #</th><th>Vehicle</th><th>Status</th><th>Mechanic</th></tr>
              </thead>
              <tbody>
                {activeJobs.map((j) => (
                  <tr key={j.id}>
                    <td>{j.job_number}</td>
                    <td>{j.make} {j.model} ({j.plate_number})</td>
                    <td><span className="badge badge-info">{j.status}</span></td>
                    <td>{j.mechanic_name || 'Not yet assigned'}</td>
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
