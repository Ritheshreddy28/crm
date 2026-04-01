import { createContext, useContext, useEffect, useState } from 'react';
import { User, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  role: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, role?: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Helper to get role from user object - prefer app_metadata (secure) over user_metadata
  const getRoleFromUser = (user: User | null | undefined): string => {
    if (!user) return 'user';
    // Check app_metadata first (secure, server-set only)
    const appRole = user.app_metadata?.role as string | undefined;
    if (appRole) return appRole;
    // Fall back to user_metadata for backwards compatibility
    const userRole = user.user_metadata?.role as string | undefined;
    return userRole ?? 'user';
  };

  const recordLogin = async (u: User) => {
    try {
      const { data: latest } = await supabase
        .from('user_login_history')
        .select('id, login_at, logout_at')
        .eq('user_id', u.id)
        .order('login_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const now = new Date();
      const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000);
      if (latest?.logout_at == null && latest?.login_at && new Date(latest.login_at) > tenMinAgo) {
        return;
      }
      await supabase.from('user_login_history').insert({
        user_id: u.id,
        email: u.email ?? '',
        login_at: now.toISOString(),
      });
    } catch {
      // non-blocking
    }
  };

  const recordLogout = async (userId: string) => {
    try {
      const { data: row, error: selectError } = await supabase
        .from('user_login_history')
        .select('id, login_at')
        .eq('user_id', userId)
        .is('logout_at', null)
        .order('login_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (selectError) return;
      if (row?.id) {
        const loginAt = new Date(row.login_at).getTime();
        const durationSeconds = Math.round((Date.now() - loginAt) / 1000);
        await supabase
          .from('user_login_history')
          .update({ logout_at: new Date().toISOString(), duration_seconds: durationSeconds })
          .eq('id', row.id);
      }
    } catch {
      // non-blocking
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) console.error('Supabase getSession error:', error);
      setUser(session?.user ?? null);
      setRole(getRoleFromUser(session?.user));
      if (session?.user) recordLogin(session.user);
    }).catch(err => {
      console.error('Supabase getSession threw an error:', err);
    }).finally(() => {
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        setUser(session?.user ?? null);
        setRole(getRoleFromUser(session?.user));
        setLoading(false);
        if (event === 'SIGNED_IN' && session?.user) await recordLogin(session.user);
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  // Record logout when user leaves the page (close tab, refresh, navigate away) so logout_at gets set
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (user?.id) {
        recordLogout(user.id);
      }
    };
    window.addEventListener('pagehide', handleBeforeUnload);
    return () => window.removeEventListener('pagehide', handleBeforeUnload);
  }, [user?.id]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!error && data.session) {
      setUser(data.session.user);
      setRole(getRoleFromUser(data.session.user));
    }

    return { error };
  };

  const signUp = async (email: string, password: string, userRole: string = 'user') => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: userRole,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    if (user?.id) await recordLogout(user.id);
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, signIn, signUp, signOut }}>
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
