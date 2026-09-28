import { useEffect, useState } from 'react';
import api from '../../../api/api';
import { useAuth } from '../../../context/AuthContext';
import './Users.css';

export default function Users() {
  const { user } = useAuth();
  const isManager = user?.role === 'manager';

  const [staff, setStaff] = useState([]);
  const [staffSearch, setStaffSearch] = useState('');

  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', role: 'mechanic', specialty: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function loadStaff() {
    api.get('/users/staff', { params: staffSearch ? { search: staffSearch } : {} }).then((r) => setStaff(r.data.data));
  }

  function loadCustomers() {
    if (!isManager) return;
    api.get('/users/customers', { params: customerSearch ? { search: customerSearch } : {} }).then((r) => setCustomers(r.data.data));
  }

  useEffect(() => {
    const t = setTimeout(loadStaff, 250);
    return () => clearTimeout(t);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffSearch]);

  useEffect(() => {
    const t = setTimeout(loadCustomers, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerSearch, isManager]);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.post('/auth/add-staff', form);
      setShowModal(false);
      setForm({ name: '', email: '', phone: '', password: '', role: 'mechanic', specialty: '' });
      loadStaff();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create account.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u, reload) {
    const deactivating = u.is_active;
    const message = deactivating

      ? `Deactivate ${u.name}? They will no longer be able to log in.`
      : `Reactivate ${u.name}'s account?`;
    if (!window.confirm(message)) return;
    setError('');
    try {
      await api.post(`/users/${u.id}/toggle-active`);
      reload();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update account status.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  const roleOptions = isManager ? ['mechanic', 'admin', 'manager'] : ['mechanic'];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Staff & Mechanics</h1>
          <p>Add new company users and manage mechanic accounts.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add User</button>
      </div>

      {error && !showModal && <div className="alert alert-error">{error}</div>}

      <div className="filter-bar">
        <input
          className="filter-search"
          type="text"
          placeholder="Search staff by name, email or role..."

          value={staffSearch}
          onChange={(e) => setStaffSearch(e.target.value)}
        />
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Specialty</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {staff.length === 0 && <tr><td colSpan={6} className="empty-state">No staff accounts found.</td></tr>}
            {staff.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.email}</td>
                <td style={{ textTransform: 'capitalize' }}>{s.role}</td>
                <td>{s.specialty || '-'}</td>
                <td>
                  <span className={`badge ${s.is_active ? 'badge-success' : 'badge-danger'}`}>
                    {s.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="action-cell">
                  <button
                    className="btn btn-outline btn-sm"
                    disabled={s.id === user?.id}
                    onClick={() => toggleActive(s, loadStaff)}
                  >
                    {s.is_active ? 'Deactivate' : 'Reactivate'}
                  </button>
                </td>

              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isManager && (
        <div style={{ marginTop: 36 }}>
          <div className="page-header">
            <div>
              <h1 style={{ fontSize: '1.2rem' }}>Customers</h1>
              <p>Deactivate or reactivate customer accounts.</p>
            </div>
          </div>

          <div className="filter-bar">
            <input
              className="filter-search"
              type="text"
              placeholder="Search customers by name or email..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
            />
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Name</th><th>Email</th><th>Phone</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {customers.length === 0 && <tr><td colSpan={5} className="empty-state">No customers found.</td></tr>}

                {customers.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.email}</td>
                    <td>{c.phone || '-'}</td>
                    <td>
                      <span className={`badge ${c.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="action-cell">
                      <button className="btn btn-outline btn-sm" onClick={() => toggleActive(c, loadCustomers)}>
                        {c.is_active ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add a new user</h2>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Full name</label>
                <input value={form.name} onChange={(e) => update('name', e.target.value)} required />

              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input value={form.phone} onChange={(e) => update('phone', e.target.value)} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Role</label>
                  <select value={form.role} onChange={(e) => update('role', e.target.value)}>
                    {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Specialty (mechanics)</label>
                  <input value={form.specialty} onChange={(e) => update('specialty', e.target.value)} placeholder="e.g. Engine, Electrical" />
                </div>
              </div>
              <div className="form-group">
                <label>Temporary password</label>
                <input type="password" minLength={6} value={form.password} onChange={(e) => update('password', e.target.value)} required />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create Account'}</button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
}