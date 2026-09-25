import { useEffect, useState } from 'react';
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

export default function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [selected, setSelected] = useState(null);

  function load() {
    api.get('/jobs').then((r) => setJobs(r.data.data));
  }

  useEffect(load, []);

  async function openJob(id) {
    const res = await api.get(`/jobs/${id}`);
    setSelected(res.data.data);
  }

  async function decide(approvalId, decision) {
    await api.put(`/approvals/${approvalId}/decide`, { decision });
    const res = await api.get(`/jobs/${selected.id}`);
    setSelected(res.data.data);
    load();
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Service Status</h1>
          <p>Track progress on your vehicle's repair jobs.</p>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Job #</th><th>Vehicle</th><th>Mechanic</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {jobs.length === 0 && <tr><td colSpan={5} className="empty-state">No service jobs yet.</td></tr>}
            {jobs.map((j) => (
              <tr key={j.id}>
                <td>{j.job_number}</td>
                <td>{j.make} {j.model} ({j.plate_number})</td>
                <td>{j.mechanic_name || 'Not yet assigned'}</td>
                <td><span className={`badge ${STATUS_BADGE[j.status] || 'badge-neutral'}`}>{j.status}</span></td>
                <td><button className="btn btn-outline btn-sm" onClick={() => openJob(j.id)}>View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal job-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Job {selected.job_number}</h2>
            <p className="job-detail-line"><strong>Vehicle:</strong> {selected.make} {selected.model} ({selected.plate_number})</p>
            <p className="job-detail-line"><strong>Status:</strong> <span className={`badge ${STATUS_BADGE[selected.status] || 'badge-neutral'}`}>{selected.status}</span></p>
            <p className="job-detail-line"><strong>Reported problem:</strong> {selected.reported_problem}</p>
            {selected.diagnosis && <p className="job-detail-line"><strong>Diagnosis:</strong> {selected.diagnosis}</p>}
            {selected.work_performed && <p className="job-detail-line"><strong>Work performed:</strong> {selected.work_performed}</p>}

            {selected.approvals && selected.approvals.filter((a) => a.status === 'Pending').length > 0 && (
              <div className="approval-box">
                <h3>Approval needed</h3>
                {selected.approvals.filter((a) => a.status === 'Pending').map((a) => (
                  <div key={a.id} className="approval-item">
                    <p>{a.description}</p>
                    <p className="approval-cost">Estimated cost: MK {Number(a.estimated_cost).toLocaleString()}</p>
                    <div className="modal-actions">
                      <button className="btn btn-danger btn-sm" onClick={() => decide(a.id, 'Rejected')}>Reject</button>
                      <button className="btn btn-success btn-sm" onClick={() => decide(a.id, 'Approved')}>Approve</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
