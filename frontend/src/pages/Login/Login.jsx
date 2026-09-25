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
      {/* Workshop background decoration */}
      <div className="garage-decoration garage-decoration-left">
        ⚙
      </div>

      <div className="garage-decoration garage-decoration-right">
        🔧
      </div>

      <div className="auth-card">

        {/* Back to homepage */}
        <Link to="/" className="auth-back-home">
          <span>←</span>
          Back to home
        </Link>

        {/* Brand */}
        <div className="auth-brand">
          <div className="auth-brand-badge" aria-hidden="true">
            🔧
          </div>

          <div>
            <h1>Uptown Garage</h1>
            <span className="auth-brand-label">
              AUTOMOTIVE SERVICE SYSTEM
            </span>
          </div>
        </div>

        {/* Login heading */}
        <div className="auth-heading">
          <span className="auth-eyebrow">
            <span className="auth-eyebrow-line" />
            CUSTOMER PORTAL
          </span>

          <h2>Welcome Back</h2>

          <p>
            Sign in to manage your vehicle services, bookings and parts.
          </p>
        </div>

        {/* Redirect message */}
        {redirectMessage && (
          <div className="alert alert-info">
            <span className="alert-icon">ℹ</span>
            <span>{redirectMessage}</span>
          </div>
        )}

        {/* Login error */}
        {error && (
          <div className="alert alert-error">
            <span className="alert-icon">!</span>
            <span>{error}</span>
          </div>
        )}

        {/* Login form */}
        <form onSubmit={handleSubmit} autoComplete="on">

          <div className="form-group">
            <label htmlFor="login-email">
              Email address
            </label>

            <div className="input-wrapper">
              <span className="input-icon" aria-hidden="true">
                @
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
            <label htmlFor="login-password">
              Password
            </label>

            <div className="input-wrapper">
              <span className="input-icon" aria-hidden="true">
                🔒
              </span>

              <input
                id="login-password"
                type="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="Enter your password"
                disabled={loading}
              />
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

        {/* Security/workshop footer */}
        <div className="auth-security">
          <span className="security-icon">✓</span>
          <span>
            Secure access to your Uptown Garage account
          </span>
        </div>

      </div>
    </div>
  );
}