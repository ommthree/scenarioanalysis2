import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  requireRole?: 'admin' | 'user' | 'viewer';
  requireAdmin?: boolean;
}

export default function ProtectedRoute({
  children,
  requireRole,
  requireAdmin = false
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  // Show loading state while checking auth
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0f172a'
      }}>
        <div style={{
          fontSize: '18px',
          color: '#94a3b8'
        }}>
          Loading...
        </div>
      </div>
    );
  }

  // Not authenticated - redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check admin requirement
  if (requireAdmin && user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  // Check specific role requirement
  if (requireRole && user.role !== requireRole && user.role !== 'admin') {
    // Viewers can only access video page
    if (user.role === 'viewer') {
      return <Navigate to="/video" replace />;
    }
    return <Navigate to="/" replace />;
  }

  // Block viewers from accessing routes without explicit viewer role
  // Viewers can only access /video route
  if (user.role === 'viewer' && requireRole !== 'viewer') {
    return <Navigate to="/video" replace />;
  }

  // User is authenticated and has required permissions
  return <>{children}</>;
}
