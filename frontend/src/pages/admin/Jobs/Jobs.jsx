import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../../api/api';
import './Jobs.css';

const emptyForm = {
  vehicle_id: '',
  customer_id: '',
  make: '',
  model: '',
  year: '',
  plate_number: '',
  vin: '',
  reported_problem: ''
};

const openStatuses = ['Vehicle Checked In', 'Inspection', 'Awaiting Approval', 'Approved', 'In Progress', 'Waiting for Parts'];

function todayKey(value) {
  return String(value || '').slice(0, 10);
}

export default function AdminJobs() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [newVehicle, setNewVehicle] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  async function load() {
    try {
      const [jobsResult, vehiclesResult, customersResult] = await Promise.all([
        api.get('/jobs'),
        api.get('/vehicles'),
        api.get('/users/customers')
      ]);
      setJobs(Array.isArray(jobsResult.data.data) ? jobsResult.data.data : []);
      setVehicles(Array.isArray(vehiclesResult.data.data) ? vehiclesResult.data.data : []);
      setCustomers(Array.isArray(customersResult.data.data) ? customersResult.data.data : []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load garage records.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const today = new Date();
  const todayString = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0')
  ].join('-');

  const arrivalsToday = jobs.filter(j => todayKey(j.opened_at) === todayString);
  const uniqueVehiclesToday = new Set(arrivalsToday.map(j => j.vehicle_id)).size;
  const activeJobs = jobs.filter(j => openStatuses.includes(j.status)).length;
  const completedJobs = jobs.filter(j => ['Completed', 'Ready for Collection'].includes(j.status)).length;

  const filteredJobs = jobs.filter(j => {
    const text = [j.job_number, j.customer_name, j.plate_number, j.make, j.model, j.mechanic_name].join(' ').toLowerCase();
    const matchesSearch = text.includes(search.toLowerCase());
    const matchesFilter = filter === 'all' ||
      (filter === 'today' && todayKey(j.opened_at) === todayString) ||
      (filter === 'active' && openStatuses.includes(j.status)) ||
      (filter === 'completed' && ['Completed', 'Ready for Collection', 'Collected'].includes(j.status));
    return matchesSearch && matchesFilter;
  });

  function resetModal() {
    setShowModal(false);
    setNewVehicle(false);
    setModalError('');
    setForm(emptyForm);
  }

  function update(field, value) {
    setForm(previous => ({ ...previous, [field]: value }));
  }

  async function createJob(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setModalError('');

    try {
      let vehicleId = form.vehicle_id;

      if (newVehicle) {
        if (!form.customer_id) {
          throw new Error('Select the customer who owns this vehicle.');
        }

        const registered = await api.post('/vehicles', {
          customer_id: Number(form.customer_id),
          make: form.make.trim(),
          model: form.model.trim(),
          plate_number: form.plate_number.trim().toUpperCase(),
          year: form.year ? Number(form.year) : null,
          vin: form.vin.trim()
        });

        vehicleId = registered.data.data?.id;
        if (!vehicleId) throw new Error('Vehicle registration did not return an ID.');
      }

      if (!vehicleId) throw new Error('Select or register a vehicle.');

      const result = await api.post('/jobs', {
        vehicle_id: Number(vehicleId),
        reported_problem: form.reported_problem.trim()
      });

      const jobId = result.data.data?.id;
      resetModal();
      await load();

      if (jobId) navigate(`/admin/jobs/${jobId}`);
    } catch (err) {
      setModalError(err.response?.data?.message || err.message || 'Could not create the job.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page garage-operations">
      <div className="page-header">
        <div>
          <h1>Garage Operations</h1>
          <p>Record vehicle arrivals, create job cards, and manage workshop activity.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Receive Vehicle
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="garage-metrics">
        <div className="card garage-metric">
          <span>Vehicle visits today</span>
          <strong>{arrivalsToday.length}</strong>
        </div>
        <div className="card garage-metric">
          <span>Different vehicles today</span>
          <strong>{uniqueVehiclesToday}</strong>
        </div>
        <div className="card garage-metric">
          <span>Active jobs</span>
          <strong>{activeJobs}</strong>
        </div>
        <div className="card garage-metric">
          <span>Completed or ready</span>
          <strong>{completedJobs}</strong>
        </div>
      </div>

      <div className="garage-toolbar">
        <input
          type="search"
          aria-label="Search jobs"
          placeholder="Search by plate, customer or job number"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select aria-label="Filter jobs" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">All jobs</option>
          <option value="today">Received today</option>
          <option value="active">Active jobs</option>
          <option value="completed">Completed jobs</option>
        </select>
        <button className="btn btn-outline" onClick={load}>Refresh</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Job number</th>
              <th>Customer</th>
              <th>Vehicle</th>
              <th>Received</th>
              <th>Mechanic</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7}>Loading garage records...</td></tr>
            )}
            {!loading && filteredJobs.length === 0 && (
              <tr><td colSpan={7} className="empty-state">No matching jobs found.</td></tr>
            )}
            {filteredJobs.map(job => (
              <tr key={job.id}>
                <td><strong>{job.job_number}</strong></td>
                <td>{job.customer_name}</td>
                <td>{job.make} {job.model} ({job.plate_number})</td>
                <td>{job.opened_at ? new Date(String(job.opened_at).replace(' ', 'T')).toLocaleString() : '—'}</td>
                <td>{job.mechanic_name || 'Unassigned'}</td>
                <td><span className="badge badge-info">{job.status}</span></td>
                <td><Link to={`/admin/jobs/${job.id}`} className="btn btn-outline btn-sm">Manage</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={resetModal}>
          <div className="modal garage-arrival-modal" onClick={e => e.stopPropagation()}>
            <h2>Receive a vehicle</h2>
            <p>Register the arrival and create a job card for the workshop.</p>

            {modalError && <div className="alert alert-error">{modalError}</div>}

            <form onSubmit={createJob}>
              <div className="garage-choice">
                <label>
                  <input type="radio" checked={!newVehicle} onChange={() => setNewVehicle(false)} />
                  Existing vehicle
                </label>
                <label>
                  <input type="radio" checked={newVehicle} onChange={() => setNewVehicle(true)} />
                  Register new vehicle
                </label>
              </div>

              {newVehicle ? (
                <>
                  <div className="form-group">
                    <label>Vehicle owner</label>
                    <select required value={form.customer_id} onChange={e => update('customer_id', e.target.value)}>
                      <option value="">Select customer</option>
                      {customers.map(customer => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name} {customer.email ? `(${customer.email})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="garage-form-grid">
                    <div className="form-group">
                      <label>Make</label>
                      <input required value={form.make} onChange={e => update('make', e.target.value)} placeholder="Toyota" />
                    </div>
                    <div className="form-group">
                      <label>Model</label>
                      <input required value={form.model} onChange={e => update('model', e.target.value)} placeholder="Corolla" />
                    </div>
                    <div className="form-group">
                      <label>Registration number</label>
                      <input required value={form.plate_number} onChange={e => update('plate_number', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>Year</label>
                      <input type="number" min="1886" max={new Date().getFullYear() + 1} value={form.year} onChange={e => update('year', e.target.value)} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>VIN (optional)</label>
                    <input value={form.vin} onChange={e => update('vin', e.target.value)} />
                  </div>
                </>
              ) : (
                <div className="form-group">
                  <label>Registered vehicle</label>
                  <select required value={form.vehicle_id} onChange={e => update('vehicle_id', e.target.value)}>
                    <option value="">Select vehicle</option>
                    {vehicles.map(vehicle => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.plate_number} — {vehicle.make} {vehicle.model} — {vehicle.customer_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label>Reported problem or requested service</label>
                <textarea
                  rows={4}
                  required
                  value={form.reported_problem}
                  onChange={e => update('reported_problem', e.target.value)}
                  placeholder="Describe what the customer needs..."
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-outline" disabled={saving} onClick={resetModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Receive & Create Job'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}