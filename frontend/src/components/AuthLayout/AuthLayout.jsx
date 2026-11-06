import { Link } from 'react-router-dom';
import logo from '../../assets/logo.jpeg';
import './AuthLayout.css';

export default function AuthLayout({ children }) {
  const year = new Date().getFullYear();

  return (
    <div className="auth-page">
      <section className="auth-brand-panel">
        <div className="auth-brand-panel-bg" style={{ backgroundImage: `url(${logo})` }} aria-hidden="true" />
        <div className="auth-brand-panel-inner">
          <Link to="/" className="auth-logo" aria-label="Uptown Garage home">
            <span className="auth-logo-badge">
              <img src={logo} alt="Uptown Garage logo" />
            </span>
            <span className="auth-logo-text">Uptown Garage</span>
          </Link>

          <div className="auth-brand-copy">
            <span className="auth-brand-lock" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="10" width="16" height="10" rx="2.5" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                <path d="M12 14v2.5" />
              </svg>
            </span>
            <h1>Secure Login</h1>
            <p>Your account is protected with encrypted sign-in.</p>
          </div>

          <span className="auth-brand-foot">© {year} Uptown Garage. All rights reserved.</span>
        </div>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-card">{children}</div>
      </section>
    </div>
  );
}
