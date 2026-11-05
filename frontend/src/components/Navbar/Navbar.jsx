import { Link, useNavigate } from 'react-router-dom';
import { useAuth, dashboardPathForRole } from '../../context/AuthContext';
import logo from '../../assets/logo.jpeg';
import './Navbar.css';

export default function Navbar({ title }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const initials = user?.name
    ? user.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <header className="navbar">
      <div className="navbar-left">
        <Link to={dashboardPathForRole(user?.role)} className="navbar-logo" aria-label="Uptown Garage dashboard">
          <img src={logo} alt="Uptown Garage" />
        </Link>
        <div className="navbar-heading">
          <span className="navbar-eyebrow">Uptown Garage</span>
          <h1 className="navbar-title">{title}</h1>
        </div>
      </div>
      <div className="navbar-user">
        <div className="navbar-avatar">{initials}</div>
        <div className="navbar-user-info">
          <div className="navbar-user-name">{user?.name}</div>
          <div className="navbar-user-role">{user?.role}</div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={handleLogout}>Log out</button>
      </div>
    </header>
  );
}
