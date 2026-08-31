import { useEffect, useState } from 'react';
import api from '../../../api/api';
import './Vehicles.css';

export default function Vehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ make: '', model: '', year: '', plate_number: '', vin: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
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
      await api.post('/vehicles', form);
      setShowModal(false);
      setForm({ make: '', model: '', year: '', plate_number: '', vin: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not register vehicle.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>My Vehicles</h1>
          <p>Register a vehicle before requesting an appointment.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Vehicle</button>
      </div>

      {vehicles.length === 0 ? (
        <div className="card empty-state">You haven't registered any vehicles yet.</div>
      ) : (
        <div className="grid vehicle-grid">
          {vehicles.map((v) => (
            <div key={v.id} className="card vehicle-card">
              <div className="vehicle-plate">{v.plate_number}</div>
              <div className="vehicle-name">{v.year} {v.make} {v.model}</div>
              {v.vin && <div className="vehicle-vin">VIN: {v.vin}</div>}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Register a vehicle</h2>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Make</label>
                  <input value={form.make} onChange={(e) => update('make', e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Model</label>
                  <input value={form.model} onChange={(e) => update('model', e.target.value)} required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Year</label>
                  <input type="number" value={form.year} onChange={(e) => update('year', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Plate number</label>
                  <input value={form.plate_number} onChange={(e) => update('plate_number', e.target.value)} required />
                </div>
              </div>
              <div className="form-group">
                <label>VIN (optional)</label>
                <input value={form.vin} onChange={(e) => update('vin', e.target.value)} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Register Vehicle'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
