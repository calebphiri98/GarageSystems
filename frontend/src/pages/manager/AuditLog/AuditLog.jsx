import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../../api/api';
import './AuditLog.css';

const ROLES = ['all', 'admin', 'manager', 'mechanic', 'customer'];

function toneFor(role) {
  if (role === 'admin') return 'blue';
  if (role === 'manager') return 'violet';
  if (role === 'mechanic') return 'amber';
  if (role === 'customer') return 'green';
  return 'gray';
}

function dayKey(value) {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayLabel(key) {
  const today = dayKey(new Date());
  const yesterday = dayKey(new Date(Date.now() - 86400000));
  if (key === today) return 'Today';
  if (key === yesterday) return 'Yesterday';
  return new Date(key + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function timeOf(value) {
  return new Date(value).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export default function ManagerAuditLog() {
  const [logs, setLogs] = useState([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [role, setRole] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    const params = from && to ? { from, to } : {};
    api
      .get('/reports/audit-log', { params })
      .then((r) => setLogs(r.data.data || []))
      .catch((err) => setError(err.response?.data?.message || 'Could not load the activity log.'))
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(() => {
    if ((from && !to) || (!from && to)) return;
    load();
  }, [from, to, load]);

  const reset = () => {
    setFrom('');
    setTo('');
    setRole('all');
    setSearch('');
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((l) => {
      if (role !== 'all' && String(l.role || '').toLowerCase() !== role) return false;
      if (!q) return true;
      return [l.action, l.user_name, l.affected_table, l.affected_id]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [logs, role, search]);

  const groups = useMemo(() => {
    const map = new Map();
    filtered.forEach((l) => {
      const key = dayKey(l.created_at);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(l);
    });
    return [...map.entries()];
  }, [filtered]);

  const rangeIncomplete = (from && !to) || (!from && to);

  return (
    <div className="page mgr-log">
      <div className="page-header">
        <div>
          <h1>Activity Log</h1>
          <p>Read-only record of who did what in the system. Use it to trace a change or settle a dispute.</p>
        </div>
        <span className="badge badge-neutral">Read-only</span>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="mgr-log-toolbar">
        <div className="mgr-log-field">
          <label htmlFor="log-from">From</label>
          <input id="log-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="mgr-log-field">
          <label htmlFor="log-to">To</label>
          <input id="log-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="mgr-log-field">
          <label htmlFor="log-role">Role</label>
          <select id="log-role" value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>{r === 'all' ? 'All roles' : r.charAt(0).toUpperCase() + r.slice(1)}</option>
            ))}
          </select>
        </div>
        <div className="mgr-log-field mgr-log-search">
          <label htmlFor="log-search">Search</label>
          <input
            id="log-search"
            type="search"
            placeholder="Action, user or record"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="btn btn-outline" onClick={reset}>Reset</button>
      </div>

      {rangeIncomplete && (
        <div className="alert alert-info">Choose both a from date and a to date to filter by period.</div>
      )}

      <div className="mgr-log-summary">
        <span><strong>{filtered.length}</strong> entries shown</span>
        <span>Latest 200 records</span>
      </div>

      {loading && <div className="mgr-log-empty">Loading activity...</div>}

      {!loading && filtered.length === 0 && (
        <div className="mgr-log-empty">No activity matches these filters.</div>
      )}

      {!loading && groups.map(([key, items]) => (
        <section className="mgr-log-day" key={key}>
          <h2>{dayLabel(key)}</h2>
          <ol className="mgr-log-list">
            {items.map((l) => (
              <li className="mgr-log-item" key={l.id}>
                <span className="mgr-log-time">{timeOf(l.created_at)}</span>
                <span className={'mgr-log-role mgr-log-role-' + toneFor(l.role)}>{l.role || 'system'}</span>
                <div className="mgr-log-body">
                  <p className="mgr-log-action">{l.action}</p>
                  <p className="mgr-log-meta">
                    {l.user_name || 'System'}
                    {l.affected_table && (
                      <> &middot; {l.affected_table}{l.affected_id ? ` #${l.affected_id}` : ''}</>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
