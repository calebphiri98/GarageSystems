import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/api';
import AuthLayout from '../../components/AuthLayout/AuthLayout';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (err) {
      if (!err.response) {
        setError('Could not reach the server. Check your connection and try again.');
      } else {
        setError(err.response?.data?.message || 'Could not send the reset email. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <Link to="/login" className="auth-back-home">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5" />
          <path d="M11 18l-6-6 6-6" />
        </svg>
        Back to login
      </Link>

      {sent ? (
        <div className="auth-status">
          <span className="auth-status-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M3 7l9 6 9-6" />
            </svg>
          </span>
          <h2>Check your inbox</h2>
          <p>
            If an account exists with that email address, password reset
            instructions have been sent. Please check your inbox.
          </p>
          <div className="auth-status-actions">
            <Link to="/login" className="auth-submit" style={{ textDecoration: 'none' }}>
              Back to Login
            </Link>
            <button
              type="button"
              className="auth-link"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              onClick={() => setSent(false)}
            >
              Use a different email
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="auth-heading">
            <h2>Forgot Your Password?</h2>
            <p>
              Don't worry! Enter the email address associated with your account
              and we'll send you instructions to reset your password.
            </p>
          </div>

          {error && (
            <div className="auth-alert auth-alert-error" role="alert">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v5" />
                <path d="M12 16h.01" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="auth-field">
              <label className="auth-label" htmlFor="forgot-email">Email address</label>
              <div className={`auth-input${loading ? ' is-disabled' : ''}`}>
                <span className="auth-input-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="M3 7l9 6 9-6" />
                  </svg>
                </span>
                <input
                  id="forgot-email"
                  type="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  disabled={loading}
                />
              </div>
            </div>

            <button className="auth-submit" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="auth-spinner" />
                  Sending...
                </>
              ) : (
                <>
                  Send Reset Link
                  <span className="auth-submit-arrow">→</span>
                </>
              )}
            </button>
          </form>

          <p className="auth-footer">
            Remembered your password?
            <Link to="/login">Back to Login</Link>
          </p>
        </>
      )}
    </AuthLayout>
  );
}
