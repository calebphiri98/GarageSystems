import { useEffect, useState } from 'react';
import api from '../../../api/api';

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  function loadLogs() {
    const params = from && to ? { from, to } : {};
    api
      .get('/reports/audit-log', { params })
      .then((r) => setLogs(r.data.data))
      .catch((err) => setError(err.response?.data?.message || 'Could not load the audit log.'));
  }

  useEffect(() => {
    if ((from && !to) || (!from && to)) return;
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  async function clearLogs() {
    setError('');
    setMessage('');

    if (!from || !to) {
      setError('Choose both a from date and a to date before clearing logs.');
      return;

    }
    if (from > to) {
      setError('The from date cannot be after the to date.');
      return;
    }

    setBusy(true);
    try {
      const res = await api.get('/reports/audit-log-count', { params: { from, to } });
      const count = res.data.data.count;

      if (count === 0) {
        setMessage('There are no log entries between those dates.');
        return;
      }

      const ok = window.confirm(
        `Permanently delete ${count} audit log entries from ${from} to ${to}? This cannot be undone.`
      );
      if (!ok) return;

      const del = await api.delete('/reports/audit-log', { params: { from, to } });
      setMessage(del.data.message);
      loadLogs();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not clear the logs.');
    } finally {
      setBusy(false);
    }
  }

  function resetFilter() {

    setFrom('');
    setTo('');
    setError('');
    setMessage('');
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Audit Log</h1>
          <p>View system activity and clear log entries between two dates.</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <div className="filter-bar" style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button className="btn btn-outline" onClick={resetFilter}>Reset</button>
        <button className="btn btn-danger" onClick={clearLogs} disabled={busy}>
          {busy ? 'Checking...' : 'Clear Logs'}
        </button>
      </div>


      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Date</th><th>User</th><th>Role</th><th>Action</th><th>Record</th></tr>
          </thead>
          <tbody>
            {logs.length === 0 && <tr><td colSpan={5} className="empty-state">No audit records found.</td></tr>}
            {logs.map((l) => (
              <tr key={l.id}>
                <td>{new Date(l.created_at).toLocaleString()}</td>
                <td>{l.user_name || 'System'}</td>
                <td style={{ textTransform: 'capitalize' }}>{l.role}</td>
                <td>{l.action}</td>
                <td>{l.affected_table ? `${l.affected_table} #${l.affected_id}` : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}