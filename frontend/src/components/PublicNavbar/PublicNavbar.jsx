import { Link } from 'react-router-dom';
import './PublicNavbar.css';
import logo from '../../assets/logo.jpeg'

export default function PublicNavbar() {
  return (
    <header className="public-navbar">
      <div className="public-navbar-inner">

        <Link to="/" className="navbar-brand">
          {/* Swap the spanner icon for your own logo image here.
              Drop your logo file in src/assets and update the
              import path above — everything else (sizing, the
              rounded frame) stays the same. */}
          <span className="navbar-logo-mark">
            <img src={logo} alt="Uptown Garage logo" />
          </span>

          <span className="navbar-brand-text">
            <strong>Uptown Garage</strong>
            <small>Auto Service &amp; Spare Parts</small>
          </span>
        </Link>

        <nav className="navbar-actions">
          <Link to="/login" className="navbar-login">
            Log in
          </Link>

          <Link to="/register" className="navbar-signup">
            Sign up
          </Link>
        </nav>

      </div>
    </header>
  );
}