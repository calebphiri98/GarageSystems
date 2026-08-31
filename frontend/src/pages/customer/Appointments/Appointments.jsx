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

export default function Appointments() {
  const [appointments, setAppointments] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ vehicle_id: '', service_type: '', requested_date: '', notes: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    api.get('/appointments').then((r) => setAppointments(r.data.data));
    api.get('/vehicles').then((r) => setVehicles(r.data.data));
  }

  useEffect(load, []);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.post('/appointments', form);
      setShowModal(false);
      setForm({ vehicle_id: '', service_type: '', requested_date: '', notes: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not request appointment.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Appointments</h1>
          <p>Request a service appointment and track its confirmation status.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)} disabled={vehicles.length === 0}>
          + Request Appointment
        </button>
      </div>

      {vehicles.length === 0 && (
        <div className="alert alert-error">You need to register a vehicle before requesting an appointment.</div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Vehicle</th><th>Service</th><th>Requested Date</th><th>Status</th></tr>
          </thead>
          <tbody>
            {appointments.length === 0 && (
              <tr><td colSpan={4} className="empty-state">No appointments yet.</td></tr>
            )}
            {appointments.map((a) => (
              <tr key={a.id}>
                <td>{a.make} {a.model} ({a.plate_number})</td>
                <td>{a.service_type}</td>
                <td>{new Date(a.requested_date).toLocaleString()}</td>
                <td><span className={`badge ${STATUS_BADGE[a.status] || 'badge-neutral'}`}>{a.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Request an appointment</h2>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Vehicle</label>
                <select value={form.vehicle_id} onChange={(e) => update('vehicle_id', e.target.value)} required>
                  <option value="">Select a vehicle</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>{v.make} {v.model} ({v.plate_number})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Service type</label>
                <input value={form.service_type} onChange={(e) => update('service_type', e.target.value)} placeholder="e.g. Oil change, Brake inspection" required />
              </div>
              <div className="form-group">
                <label>Preferred date & time</label>
                <input type="datetime-local" value={form.requested_date} onChange={(e) => update('requested_date', e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Notes (optional)</label>
                <textarea rows={3} value={form.notes} onChange={(e) => update('notes', e.target.value)} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Submitting…' : 'Submit Request'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
