'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getApiClient, setTokens, clearTokens, getTokens } from '@/lib/api';
import type { User } from '@/lib/api/client';
import { ApiError } from '@/lib/api/client/core/ApiError';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const api = getApiClient();

  // Load user on mount
  const loadUser = useCallback(async () => {
    const { accessToken } = getTokens();
    
    if (!accessToken) {
      setLoading(false);
      return;
    }

    try {
      const response = await api.users.getCurrentUser();
      setUser(response);
    } catch (error) {
      console.error('Failed to load user:', error);
      clearTokens();
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);



  const login = async (email: string, password: string) => {
    try {
      const response = await api.authentication.login({
        email,
        password,
      });

      if (response.access_token) {
        setTokens(response.access_token, response.refresh_token || null);
        setUser(response.user || null);
        router.push('/dashboard');
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        throw new Error('Invalid email or password');
      }
      throw new Error('Login failed. Please try again.');
    }
  };

  const register = async (email: string, password: string, name: string) => {
    try {
      const response = await api.authentication.register({
        email,
        password,
        name,
      });

      if (response.access_token) {
        setTokens(response.access_token, response.refresh_token || null);
        setUser(response.user || null);
        router.push('/dashboard');
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        throw new Error('Email already registered');
      }
      throw new Error('Registration failed. Please try again.');
    }
  };

  const logout = async () => {
    try {
      await api.authentication.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearTokens();
      setUser(null);
      router.push('/auth/signin');
    }
  };

  const refreshUser = async () => {
    await loadUser();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        accessToken: getTokens().accessToken,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function getAuthToken(): string | null {
  return getTokens().accessToken;
}