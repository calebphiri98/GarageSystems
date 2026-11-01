import { useEffect, useState } from 'react';
import api from '../../../api/api';
import './Vehicles.css';

const emptyForm = {
  make: '',
  model: '',
  year: '',
  plate_number: '',
  vin: ''
};

export default function Vehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const res = await api.get('/vehicles');
      setVehicles(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load vehicles.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setError('');
    setShowModal(true);
  }

  function openEdit(vehicle) {
    setEditingId(vehicle.id);
    setForm({
      make: vehicle.make || '',
      model: vehicle.model || '',
      year: vehicle.year ?? '',
      plate_number: vehicle.plate_number || '',
      vin: vehicle.vin || ''
    });
    setError('');
    setShowModal(true);
  }

  function closeModal() {
    if (saving) return;
    setShowModal(false);
    setEditingId(null);
    setForm({ ...emptyForm });
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (saving) return;

    setError('');
    setMessage('');
    setSaving(true);

    try {
      const payload = {
        make: form.make.trim(),
        model: form.model.trim(),
        year: form.year === '' ? null : Number(form.year),
        plate_number: form.plate_number.trim().toUpperCase(),
        vin: form.vin.trim()
      };

      if (editingId !== null) {
        await api.put(`/vehicles/${editingId}`, payload);
        setMessage('Vehicle details updated successfully.');
      } else {
        await api.post('/vehicles', payload);
        setMessage('Vehicle registered successfully.');
      }

      setShowModal(false);
      setEditingId(null);
      setForm({ ...emptyForm });
      await load();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Could not save vehicle details.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>My Vehicles</h1>
          <p>Register and manage your vehicles.</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          + Add Vehicle
        </button>
      </div>

      {message && (
        <div className="alert alert-success">{message}</div>
      )}

      {!showModal && error && (
        <div className="alert alert-error">{error}</div>
      )}

      {loading ? (
        <div className="card">Loading vehicles...</div>
      ) : vehicles.length === 0 ? (
        <div className="card empty-state">
          You haven't registered any vehicles yet.
        </div>
      ) : (
        <div className="grid vehicle-grid">
          {vehicles.map((vehicle) => (
            <div key={vehicle.id} className="card vehicle-card">
              <div className="vehicle-plate">
                {vehicle.plate_number}
              </div>

              <div className="vehicle-name">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </div>

              {vehicle.vin && (
                <div className="vehicle-vin">
                  VIN: {vehicle.vin}
                </div>
              )}

              <div style={{ marginTop: '18px' }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => openEdit(vehicle)}
                >
                  Edit Vehicle
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>
              {editingId !== null
                ? 'Edit Vehicle Details'
                : 'Register a Vehicle'}
            </h2>

            {error && (
              <div className="alert alert-error">{error}</div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Make</label>
                  <input
                    value={form.make}
                    onChange={(e) => update('make', e.target.value)}
                    maxLength={100}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Model</label>
                  <input
                    value={form.model}
                    onChange={(e) => update('model', e.target.value)}
                    maxLength={100}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Year</label>
                  <input
                    type="number"
                    min="1886"
                    max={new Date().getFullYear() + 1}
                    value={form.year}
                    onChange={(e) => update('year', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Registration Number</label>
                  <input
                    value={form.plate_number}
                    onChange={(e) => update('plate_number', e.target.value)}
                    maxLength={30}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>VIN (optional)</label>
                <input
                  value={form.vin}
                  onChange={(e) => update('vin', e.target.value)}
                  maxLength={100}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving
                    ? 'Saving...'
                    : editingId !== null
                      ? 'Save Changes'
                      : 'Register Vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
