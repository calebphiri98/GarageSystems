import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/api';
import '../Login/Login.css';
import './Register.css';

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await api.post('/auth/register', form);
      setSuccess('Account created! Redirecting to login…');
      setTimeout(() => navigate('/login'), 1200);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card register-card">
        <div className="auth-brand">
          <span className="auth-brand-badge">UG</span>
          <h1>Create your account</h1>
        </div>
        <p className="auth-subtitle">Register as a customer to book services and order parts.</p>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Full name</label>
            <input value={form.name} onChange={(e) => update('name', e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Email address</label>
            <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Phone number</label>
            <input value={form.phone} onChange={(e) => update('phone', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" minLength={6} value={form.password} onChange={(e) => update('password', e.target.value)} required />
          </div>
          <button className="btn btn-primary auth-submit" type="submit" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
