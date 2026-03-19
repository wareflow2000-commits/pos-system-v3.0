import { Navigate } from 'react-router-dom';
import { useAuth, Role } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: Role[];
  permissionId?: string;
}

export default function ProtectedRoute({ children, allowedRoles, permissionId }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">جاري التحميل...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Admin always has access
  if (user.role === 'admin') {
    return <>{children}</>;
  }

  const hasRole = allowedRoles.includes(user.role);
  const hasPermission = permissionId ? user.permissions?.includes(permissionId) : false;

  if (!hasRole && !hasPermission) {
    // Redirect to a safe default page based on role
    if (user.role === 'sales_rep') return <Navigate to="/mobile-sales" replace />;
    if (user.role === 'cashier') return <Navigate to="/pos" replace />;
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
