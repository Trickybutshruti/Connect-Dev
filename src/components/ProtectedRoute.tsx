import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, userRole, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    // Save the attempted path
    return <Navigate to="/" state={{ from: location.pathname }} replace />;
  }

  if (!allowedRoles.includes(userRole)) {
    // If user is logged in but doesn't have the right role
    return <Navigate to={`/${userRole}-dashboard`} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
