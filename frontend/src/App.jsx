import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth, dashboardPathForRole } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute';
import DashboardLayout from './components/DashboardLayout/DashboardLayout';

import Login from './pages/Login/Login';
import Register from './pages/Register/Register';

import CustomerDashboard from './pages/customer/Dashboard/Dashboard';
import CustomerVehicles from './pages/customer/Vehicles/Vehicles';
import CustomerAppointments from './pages/customer/Appointments/Appointments';
import CustomerJobs from './pages/customer/Jobs/Jobs';
import CustomerOrders from './pages/customer/Orders/Orders';
import CustomerInvoices from './pages/customer/Invoices/Invoices';

import AdminDashboard from './pages/admin/Dashboard/Dashboard';
import AdminAppointments from './pages/admin/Appointments/Appointments';
import AdminJobs from './pages/admin/Jobs/Jobs';
import AdminJobDetail from './pages/admin/JobDetail/JobDetail';
import AdminUsers from './pages/admin/Users/Users';
import AdminInventory from './pages/admin/Inventory/Inventory';
import AdminOrders from './pages/admin/Orders/Orders';
import AdminInvoices from './pages/admin/Invoices/Invoices';

import ManagerDashboard from './pages/manager/Dashboard/Dashboard';
import ManagerApprovals from './pages/manager/Approvals/Approvals';
import ManagerUsers from './pages/manager/Users/Users';
import ManagerReports from './pages/manager/Reports/Reports';

import MechanicDashboard from './pages/mechanic/Dashboard/Dashboard';
import MechanicJobDetail from './pages/mechanic/JobDetail/JobDetail';

function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={dashboardPathForRole(user.role)} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Customer */}
          <Route path="/customer" element={
            <ProtectedRoute roles={['customer']}>
              <DashboardLayout role="customer" title="Customer Portal"><CustomerDashboard /></DashboardLayout>
            </ProtectedRoute>
          } />
          <Route path="/customer/vehicles" element={
            <ProtectedRoute roles={['customer']}>
              <DashboardLayout role="customer" title="My Vehicles"><CustomerVehicles /></DashboardLayout>
            </ProtectedRoute>
          } />
          <Route path="/customer/appointments" element={
            <ProtectedRoute roles={['customer']}>
              <DashboardLayout role="customer" title="Appointments"><CustomerAppointments /></DashboardLayout>
            </ProtectedRoute>
          } />
          <Route path="/customer/jobs" element={
            <ProtectedRoute roles={['customer']}>
              <DashboardLayout role="customer" title="Service Status"><CustomerJobs /></DashboardLayout>
            </ProtectedRoute>
          } />
          <Route path="/customer/orders" element={
            <ProtectedRoute roles={['customer']}>
              <DashboardLayout role="customer" title="Order Parts"><CustomerOrders /></DashboardLayout>
            </ProtectedRoute>
          } />
          <Route path="/customer/invoices" element={
            <ProtectedRoute roles={['customer']}>
              <DashboardLayout role="customer" title="Invoices"><CustomerInvoices /></DashboardLayout>
            </ProtectedRoute>
          } />

          {/* Admin */}
          <Route path="/admin" element={
            <ProtectedRoute roles={['admin']}>
              <DashboardLayout role="admin" title="Admin Dashboard"><AdminDashboard /></DashboardLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/appointments" element={
            <ProtectedRoute roles={['admin']}>
              <DashboardLayout role="admin" title="Appointments"><AdminAppointments /></DashboardLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/jobs" element={
            <ProtectedRoute roles={['admin']}>
              <DashboardLayout role="admin" title="Job Cards"><AdminJobs /></DashboardLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/jobs/:id" element={
            <ProtectedRoute roles={['admin']}>
              <DashboardLayout role="admin" title="Job Detail"><AdminJobDetail /></DashboardLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/users" element={
            <ProtectedRoute roles={['admin']}>
              <DashboardLayout role="admin" title="Staff & Mechanics"><AdminUsers /></DashboardLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/inventory" element={
            <ProtectedRoute roles={['admin']}>
              <DashboardLayout role="admin" title="Inventory"><AdminInventory /></DashboardLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/orders" element={
            <ProtectedRoute roles={['admin']}>
              <DashboardLayout role="admin" title="Parts Orders"><AdminOrders /></DashboardLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/invoices" element={
            <ProtectedRoute roles={['admin']}>
              <DashboardLayout role="admin" title="Invoices & Payments"><AdminInvoices /></DashboardLayout>
            </ProtectedRoute>
          } />

          {/* Manager */}
          <Route path="/manager" element={
            <ProtectedRoute roles={['manager']}>
              <DashboardLayout role="manager" title="Manager Overview"><ManagerDashboard /></DashboardLayout>
            </ProtectedRoute>
          } />
          <Route path="/manager/approvals" element={
            <ProtectedRoute roles={['manager']}>
              <DashboardLayout role="manager" title="Sensitive Approvals"><ManagerApprovals /></DashboardLayout>
            </ProtectedRoute>
          } />
          <Route path="/manager/users" element={
            <ProtectedRoute roles={['manager']}>
              <DashboardLayout role="manager" title="Staff & Mechanics"><ManagerUsers /></DashboardLayout>
            </ProtectedRoute>
          } />
          <Route path="/manager/reports" element={
            <ProtectedRoute roles={['manager']}>
              <DashboardLayout role="manager" title="Reports & Audit Log"><ManagerReports /></DashboardLayout>
            </ProtectedRoute>
          } />

          {/* Mechanic */}
          <Route path="/mechanic" element={
            <ProtectedRoute roles={['mechanic']}>
              <DashboardLayout role="mechanic" title="My Jobs"><MechanicDashboard /></DashboardLayout>
            </ProtectedRoute>
          } />
          <Route path="/mechanic/jobs/:id" element={
            <ProtectedRoute roles={['mechanic']}>
              <DashboardLayout role="mechanic" title="Job Detail"><MechanicJobDetail /></DashboardLayout>
            </ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
