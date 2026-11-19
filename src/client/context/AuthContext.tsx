import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, setCachedCsrfToken } from '../api.js';
import type { Role, SessionSummary, RegistrationReceipt } from '../../shared/contracts.js';

interface UserSummary {
  id: string;
  email: string;
  role: Role;
  organizationId: string | null;
}

interface OrgSummary {
  id: string;
  name: string;
  kind: string;
  status: string;
  city: string;
  verified: boolean;
}

interface AuthContextValue {
  user: UserSummary | null;
  organization: OrgSummary | null;
  role: Role;
  isAuthenticated: boolean;
  loading: boolean;
  unreadCount: number;
  refreshSession: () => Promise<SessionSummary>;
  refreshUnreadCount: () => Promise<void>;
  login: (email: string, password: string) => Promise<UserSummary>;
  register: (body: Record<string, unknown>) => Promise<RegistrationReceipt>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSummary | null>(null);
  const [organization, setOrganization] = useState<OrgSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    try {
      if (!user) {
        setUnreadCount(0);
        return;
      }
      const data = await api<{ items: Array<{ readAt: string | null }> }>('/api/notifications?limit=50');
      const unread = data.items.filter((item) => !item.readAt).length;
      setUnreadCount(unread);
    } catch {
      // Non-fatal if notifications fail to refresh
    }
  }, [user]);

  const refreshSession = useCallback(async (): Promise<SessionSummary> => {
    try {
      const summary = await api<SessionSummary>('/api/auth/session');
      if (summary.authenticated && summary.user) {
        setUser(summary.user as UserSummary);
        setOrganization(summary.organization as OrgSummary | null);
      } else {
        setUser(null);
        setOrganization(null);
        setCachedCsrfToken(null);
      }
      return summary;
    } catch {
      setUser(null);
      setOrganization(null);
      setCachedCsrfToken(null);
      return { authenticated: false, user: null, organization: null };
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    if (user) {
      refreshUnreadCount();
    } else {
      setUnreadCount(0);
    }
  }, [user, refreshUnreadCount]);

  const login = async (email: string, password: string): Promise<UserSummary> => {
    const summary = await api.post<SessionSummary>('/api/auth/login', { email, password });
    if (!summary.user) {
      throw new Error('Authentication succeeded but user profile was missing.');
    }
    setUser(summary.user as UserSummary);
    setOrganization(summary.organization as OrgSummary | null);
    await refreshUnreadCount();
    return summary.user as UserSummary;
  };

  const register = async (body: Record<string, unknown>): Promise<RegistrationReceipt> => {
    const receipt = await api.post<RegistrationReceipt>('/api/auth/register', body);
    return receipt;
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout', {});
    } catch {
      // Ignore network errors during logout
    } finally {
      setUser(null);
      setOrganization(null);
      setCachedCsrfToken(null);
      setUnreadCount(0);
    }
  };

  const role: Role = user?.role || 'anonymous';
  const isAuthenticated = Boolean(user);

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        role,
        isAuthenticated,
        loading,
        unreadCount,
        refreshSession,
        refreshUnreadCount,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
