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
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [labourCharge, setLabourCharge] = useState('');
  const [discount, setDiscount] = useState('0');

  function load() {
    api.get(`/jobs/${id}`).then((r) => setJob(r.data.data));
    api.get('/users/mechanics').then((r) => setMechanics(r.data.data));
  }

  useEffect(load, [id]);

  async function assign() {
    setError(''); setMessage('');
    if (!selectedMechanic) return;
    try {
      await api.post(`/jobs/${id}/assign`, { mechanic_id: selectedMechanic });
      setMessage('Mechanic assigned.');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not assign mechanic.');
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
          <h2 className="section-title">Allocate duty</h2>
          <p className="muted-text">Assign or reassign the mechanic responsible for this job.</p>
          <div className="form-group">
            <label>Mechanic</label>
            <select value={selectedMechanic} onChange={(e) => setSelectedMechanic(e.target.value)}>
              <option value="">{job.mechanic_name ? `Currently: ${job.mechanic_name}` : 'Select a mechanic'}</option>
              {mechanics.map((m) => (
                <option key={m.id} value={m.id}>{m.name}{m.specialty ? ` (${m.specialty})` : ''}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" onClick={assign}>Assign Mechanic</button>

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
