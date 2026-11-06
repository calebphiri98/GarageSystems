import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, dashboardPathForRole } from '../../context/AuthContext';
import AuthLayout from '../../components/AuthLayout/AuthLayout';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const redirectMessage = location.state?.message;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Please enter your email address and password.');
      return;
    }

    setLoading(true);

    try {
      const user = await login(email.trim(), password, remember);
      setEmail('');
      setPassword('');
      navigate(dashboardPathForRole(user.role), { replace: true });
    } catch (err) {
      const status = err.response?.status;
      if (status === 401) {
        setError('Incorrect email or password. Please try again.');
      } else if (status === 403) {
        setError(err.response?.data?.message || 'This account is not able to sign in right now.');
      } else if (!err.response) {
        setError('Could not reach the server. Check your connection and try again.');
      } else {
        setError(err.response?.data?.message || 'Unable to complete login. Please try again.');
      }
      setPassword('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <Link to="/" className="auth-back-home">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5" />
          <path d="M11 18l-6-6 6-6" />
        </svg>
        Back to home
      </Link>

      <div className="auth-heading">
        <h2>Welcome Back!</h2>
        <p>Sign in to continue to your Uptown Garage account.</p>
      </div>

      {redirectMessage && (
        <div className="auth-alert auth-alert-info">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5" />
            <path d="M12 8h.01" />
          </svg>
          <span>{redirectMessage}</span>
        </div>
      )}

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

      <form onSubmit={handleSubmit} autoComplete="on" noValidate>
        <div className="auth-field">
          <label className="auth-label" htmlFor="login-email">Email address</label>
          <div className={`auth-input${loading ? ' is-disabled' : ''}`}>
            <span className="auth-input-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="M3 7l9 6 9-6" />
              </svg>
            </span>
            <input
              id="login-email"
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              placeholder="you@example.com"
              disabled={loading}
            />
          </div>
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="login-password">Password</label>
          <div className={`auth-input${loading ? ' is-disabled' : ''}`}>
            <span className="auth-input-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="10" width="16" height="10" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
            </span>
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="Enter your password"
              disabled={loading}
            />
            <button
              type="button"
              className="auth-toggle"
              onClick={() => setShowPassword((v) => !v)}
              disabled={loading}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
            >
              {showPassword ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3l18 18" />
                  <path d="M10.6 5.2A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.4 4.4M6.6 6.6C4 8.3 2 12 2 12s3.6 7 10 7a10.4 10.4 0 0 0 4.4-.95" />
                  <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div className="auth-row">
          <label className="auth-checkbox">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              disabled={loading}
            />
            Remember me
          </label>
          <Link to="/forgot-password" className="auth-link">Forgot Password?</Link>
        </div>

        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? (
            <>
              <span className="auth-spinner" />
              Signing in...
            </>
          ) : (
            <>
              Sign In
              <span className="auth-submit-arrow">→</span>
            </>
          )}
        </button>
      </form>

      <p className="auth-footer">
        New customer?
        <Link to="/register">Create an account</Link>
      </p>
    </AuthLayout>
  );
}
