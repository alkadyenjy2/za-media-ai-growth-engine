import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithEmail: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isSupabaseConfigured: boolean;
  mockUser: { id: string; email: string; user_metadata: { full_name?: string } } | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [mockUser, setMockUser] = useState<{ id: string; email: string; user_metadata: { full_name?: string } } | null>(() => {
    const saved = localStorage.getItem('za_os_mock_user');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return null;
  });

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      if (isSupabaseConfigured) {
        try {
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (mounted) {
            setSession(currentSession);
            setUser(currentSession?.user ?? null);
          }
        } catch (err) {
          console.error('Supabase auth session check failed:', err);
        }
      }

      if (mounted) {
        setLoading(false);
      }
    }

    initAuth();

    if (isSupabaseConfigured) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
        if (mounted) {
          setSession(newSession);
          setUser(newSession?.user ?? null);
          setLoading(false);
        }
      });

      return () => {
        mounted = false;
        subscription.unsubscribe();
      };
    } else {
      return () => {
        mounted = false;
      };
    }
  }, []);

  const signInWithEmail = async (email: string, password: string): Promise<{ error: Error | null }> => {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (!error && data.session) {
        setSession(data.session);
        setUser(data.user);
      }
      return { error };
    } else {
      // Offline/Mock mode fallback when Supabase credentials are not set
      if (!email || !password) {
        return { error: new Error('Email and password are required') };
      }
      const fakeUser = {
        id: `user-${Date.now()}`,
        email,
        user_metadata: { full_name: email.split('@')[0] }
      };
      setMockUser(fakeUser);
      localStorage.setItem('za_os_mock_user', JSON.stringify(fakeUser));
      return { error: null };
    }
  };

  const signUpWithEmail = async (email: string, password: string, fullName?: string): Promise<{ error: Error | null }> => {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName || email.split('@')[0],
          }
        }
      });
      if (!error && data.session) {
        setSession(data.session);
        setUser(data.user);
      }
      return { error };
    } else {
      // Offline/Mock mode fallback
      if (!email || !password) {
        return { error: new Error('Email and password are required') };
      }
      const fakeUser = {
        id: `user-${Date.now()}`,
        email,
        user_metadata: { full_name: fullName || email.split('@')[0] }
      };
      setMockUser(fakeUser);
      localStorage.setItem('za_os_mock_user', JSON.stringify(fakeUser));
      return { error: null };
    }
  };

  const signInWithGoogle = async (): Promise<{ error: Error | null }> => {
    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      return { error };
    } else {
      const fakeUser = {
        id: `user-google-${Date.now()}`,
        email: 'executive.google@zamedia.ai',
        user_metadata: { full_name: 'Google Executive User' }
      };
      setMockUser(fakeUser);
      localStorage.setItem('za_os_mock_user', JSON.stringify(fakeUser));
      return { error: null };
    }
  };

  const signOut = async (): Promise<void> => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setSession(null);
    setUser(null);
    setMockUser(null);
    localStorage.removeItem('za_os_mock_user');
  };

  const effectiveUser = user || (mockUser ? (mockUser as unknown as User) : null);

  return (
    <AuthContext.Provider
      value={{
        user: effectiveUser,
        session,
        loading,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signOut,
        isSupabaseConfigured,
        mockUser
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
