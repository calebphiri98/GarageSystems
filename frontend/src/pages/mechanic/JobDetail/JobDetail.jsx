import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../../api/api';
import './JobDetail.css';

const STATUS_OPTIONS = ['Inspection', 'In Progress', 'Waiting for Parts', 'Completed'];

export default function MechanicJobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [parts, setParts] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [status, setStatus] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [workPerformed, setWorkPerformed] = useState('');
  const [completionNotes, setCompletionNotes] = useState('');

  const [approvalDesc, setApprovalDesc] = useState('');
  const [approvalCost, setApprovalCost] = useState('');

  const [selectedPart, setSelectedPart] = useState('');
  const [partQty, setPartQty] = useState('1');

  function load() {
    api.get(`/jobs/${id}`).then((r) => {
      const j = r.data.data;
      setJob(j);
      setStatus(j.status);
      setDiagnosis(j.diagnosis || '');
      setWorkPerformed(j.work_performed || '');
      setCompletionNotes(j.completion_notes || '');
    });
    api.get('/inventory').then((r) => setParts(r.data.data));
  }

  useEffect(load, [id]);

  async function saveUpdate(e) {
    e.preventDefault();
    setError(''); setMessage('');
    try {
      await api.put(`/jobs/${id}/mechanic-update`, {
        status, diagnosis, work_performed: workPerformed, completion_notes: completionNotes,
      });
      setMessage('Job updated.');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update job.');
    }
  }

  async function submitApproval(e) {
    e.preventDefault();
    setError(''); setMessage('');
    try {
      await api.post(`/jobs/${id}/request-approval`, { description: approvalDesc, estimated_cost: Number(approvalCost) || 0 });
      setMessage('Approval request sent to customer.');
      setApprovalDesc(''); setApprovalCost('');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not request approval.');
    }
  }

  async function recordPart(e) {
    e.preventDefault();
    setError(''); setMessage('');
    try {
      await api.post(`/jobs/${id}/use-part`, { part_id: selectedPart, quantity: Number(partQty) });
      setMessage('Part usage recorded.');
      setSelectedPart(''); setPartQty('1');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not record part usage.');
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
        <button className="btn btn-outline" onClick={() => navigate('/mechanic')}>← Back to my jobs</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <div className="job-detail-grid">
        <div className="card">
          <h2 className="section-title">Update job status</h2>
          <p className="hint-text">Reported problem: {job.reported_problem}</p>
          <form onSubmit={saveUpdate}>
            <div className="form-group">
              <label>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Diagnosis</label>
              <textarea rows={2} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Work performed</label>
              <textarea rows={2} value={workPerformed} onChange={(e) => setWorkPerformed(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Completion notes</label>
              <textarea rows={2} value={completionNotes} onChange={(e) => setCompletionNotes(e.target.value)} placeholder="Required before marking Completed" />
            </div>
            <button type="submit" className="btn btn-primary">Save Update</button>
          </form>
        </div>

        <div className="job-side-column">
          <div className="card">
            <h2 className="section-title">Request customer approval</h2>
            <p className="hint-text">If you find extra work beyond the original request, log it here.</p>
            <form onSubmit={submitApproval}>
              <div className="form-group">
                <label>Description</label>
                <textarea rows={2} value={approvalDesc} onChange={(e) => setApprovalDesc(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Estimated cost (MK)</label>
                <input type="number" value={approvalCost} onChange={(e) => setApprovalCost(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-outline">Send Approval Request</button>
            </form>

            {job.approvals?.length > 0 && (
              <ul className="approval-list">
                {job.approvals.map((a) => (
                  <li key={a.id}>
                    <span className={`badge ${a.status === 'Approved' ? 'badge-success' : a.status === 'Rejected' ? 'badge-danger' : 'badge-warning'}`}>{a.status}</span>
                    {' '}{a.description}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <h2 className="section-title">Record parts used</h2>
            <form onSubmit={recordPart}>
              <div className="form-group">
                <label>Part</label>
                <select value={selectedPart} onChange={(e) => setSelectedPart(e.target.value)} required>
                  <option value="">Select a part</option>
                  {parts.map((p) => (
                    <option key={p.id} value={p.id} disabled={p.quantity === 0}>
                      {p.name} ({p.quantity} in stock)
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Quantity</label>
                <input type="number" min="1" value={partQty} onChange={(e) => setPartQty(e.target.value)} required />
              </div>
              <button type="submit" className="btn btn-outline">Record Part Usage</button>
            </form>

            {job.parts_used?.length > 0 && (
              <ul className="approval-list">
                {job.parts_used.map((p) => (
                  <li key={p.id}>{p.part_name} × {p.quantity}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
