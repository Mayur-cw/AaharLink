import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import type { Role } from '../../shared/contracts.js';

interface RouteGuardProps {
  children: React.ReactNode;
  allowedRoles: Role[];
}

export function RouteGuard({ children, allowedRoles }: RouteGuardProps) {
  const { role, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="panel" role="status" aria-busy="true">
        <div className="loading-spinner" aria-hidden="true" />
        <p>Verifying active session credentials...</p>
      </div>
    );
  }

  // If role is allowed directly
  if (allowedRoles.includes(role)) {
    return <>{children}</>;
  }

  // Not authenticated and anonymous not allowed -> redirect to login
  if (!isAuthenticated && !allowedRoles.includes('anonymous')) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Authenticated but does not have the required role -> P-025 Forbidden
  return <Navigate to="/forbidden" replace />;
}
