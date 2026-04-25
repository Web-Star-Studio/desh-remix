import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

// Types — canonical definitions live in /src/types/auth.ts
export type { Profile } from "@/types/auth";
import type { Profile } from "@/types/auth";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: string | null; hasSession: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updateProfile: (changes: Partial<Profile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const bootResolvedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    bootResolvedRef.current = false;

    const finishBoot = () => {
      if (bootResolvedRef.current || !mountedRef.current) return;
      bootResolvedRef.current = true;
      setLoading(false);
    };

    const applySession = (nextSession: Session | null) => {
      if (!mountedRef.current) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (!nextSession?.user) {
        setProfile(null);
      }
    };

    const fetchProfile = async (userId: string) => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("display_name, avatar_url, onboarding_completed")
          .eq("user_id", userId)
          .single();
        if (mountedRef.current) setProfile(data);
      } finally {
        finishBoot();
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession);
      finishBoot();

      if (nextSession?.user) {
        setTimeout(() => {
          if (mountedRef.current) void fetchProfile(nextSession.user.id);
        }, 0);
      }
    });

    supabase.auth.getSession()
      .then(({ data: { session: initialSession } }) => {
        applySession(initialSession);
        finishBoot();
        if (initialSession?.user) {
          void fetchProfile(initialSession.user.id);
        }
      })
      .catch(() => {
        finishBoot();
      });

    const bootFallback = window.setTimeout(() => {
      finishBoot();
    }, 2500);

    return () => {
      mountedRef.current = false;
      window.clearTimeout(bootFallback);
      subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { display_name: displayName },
      },
    });
    const hasSession = !!data?.session;
    return { error: error?.message ?? null, hasSession };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const updateProfile = useCallback(async (changes: Partial<Profile>) => {
    if (!user) return;
    await supabase.from("profiles").update(changes).eq("user_id", user.id);
    setProfile(prev => prev ? { ...prev, ...changes } : null);
  }, [user]);

  const value = useMemo<AuthContextValue>(() => ({
    user, session, profile, loading, signUp, signIn, signOut, updateProfile,
  }), [user, session, profile, loading, signUp, signIn, signOut, updateProfile]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};