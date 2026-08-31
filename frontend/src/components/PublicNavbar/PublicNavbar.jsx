import { Link } from 'react-router-dom';
import './PublicNavbar.css';

export default function PublicNavbar() {
  return (
    <header className="public-navbar">
      <div className="public-navbar-inner">
        <Link to="/" className="public-brand">
          <span className="public-brand-badge">UG</span>
          <span className="public-brand-text">Uptown Garage</span>
        </Link>
        <div className="public-navbar-actions">
          <Link to="/login" className="btn btn-outline btn-sm">Log in</Link>
          <Link to="/register" className="btn btn-primary btn-sm">Sign up</Link>
        </div>
      </div>
    </header>
  );
}
