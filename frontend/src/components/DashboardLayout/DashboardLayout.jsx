import Sidebar from '../Sidebar/Sidebar';
import Navbar from '../Navbar/Navbar';
import './DashboardLayout.css';

export default function DashboardLayout({ role, title, children }) {
  return (
    <div className="dashboard-layout">
      <Sidebar role={role} />
      <div className="dashboard-main">
        <Navbar title={title} />
        <main className="dashboard-content">{children}</main>
      </div>
    </div>
  );
}
