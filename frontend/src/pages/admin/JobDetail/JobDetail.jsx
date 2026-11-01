import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../../api/api';
import './JobDetail.css';

export default function AdminJobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [mechanics, setMechanics] = useState([]);
  const [selectedMechanic, setSelectedMechanic] = useState('');
  const [scheduledStart, setScheduledStart] = useState('');
  const [durationHours, setDurationHours] = useState('2');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [labourCharge, setLabourCharge] = useState('');
  const [discount, setDiscount] = useState('0');
  const [inventory, setInventory] = useState([]);
  const [partId, setPartId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [recordingPart, setRecordingPart] = useState(false);

  function load() {
    api.get(`/jobs/${id}`).then((r) => setJob(r.data.data));
    api.get('/users/mechanics').then((r) => setMechanics(r.data.data)).catch(() => setError('Could not load mechanics.'));
    api.get('/inventory').then((r) => setInventory(r.data.data)).catch(() => setError('Could not load inventory.'));
  }

  useEffect(load, [id]);

  async function assign() {
    setError(''); setMessage('');
    if (!selectedMechanic) return;
    try {
      const payload = { mechanic_id: selectedMechanic, duration_hours: Number(durationHours) || 2 };
      if (scheduledStart) payload.scheduled_start = scheduledStart;
      const res = await api.post(`/jobs/${id}/assign`, payload);
      setMessage(res.data.message || 'Mechanic assigned.');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not assign mechanic.');
    }
  }

  async function recordPart(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    const qty = Number(quantity);

    if (!partId || !Number.isInteger(qty) || qty < 1) {
      setError('Select a part and enter a valid quantity.');
      return;
    }

    setRecordingPart(true);
    try {
      await api.post(`/jobs/${id}/use-part`, {
        part_id: Number(partId),
        quantity: qty
      });
      setMessage('Part usage recorded and inventory updated.');
      setPartId('');
      setQuantity('1');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not record the part.');
    } finally {
      setRecordingPart(false);
    }
  }

  async function verify() {
    setError(''); setMessage('');
    try {
      await api.post(`/jobs/${id}/verify`);
      setMessage('Job verified. Ready for collection.');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not verify job.');
    }
  }

  async function generateInvoice() {
    setError(''); setMessage('');
    try {
      await api.post(`/invoices/from-job/${id}`, { labour_charge: Number(labourCharge) || 0, discount: Number(discount) || 0 });
      setMessage('Invoice generated. See Invoices & Payments.');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not generate invoice.');
    }
  }

  async function closeJob() {
    setError(''); setMessage('');
    try {
      await api.post(`/jobs/${id}/close`);
      setMessage('Vehicle marked as collected.');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not close job.');
    }
  }

  if (!job) return <div className="page">Loading…</div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Job {job.job_number}</h1>
          <p>{job.make} {job.model} ({job.plate_number}) — {job.customer_name}</p>
        </div>
        <button className="btn btn-outline" onClick={() => navigate('/admin/jobs')}>← Back to jobs</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <div className="job-detail-grid">
        <div className="card">
          <h2 className="section-title">Job information</h2>
          <p><strong>Status:</strong> <span className="badge badge-info">{job.status}</span></p>
          <p><strong>Reported problem:</strong> {job.reported_problem}</p>
          {job.diagnosis && <p><strong>Diagnosis:</strong> {job.diagnosis}</p>}
          {job.work_performed && <p><strong>Work performed:</strong> {job.work_performed}</p>}
          {job.completion_notes && <p><strong>Completion notes:</strong> {job.completion_notes}</p>}

          {job.parts_used?.length > 0 && (
            <>
              <h3 className="subsection-title">Parts used</h3>
              <ul className="parts-list">
                {job.parts_used.map((p) => (
                  <li key={p.id}>{p.part_name} × {p.quantity} — MK {(p.unit_price * p.quantity).toLocaleString()}</li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="card">
          <h2 className="section-title">Record resources used</h2>
          <p className="muted-text">Record each spare part and quantity consumed. Stock is deducted automatically.</p>
          {['Collected'].includes(job.status) ? (
            <p>This job is closed. No further resources can be recorded here.</p>
          ) : (
            <form onSubmit={recordPart} className="garage-parts-form">
              <div className="form-group">
                <label>Spare part</label>
                <select required value={partId} onChange={e => setPartId(e.target.value)}>
                  <option value="">Select spare part</option>
                  {inventory.map(p => (
                    <option key={p.id} value={p.id} disabled={Number(p.quantity) < 1}>
                      {p.name} — MK {Number(p.unit_price).toLocaleString()} — Stock: {p.quantity}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Quantity used</label>
                <input type="number" min="1" step="1" value={quantity} onChange={e => setQuantity(e.target.value)} required />
              </div>
              <button className="btn btn-primary" type="submit" disabled={recordingPart || !partId}>
                {recordingPart ? 'Recording...' : 'Record Part Usage'}
              </button>
            </form>
          )}
          <hr className="divider" />
          <h2 className="section-title">Allocate duty</h2>
          <p className="muted-text">Assign or reassign the mechanic responsible for this job. They'll be notified in-app and by email, and can't be double-booked against another active job in the same time window.</p>
          {job.mechanic_name && job.scheduled_start && (
            <p className="muted-text">
              <strong>Currently:</strong> {job.mechanic_name}, scheduled {new Date(job.scheduled_start).toLocaleString()} – {new Date(job.scheduled_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
          <div className="form-group">
            <label>Mechanic</label>
            <select value={selectedMechanic} onChange={(e) => setSelectedMechanic(e.target.value)}>
              <option value="">{job.mechanic_name ? `Currently: ${job.mechanic_name} (select to change)` : 'Select a mechanic'}</option>
              {mechanics.map((m) => (
                <option key={m.id} value={m.id}>{m.name}{m.specialty ? ` (${m.specialty})` : ''}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Start (leave blank for now)</label>
              <input type="datetime-local" value={scheduledStart} onChange={(e) => setScheduledStart(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Assumed duration (hours)</label>
              <input type="number" min={0.5} step={0.5} value={durationHours} onChange={(e) => setDurationHours(e.target.value)} />
            </div>
          </div>
          <button className="btn btn-primary" onClick={assign} disabled={!selectedMechanic}>
            {job.mechanic_name ? 'Change / Reassign Mechanic' : 'Assign Mechanic'}
          </button>

          <hr className="divider" />

          {job.status === 'Completed' && (
            <>
              <h2 className="section-title">Verify job</h2>
              <button className="btn btn-success" onClick={verify}>Verify & Mark Ready for Collection</button>
              <hr className="divider" />
            </>
          )}

          {job.status === 'Ready for Collection' && (
            <>
              <h2 className="section-title">Generate invoice</h2>
              <div className="form-group">
                <label>Labour charge (MK)</label>
                <input type="number" value={labourCharge} onChange={(e) => setLabourCharge(e.target.value)} placeholder="0" />
              </div>
              <div className="form-group">
                <label>Discount (MK)</label>
                <input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} />
              </div>
              <button className="btn btn-primary" onClick={generateInvoice}>Generate Invoice</button>
              <hr className="divider" />
              <h2 className="section-title">Vehicle collection</h2>
              <button className="btn btn-outline" onClick={closeJob}>Mark Collected & Close Job</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
