import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../../api/api';
import './Jobs.css';

const STATUS_BADGE = {
  Booked: 'badge-neutral',
  'Vehicle Checked In': 'badge-info',
  Inspection: 'badge-info',
  'Awaiting Approval': 'badge-warning',
  Approved: 'badge-info',
  'In Progress': 'badge-info',
  'Waiting for Parts': 'badge-warning',
  Completed: 'badge-success',
  'Ready for Collection': 'badge-success',
  Collected: 'badge-neutral',
};

export default function AdminJobs() {
  const [jobs, setJobs] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ vehicle_id: '', reported_problem: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    api.get('/jobs').then((r) => setJobs(r.data.data));
    api.get('/vehicles').then((r) => setVehicles(r.data.data));
  }

  useEffect(load, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.post('/jobs', form);
      setShowModal(false);
      setForm({ vehicle_id: '', reported_problem: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create job.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Job Cards</h1>
          <p>All service jobs. Assign mechanics and track progress.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Walk-in Job</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Job #</th><th>Customer</th><th>Vehicle</th><th>Mechanic</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {jobs.length === 0 && <tr><td colSpan={6} className="empty-state">No job cards yet.</td></tr>}
            {jobs.map((j) => (
              <tr key={j.id}>
                <td>{j.job_number}</td>
                <td>{j.customer_name}</td>
                <td>{j.make} {j.model} ({j.plate_number})</td>
                <td>{j.mechanic_name || <span className="badge badge-warning">Unassigned</span>}</td>
                <td><span className={`badge ${STATUS_BADGE[j.status] || 'badge-neutral'}`}>{j.status}</span></td>
                <td><Link className="btn btn-outline btn-sm" to={`/admin/jobs/${j.id}`}>Manage</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Create walk-in job</h2>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Vehicle</label>
                <select value={form.vehicle_id} onChange={(e) => setForm((f) => ({ ...f, vehicle_id: e.target.value }))} required>
                  <option value="">Select a vehicle</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>{v.make} {v.model} ({v.plate_number}) — {v.customer_name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Reported problem</label>
                <textarea rows={3} value={form.reported_problem} onChange={(e) => setForm((f) => ({ ...f, reported_problem: e.target.value }))} required />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating…' : 'Create Job'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
