import { NavLink } from 'react-router-dom';
import './Sidebar.css';

const LINKS = {
  customer: [
    { to: '/customer', label: 'Dashboard', end: true },
    { to: '/customer/vehicles', label: 'My Vehicles' },
    { to: '/customer/appointments', label: 'Appointments' },
    { to: '/customer/jobs', label: 'Service Status' },
    { to: '/customer/orders', label: 'Order Parts' },
    { to: '/customer/invoices', label: 'Invoices' },
  ],
  admin: [
    { to: '/admin', label: 'Dashboard', end: true },
    { to: '/admin/appointments', label: 'Appointments' },
    { to: '/admin/jobs', label: 'Job Cards' },
    { to: '/admin/users', label: 'Staff & Mechanics' },
    { to: '/admin/inventory', label: 'Inventory' },
    { to: '/admin/orders', label: 'Parts Orders' },
    { to: '/admin/invoices', label: 'Invoices & Payments' },
  ],
  manager: [
    { to: '/manager', label: 'Dashboard', end: true },
    { to: '/manager/approvals', label: 'Approvals' },
    { to: '/manager/users', label: 'Staff & Mechanics' },
    { to: '/manager/reports', label: 'Reports & Audit Log' },
  ],
  mechanic: [
    { to: '/mechanic', label: 'My Jobs', end: true },
  ],
};

export default function Sidebar({ role }) {
  const links = LINKS[role] || [];
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-brand-badge">UG</span>
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
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
