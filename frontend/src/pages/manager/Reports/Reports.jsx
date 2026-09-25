import { useEffect, useState } from 'react';
import api from '../../../api/api';
import './Reports.css';

export default function Reports() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    api.get('/reports/audit-log').then((r) => setLogs(r.data.data));
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Reports & Audit Log</h1>
          <p>Every sensitive action is recorded here — who did what, and when.</p>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Date</th><th>User</th><th>Role</th><th>Action</th><th>Record</th></tr>
          </thead>
          <tbody>
            {logs.length === 0 && <tr><td colSpan={5} className="empty-state">No audit records yet.</td></tr>}
            {logs.map((l) => (
              <tr key={l.id}>
                <td>{new Date(l.created_at).toLocaleString()}</td>
                <td>{l.user_name || 'System'}</td>
                <td style={{ textTransform: 'capitalize' }}>{l.role}</td>
                <td>{l.action}</td>
                <td>{l.affected_table ? `${l.affected_table} #${l.affected_id}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
