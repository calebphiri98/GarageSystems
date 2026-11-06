import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../api/api';
import AuthLayout from '../../components/AuthLayout/AuthLayout';

function passwordChecks(value) {
  return {
    length: value.length >= 8,
    upper: /[A-Z]/.test(value),
    lower: /[a-z]/.test(value),
    number: /[0-9]/.test(value),
    special: /[^A-Za-z0-9]/.test(value),
  };
}

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(false);

  const checks = useMemo(() => passwordChecks(password), [password]);
  const allValid = Object.values(checks).every(Boolean);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!allValid) {
      setError('Your password does not meet all the requirements below.');
      return;
    }
    if (password !== confirmation) {
      setError('The two passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
        token,
        password,
        password_confirmation: confirmation,
      });
      setDone(true);
    } catch (err) {
      if (!err.response) {
        setError('Could not reach the server. Check your connection and try again.');
      } else {
        const message = err.response?.data?.message || 'Could not reset your password. Please try again.';
        setError(message);
        if (err.response.status === 400) {
          setLinkInvalid(true);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  const invalidLink = !token || linkInvalid;

  return (
    <AuthLayout>
      <Link to="/login" className="auth-back-home">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5" />
          <path d="M11 18l-6-6 6-6" />
        </svg>
        Back to login
      </Link>

      {done ? (
        <div className="auth-status">
          <span className="auth-status-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M8 12.5l2.5 2.5L16 9.5" />
            </svg>
          </span>
          <h2>Password reset successful</h2>
          <p>Your password has been reset successfully. You can now sign in using your new password.</p>
          <div className="auth-status-actions">
            <Link to="/login" className="auth-submit" style={{ textDecoration: 'none' }}>
              Back to Login
            </Link>
          </div>
        </div>
      ) : invalidLink ? (
        <div className="auth-status">
          <span className="auth-status-icon is-error">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5" />
              <path d="M12 16h.01" />
            </svg>
          </span>
          <h2>Link invalid or expired</h2>
          <p>
            This password reset link is invalid or has expired. Reset links can
            only be used once and expire after 30 minutes.
          </p>
          <div className="auth-status-actions">
            <Link to="/forgot-password" className="auth-submit" style={{ textDecoration: 'none' }}>
              Request a New Link
            </Link>
            <Link to="/login" className="auth-link">Back to Login</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="auth-heading">
            <h2>Reset Your Password</h2>
            <p>Choose a strong new password for your Uptown Garage account.</p>
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
              <label className="auth-label" htmlFor="reset-password">New password</label>
              <div className={`auth-input${loading ? ' is-disabled' : ''}`}>
                <span className="auth-input-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="10" width="16" height="10" rx="2" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </svg>
                </span>
                <input
                  id="reset-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="Enter your new password"
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

              <ul className="auth-requirements">
                <li className={checks.length ? 'met' : ''}><span className="req-dot">✓</span>At least 8 characters</li>
                <li className={checks.upper ? 'met' : ''}><span className="req-dot">✓</span>One uppercase letter</li>
                <li className={checks.lower ? 'met' : ''}><span className="req-dot">✓</span>One lowercase letter</li>
                <li className={checks.number ? 'met' : ''}><span className="req-dot">✓</span>One number</li>
                <li className={checks.special ? 'met' : ''}><span className="req-dot">✓</span>One special character</li>
              </ul>
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="reset-confirmation">Confirm new password</label>
              <div className={`auth-input${loading ? ' is-disabled' : ''}`}>
                <span className="auth-input-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="10" width="16" height="10" rx="2" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </svg>
                </span>
                <input
                  id="reset-confirmation"
                  type={showConfirmation ? 'text' : 'password'}
                  name="password_confirmation"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="Re-enter your new password"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="auth-toggle"
                  onClick={() => setShowConfirmation((v) => !v)}
                  disabled={loading}
                  aria-label={showConfirmation ? 'Hide password' : 'Show password'}
                  aria-pressed={showConfirmation}
                >
                  {showConfirmation ? (
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
              {confirmation && password !== confirmation && (
                <span className="auth-field-error">Passwords do not match.</span>
              )}
            </div>

            <button className="auth-submit" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="auth-spinner" />
                  Resetting...
                </>
              ) : (
                <>
                  Reset Password
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
