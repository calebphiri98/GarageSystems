import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, dashboardPathForRole } from '../../context/AuthContext';
import './Login.css';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const redirectMessage = location.state?.message;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    setError('');
    setLoading(true);

    try {
      // Authenticate with the existing backend/auth system
      const user = await login(email, password);

      /*
       * Clear login credentials from the React form state
       * immediately after successful authentication.
       */
      setEmail('');
      setPassword('');

      // Redirect according to the authenticated user's role
      navigate(dashboardPathForRole(user.role), {
        replace: true,
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Login failed. Please check your credentials and try again.'
      );

      // Never leave the password visible after a failed attempt
      setPassword('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">

      <div className="auth-card">

        {/* Back to homepage */}
        <Link to="/" className="auth-back-home">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="M11 18l-6-6 6-6" />
          </svg>
          Back to home
        </Link>

        {/* Brand */}
        <div className="auth-brand">
          <div className="auth-brand-badge" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.1 2.1a1.5 1.5 0 0 1-2.1-2.1z" />
            </svg>
          </div>

          <div>
            <h1>Uptown Garage</h1>
            <span className="auth-brand-label">Automotive Service System</span>
          </div>
        </div>

        {/* Login heading */}
        <div className="auth-heading">
          <h2>Welcome back</h2>
          <p>Sign in to your account.</p>
        </div>

        {/* Redirect message */}
        {redirectMessage && (
          <div className="alert alert-info">
            <span className="alert-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 11v5" />
                <path d="M12 8h.01" />
              </svg>
            </span>
            <span>{redirectMessage}</span>
          </div>
        )}

        {/* Login error */}
        {error && (
          <div className="alert alert-error">
            <span className="alert-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v5" />
                <path d="M12 16h.01" />
              </svg>
            </span>
            <span>{error}</span>
          </div>
        )}

        {/* Login form */}
        <form onSubmit={handleSubmit} autoComplete="on">

          <div className="form-group">
            <label htmlFor="login-email">Email address</label>

            <div className={`input-wrapper${loading ? ' input-wrapper-disabled' : ''}`}>
              <span className="input-icon" aria-hidden="true">
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

          <div className="form-group">
            <label htmlFor="login-password">Password</label>

            <div className={`input-wrapper${loading ? ' input-wrapper-disabled' : ''}`}>
              <span className="input-icon" aria-hidden="true">
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
                className="input-icon-toggle"
                onClick={() => setShowPassword((v) => !v)}
                disabled={loading}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                tabIndex={-1}
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

          <button
            className="auth-submit"
            type="submit"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="login-spinner" />
                Signing in...
              </>
            ) : (
              <>
                Sign In
                <span className="submit-arrow">→</span>
              </>
            )}
          </button>
        </form>

        {/* Registration */}
        <p className="auth-footer">
          New customer?
          <Link to="/register">
            Create an account
          </Link>
        </p>

      </div>
    </div>
  );
}