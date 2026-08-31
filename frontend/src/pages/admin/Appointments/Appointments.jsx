import { useEffect, useState } from 'react';
import api from '../../../api/api';
import './Appointments.css';

const STATUS_BADGE = {
  Pending: 'badge-warning',
  Confirmed: 'badge-info',
  Arrived: 'badge-success',
  Cancelled: 'badge-danger',
  'No-show': 'badge-danger',
};

export default function AdminAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [error, setError] = useState('');

  function load() {
    api.get('/appointments').then((r) => setAppointments(r.data.data));
  }

  useEffect(load, []);

  async function setStatus(id, status) {
    setError('');
    try {
      await api.put(`/appointments/${id}/status`, { status });
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Update failed.');
    }
  }

  async function convert(id) {
    setError('');
    try {
      await api.post(`/appointments/${id}/convert`);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not convert to job.');
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Appointments</h1>
          <p>Confirm, reschedule or cancel customer appointment requests.</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Customer</th><th>Vehicle</th><th>Service</th><th>Date</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {appointments.length === 0 && <tr><td colSpan={6} className="empty-state">No appointments.</td></tr>}
            {appointments.map((a) => (
              <tr key={a.id}>
                <td>{a.customer_name}</td>
                <td>{a.make} {a.model} ({a.plate_number})</td>
                <td>{a.service_type}</td>
                <td>{new Date(a.requested_date).toLocaleString()}</td>
                <td><span className={`badge ${STATUS_BADGE[a.status] || 'badge-neutral'}`}>{a.status}</span></td>
                <td className="action-cell">
                  {a.status === 'Pending' && (
                    <>
                      <button className="btn btn-success btn-sm" onClick={() => setStatus(a.id, 'Confirmed')}>Confirm</button>
                      <button className="btn btn-danger btn-sm" onClick={() => setStatus(a.id, 'Cancelled')}>Cancel</button>
                    </>
                  )}
                  {a.status === 'Confirmed' && (
                    <>
                      <button className="btn btn-outline btn-sm" onClick={() => setStatus(a.id, 'No-show')}>No-show</button>
                      <button className="btn btn-primary btn-sm" onClick={() => convert(a.id)}>Check In → Job</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
