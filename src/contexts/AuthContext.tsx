import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { normalizePhoneNumber } from '../lib/auth-helpers.ts';

export interface UserProfile {
  id: string;
  name: string;
  phoneNumber: string;
  role: 'user' | 'admin' | 'super_admin';
  isTrusted?: boolean;
  isActive?: boolean;
  isSuperAdmin?: boolean;
  createdAt: string;
}

interface AuthContextType {
  user: UserProfile | null;
  profile: UserProfile | null;
  sessionToken: string | null;
  isAuthenticated: boolean;
  firebaseUser: any | null; // Alias for backward compatibility
  loading: boolean;
  error: string | null;
  isLocked: boolean;
  lockRemainingSeconds: number;
  loginWithPhone: (phone: string, password: string) => Promise<void>;
  registerWithPhone: (
    name: string,
    phone: string,
    password: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const SESSION_TOKEN_KEY = 'church_session_token_v1';
const USER_PROFILE_KEY = 'church_user_profile_v1';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [sessionToken, setSessionToken] = useState<string | null>(() => localStorage.getItem(SESSION_TOKEN_KEY));
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    try {
      const stored = localStorage.getItem(USER_PROFILE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [lockRemainingSeconds, setLockRemainingSeconds] = useState<number>(0);

  // Lock countdown timer
  useEffect(() => {
    if (lockRemainingSeconds <= 0) {
      if (isLocked) setIsLocked(false);
      return;
    }
    const timer = setInterval(() => {
      setLockRemainingSeconds((prev) => {
        if (prev <= 1) {
          setIsLocked(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockRemainingSeconds, isLocked]);

  // Load and validate session on startup
  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem(SESSION_TOKEN_KEY);
      if (!token) {
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          if (data.profile) {
            setProfile(data.profile);
            setSessionToken(token);
            localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(data.profile));
          } else {
            handleLogoutLocally();
          }
        } else {
          // Token expired or invalid
          const data = await res.json().catch(() => ({}));
          if (data.isExpired) {
            setError('Your previous session expired due to inactivity. Please sign in again.');
          }
          handleLogoutLocally();
        }
      } catch (err) {
        console.error('Error verifying auth session:', err);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const handleLogoutLocally = () => {
    localStorage.removeItem(SESSION_TOKEN_KEY);
    localStorage.removeItem(USER_PROFILE_KEY);
    setSessionToken(null);
    setProfile(null);
  };

  const loginWithPhone = async (phone: string, password: string) => {
    setError(null);
    const normalizedPhone = normalizePhoneNumber(phone);

    if (!normalizedPhone || normalizedPhone.length < 8) {
      setError('Please enter a valid phone number');
      return;
    }

    if (!password) {
      setError('Please enter your password');
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: normalizedPhone,
          password,
        }),
      });

      const data = await res.json();

      if (res.status === 423 || data.isLocked) {
        setIsLocked(true);
        setLockRemainingSeconds(data.remainingSeconds || 900);
        setError(data.message || 'Account locked for 15 minutes due to 5 consecutive failed login attempts.');
        return;
      }

      if (!res.ok || !data.success) {
        if (data.attemptsRemaining !== undefined) {
          setError(data.error || `Invalid phone number or password. ${data.attemptsRemaining} attempt(s) remaining before lock.`);
        } else {
          setError(data.error || 'Invalid phone number or password.');
        }
        return;
      }

      if (data.token && data.profile) {
        setSessionToken(data.token);
        setProfile(data.profile);
        localStorage.setItem(SESSION_TOKEN_KEY, data.token);
        localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(data.profile));
        setError(null);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'An unexpected error occurred during login');
    }
  };

  const registerWithPhone = async (
    name: string,
    phone: string,
    password: string
  ) => {
    setError(null);
    const normalizedPhone = normalizePhoneNumber(phone);

    if (!name.trim()) {
      setError('Please enter your full name');
      return;
    }

    if (!normalizedPhone || normalizedPhone.length < 8) {
      setError('Please enter a valid phone number');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phoneNumber: normalizedPhone,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const errorMsg = data.error || 'Failed to register account.';
        setError(errorMsg);
        throw new Error(errorMsg);
      }

      if (data.token && data.profile) {
        setSessionToken(data.token);
        setProfile(data.profile);
        localStorage.setItem(SESSION_TOKEN_KEY, data.token);
        localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(data.profile));
        setError(null);
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      if (!error) {
        setError(err.message || 'Failed to register account.');
      }
      throw err;
    }
  };

  const logout = async () => {
    try {
      const token = sessionToken || localStorage.getItem(SESSION_TOKEN_KEY);
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
      handleLogoutLocally();
    } catch (err: any) {
      console.error('Logout error:', err);
      handleLogoutLocally();
    }
  };

  const clearError = () => setError(null);

  const refreshProfile = async () => {
    const token = sessionToken || localStorage.getItem(SESSION_TOKEN_KEY);
    if (!token) return;

    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          setProfile(data.profile);
          localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(data.profile));
        }
      }
    } catch (err) {
      console.error('Failed to refresh profile:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user: profile,
        profile,
        sessionToken,
        isAuthenticated: Boolean(profile && sessionToken),
        firebaseUser: profile ? { uid: profile.id, email: profile.phoneNumber, displayName: profile.name } : null,
        loading,
        error,
        isLocked,
        lockRemainingSeconds,
        loginWithPhone,
        registerWithPhone,
        logout,
        clearError,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
