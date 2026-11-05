import { NavLink } from 'react-router-dom';
import logo from '../../assets/logo.jpeg';
import './Sidebar.css';

const I = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  car: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 13l1.5-4.5A2 2 0 0 1 6.4 7h11.2a2 2 0 0 1 1.9 1.5L21 13v4a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H6v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
      <path d="M6 13h12" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  cart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
      <path d="M3 3h2l2.4 12.2a1.5 1.5 0 0 0 1.5 1.3h8.6a1.5 1.5 0 0 0 1.5-1.2L21 7H6" />
    </svg>
  ),
  receipt: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12a1 1 0 0 1 1 1v17l-3-2-2 2-2-2-2 2-2-2-2 2V4a1 1 0 0 1 1-1z" />
      <path d="M9 8h6M9 12h6" />
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M16 4.5a3 3 0 0 1 0 5.8" />
      <path d="M18 13.5a5 5 0 0 1 3 4.5" />
    </svg>
  ),
  box: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8l-9-5-9 5v8l9 5 9-5z" />
      <path d="M3 8l9 5 9-5M12 13v8" />
    </svg>
  ),
  wrench: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.1 2.1a1.5 1.5 0 0 1-2.1-2.1z" />
    </svg>
  ),
  clipboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h4" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5L16 9.5" />
    </svg>
  ),
};

const LINKS = {
  customer: [
    { to: '/customer', label: 'Dashboard', icon: 'dashboard', end: true },
    { to: '/customer/vehicles', label: 'My Vehicles', icon: 'car' },
    { to: '/customer/appointments', label: 'Appointments', icon: 'calendar' },
    { to: '/customer/jobs', label: 'Service Status', icon: 'clock' },
    { to: '/customer/orders', label: 'Order Parts', icon: 'cart' },
    { to: '/customer/invoices', label: 'Invoices', icon: 'receipt' },
    { to: '/customer/live-chat', label: 'Live Chat', icon: 'chat' },
  ],
  admin: [
    { to: '/admin', label: 'Dashboard', icon: 'dashboard', end: true },
    { to: '/admin/appointments', label: 'Appointments', icon: 'calendar' },
    { to: '/admin/jobs', label: 'Job Cards', icon: 'clipboard' },
    { to: '/admin/users', label: 'Staff & Mechanics', icon: 'users' },
    { to: '/admin/inventory', label: 'Inventory', icon: 'box' },
    { to: '/admin/services', label: 'Services', icon: 'wrench' },
    { to: '/admin/orders', label: 'Parts Orders', icon: 'cart' },
    { to: '/admin/invoices', label: 'Invoices & Payments', icon: 'receipt' },
    { to: '/admin/audit-log', label: 'Audit Log', icon: 'shield' },
  ],
  manager: [
    { to: '/manager', label: 'Dashboard', icon: 'dashboard', end: true },
    { to: '/manager/approvals', label: 'Approvals', icon: 'check' },
    { to: '/manager/users', label: 'Staff & Mechanics', icon: 'users' },
    { to: '/manager/reports', label: 'Management Report', icon: 'chart' },
    { to: '/manager/audit-log', label: 'Activity Log', icon: 'shield' },
  ],
  mechanic: [
    { to: '/mechanic', label: 'My Jobs', icon: 'clipboard', end: true },
  ],
};


export default function Sidebar({ role }) {
  const links = LINKS[role] || [];
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-brand-badge">
          <img src={logo} alt="Uptown Garage" />
        </span>
        <div>
          <div className="sidebar-brand-title">Uptown Garage</div>
          <div className="sidebar-brand-sub">{role} portal</div>
        </div>
      </div>
      <nav className="sidebar-nav">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}
          >
            <span className="sidebar-link-icon" aria-hidden="true">{I[link.icon]}</span>
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        <span className="sidebar-footer-logo">
          <img src={logo} alt="" aria-hidden="true" />
        </span>
        <span>Uptown Garage · v1.0</span>
      </div>
    </aside>
  );
}
