import { Link } from 'react-router-dom';
import logo from '../../assets/logo.jpeg';
import hero from '../../assets/garage-hero.jpg';
import './AuthLayout.css';

export default function AuthLayout({ children }) {
  const year = new Date().getFullYear();

  return (
    <div className="auth-page">
      <section className="auth-brand-panel">
        <div className="auth-brand-panel-bg" style={{ backgroundImage: `url(${hero})` }} aria-hidden="true" />
        <div className="auth-brand-panel-inner">
          <Link to="/" className="auth-logo" aria-label="Uptown Garage home">
            <span className="auth-logo-badge">
              <img src={logo} alt="Uptown Garage logo" />
            </span>
            <span className="auth-logo-text">Uptown Garage</span>
          </Link>

          <div className="auth-brand-copy">
            <span className="auth-brand-eyebrow">Integrated Garage &amp; Auto Parts</span>
            <h1>Your Vehicle,<br />Our Priority.</h1>
            <p>
              Manage your vehicle services, appointments and spare parts
              conveniently with Uptown Garage.
            </p>
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
