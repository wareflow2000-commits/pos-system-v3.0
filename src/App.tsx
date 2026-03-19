import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import POS from './pages/POS';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Purchases from './pages/Purchases';
import Attendance from './pages/Attendance';
import Payroll from './pages/Payroll';
import Reports from './pages/Reports';
import Offers from './pages/Offers';
import Branches from './pages/Branches';
import MobileSales from './pages/MobileSales';
import Settings from './pages/Settings';
import Customers from './pages/Customers';
import Shifts from './pages/Shifts';
import Expenses from './pages/Expenses';
import Suppliers from './pages/Suppliers';
import Employees from './pages/Employees';
import Onboarding, { BusinessType } from './pages/Onboarding';
import Login from './pages/Login';
import Returns from './pages/Returns';
import Stocktaking from './pages/Stocktaking';
import { AuthProvider, useAuth } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import { useSettings } from './hooks/useSettings';

function AppContent() {
  const [businessType, setBusinessType] = useState<BusinessType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user, isLoading: isAuthLoading } = useAuth();
  const settings = useSettings();

  useEffect(() => {
    if (settings) {
      const root = document.documentElement;
      root.style.setProperty('--primary-color', settings.primaryColor);
      root.style.setProperty('--secondary-color', settings.secondaryColor);
      root.style.setProperty('--sidebar-bg', settings.sidebarColor);
      root.style.setProperty('--header-bg', settings.headerColor);
      root.style.setProperty('--app-bg', settings.backgroundColor);
      root.style.setProperty('--text-main', settings.textColor);
      root.style.setProperty('--base-font-size', settings.fontSize || '14px');
      root.style.setProperty('--border-radius', settings.borderRadius || '12px');
      
      if (settings.fontFamily === 'Cairo') {
        root.style.fontFamily = '"Cairo", sans-serif';
      } else if (settings.fontFamily === 'Tajawal') {
        root.style.fontFamily = '"Tajawal", sans-serif';
      } else {
        root.style.fontFamily = '"Inter", sans-serif';
      }
    }
  }, [
    settings.primaryColor, 
    settings.secondaryColor, 
    settings.sidebarColor, 
    settings.headerColor, 
    settings.backgroundColor, 
    settings.textColor, 
    settings.fontSize, 
    settings.borderRadius, 
    settings.fontFamily
  ]);

  useEffect(() => {
    const fetchBusinessType = async (retries = 3) => {
      try {
        const res = await fetch('/api/settings/businessType');
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Server returned non-JSON response');
        }
        
        const data = await res.json();
        if (data && data.value) {
          setBusinessType(data.value as BusinessType);
        }
        setIsLoading(false);
      } catch (err) {
        if (retries > 0) {
          console.log(`Retrying fetch business type... (${retries} retries left)`);
          setTimeout(() => fetchBusinessType(retries - 1), 1000);
        } else {
          console.error('Error fetching business type:', err);
          setIsLoading(false);
        }
      }
    };

    fetchBusinessType();
  }, []);

  if (isLoading || isAuthLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">جاري التحميل...</div>;
  }

  if (!user) {
    return <Login />;
  }

  // Smart redirection based on role/device
  const isMobileUser = user.deviceType === 'mobile' || user.role === 'sales_rep';

  if (!businessType) {
    return (
      <>
        {settings.enableNotifications && <Toaster position="top-center" reverseOrder={false} />}
        <Onboarding onComplete={setBusinessType} />
      </>
    );
  }

  return (
    <BrowserRouter>
      {settings.enableNotifications && <Toaster position="top-center" reverseOrder={false} />}
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={
            isMobileUser ? <Navigate to="/mobile-sales" replace /> : 
            <ProtectedRoute allowedRoles={['admin', 'manager']} permissionId="can_view_dashboard">
              <Dashboard />
            </ProtectedRoute>
          } />
          
          {/* Redirect sales reps away from desktop-only pages if they try to access them directly */}
          <Route path="pos" element={
            isMobileUser && user.role !== 'admin' ? <Navigate to="/mobile-sales" replace /> :
            <ProtectedRoute allowedRoles={['admin', 'manager', 'cashier']} permissionId="can_view_pos"><POS /></ProtectedRoute>
          } />
          <Route path="returns" element={
            isMobileUser && user.role !== 'admin' ? <Navigate to="/mobile-sales" replace /> :
            <ProtectedRoute allowedRoles={['admin', 'manager', 'cashier']} permissionId="can_view_returns"><Returns /></ProtectedRoute>
          } />
          <Route path="inventory" element={
            isMobileUser && user.role !== 'admin' ? <Navigate to="/mobile-sales" replace /> :
            <ProtectedRoute allowedRoles={['admin', 'manager']} permissionId="can_view_inventory"><Inventory /></ProtectedRoute>
          } />
          <Route path="stocktaking" element={
            isMobileUser && user.role !== 'admin' ? <Navigate to="/mobile-sales" replace /> :
            <ProtectedRoute allowedRoles={['admin', 'manager']} permissionId="can_view_inventory"><Stocktaking /></ProtectedRoute>
          } />
          <Route path="purchases" element={
            isMobileUser && user.role !== 'admin' ? <Navigate to="/mobile-sales" replace /> :
            <ProtectedRoute allowedRoles={['admin', 'manager']} permissionId="can_view_purchases"><Purchases /></ProtectedRoute>
          } />
          <Route path="customers" element={<ProtectedRoute allowedRoles={['admin', 'manager', 'cashier', 'sales_rep']} permissionId="can_view_customers"><Customers /></ProtectedRoute>} />
          <Route path="suppliers" element={
            isMobileUser && user.role !== 'admin' ? <Navigate to="/mobile-sales" replace /> :
            <ProtectedRoute allowedRoles={['admin', 'manager']} permissionId="can_view_suppliers"><Suppliers /></ProtectedRoute>
          } />
          <Route path="employees" element={<ProtectedRoute allowedRoles={['admin']} permissionId="can_manage_employees"><Employees /></ProtectedRoute>} />
          <Route path="attendance" element={<ProtectedRoute allowedRoles={['admin', 'manager']} permissionId="can_view_attendance"><Attendance /></ProtectedRoute>} />
          <Route path="payroll" element={<ProtectedRoute allowedRoles={['admin']} permissionId="can_view_payroll"><Payroll /></ProtectedRoute>} />
          <Route path="offers" element={<ProtectedRoute allowedRoles={['admin', 'manager']} permissionId="can_view_offers"><Offers /></ProtectedRoute>} />
          <Route path="branches" element={<ProtectedRoute allowedRoles={['admin']} permissionId="can_view_branches"><Branches /></ProtectedRoute>} />
          <Route path="mobile-sales" element={<ProtectedRoute allowedRoles={['admin', 'sales_rep']} permissionId="can_view_mobile_sales"><MobileSales /></ProtectedRoute>} />
          <Route path="shifts" element={
            isMobileUser && user.role !== 'admin' ? <Navigate to="/mobile-sales" replace /> :
            <ProtectedRoute allowedRoles={['admin', 'manager', 'cashier']} permissionId="can_view_shifts"><Shifts /></ProtectedRoute>
          } />
          <Route path="expenses" element={
            isMobileUser && user.role !== 'admin' ? <Navigate to="/mobile-sales" replace /> :
            <ProtectedRoute allowedRoles={['admin', 'manager']} permissionId="can_view_expenses"><Expenses /></ProtectedRoute>
          } />
          <Route path="reports" element={
            isMobileUser && user.role !== 'admin' ? <Navigate to="/mobile-sales" replace /> :
            <ProtectedRoute allowedRoles={['admin', 'manager']} permissionId="can_view_reports"><Reports /></ProtectedRoute>
          } />
          <Route path="settings" element={<ProtectedRoute allowedRoles={['admin']} permissionId="can_manage_settings"><Settings /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
