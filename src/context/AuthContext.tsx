import * as React from 'react';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: number;
  email: string;
  name: string;
  role: 'PROFESSIONAL' | 'PATIENT' | 'ADMIN';
  pro_role?: 'DOCTOR' | 'NURSE' | 'SECRETARY';
  specialty?: string;
  rpps_number?: string;
  bio?: string;
  education?: string;
  experience?: string;
  phone?: string;
  address?: string;
  photo_url?: string;
  dob?: string;
  gender?: string;
  secu_number?: string;
  share_id?: string;
}

interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    fetch('/api/auth/me', { signal: controller.signal })
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Not logged in');
      })
      .then(data => setUser(data.user))
      .catch((err) => {
        if (err.name !== 'AbortError' && err.message !== 'Not logged in') {
          console.error('Auth check failed:', err);
        }
        setUser(null);
      })
      .finally(() => {
        clearTimeout(timeoutId);
        setIsLoading(false);
      });

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, []);

  const login = (userData: User) => setUser(userData);
  const logout = () => {
    fetch('/api/auth/logout', { method: 'POST' }).then(() => setUser(null));
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
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
