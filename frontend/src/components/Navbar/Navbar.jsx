import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
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
      <h1 className="navbar-title">{title}</h1>
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
