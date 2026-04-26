import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  fetchAuthSession,
  getCurrentUser,
  signIn as amplifySignIn,
  signOut as amplifySignOut,
  signUp as amplifySignUp,
  fetchUserAttributes,
} from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import { apiFetch, ApiError } from "@/lib/api-client";

// Types — canonical definitions live in /src/types/auth.ts
export type { Profile } from "@/types/auth";
import type { Profile } from "@/types/auth";

// Minimal user/session shapes that preserve the field names existing callers
// read off the legacy Supabase types. user_metadata is included so existing
// code like `session?.user?.user_metadata?.full_name` keeps working.
export interface AuthUser {
  id: string;
  email: string;
  user_metadata: {
    full_name?: string;
    display_name?: string;
    avatar_url?: string;
  };
}

export interface AuthSession {
  access_token: string;
  user: AuthUser;
}

interface AuthContextValue {
  user: AuthUser | null;
  session: AuthSession | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: string | null; hasSession: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updateProfile: (changes: Partial<Profile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Map Cognito attributes + token to the AuthUser shape callers expect.
async function buildAuthState(): Promise<{ user: AuthUser | null; session: AuthSession | null }> {
  try {
    await getCurrentUser();
  } catch {
    return { user: null, session: null };
  }
  const session = await fetchAuthSession();
  const accessToken = session.tokens?.accessToken?.toString();
  const idTokenPayload = session.tokens?.idToken?.payload;
  if (!accessToken || !idTokenPayload) {
    return { user: null, session: null };
  }

  let attributes: Awaited<ReturnType<typeof fetchUserAttributes>> = {};
  try {
    attributes = await fetchUserAttributes();
  } catch {
    // Attributes are best-effort; access token is the source of truth.
  }

  const sub = idTokenPayload.sub as string | undefined;
  const email = (attributes.email ?? (idTokenPayload.email as string | undefined)) ?? "";
  const name = attributes.name ?? (idTokenPayload.name as string | undefined);
  const picture = attributes.picture ?? (idTokenPayload.picture as string | undefined);

  if (!sub) return { user: null, session: null };

  const user: AuthUser = {
    id: sub,
    email,
    user_metadata: {
      full_name: name,
      display_name: name,
      avatar_url: picture,
    },
  };
  return { user, session: { access_token: accessToken, user } };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const hydrate = useCallback(async () => {
    const next = await buildAuthState();
    if (!mountedRef.current) return;
    // Functional setters: keep the previous reference when the value is
    // structurally unchanged. Without this, every hydrate creates a new user/
    // session object → AuthContext value re-memos → every consumer re-renders
    // → effects with `user` in their deps refire (which is exactly what was
    // hammering /functions/v1/integrations-connect in a loop).
    setUser((prev) => {
      if (!prev && !next.user) return prev;
      if (prev && next.user && prev.id === next.user.id && prev.email === next.user.email) return prev;
      return next.user;
    });
    setSession((prev) => {
      if (!prev && !next.session) return prev;
      if (prev && next.session && prev.access_token === next.session.access_token) return prev;
      return next.session;
    });
    if (!next.user) {
      setProfile((prev) => (prev === null ? prev : null));
      return;
    }
    try {
      const me = await apiFetch<{ displayName: string | null; avatarUrl: string | null; onboardingCompleted: boolean }>(
        "/me",
      );
      if (!mountedRef.current) return;
      setProfile((prev) => {
        if (
          prev &&
          prev.display_name === me.displayName &&
          prev.avatar_url === me.avatarUrl &&
          prev.onboarding_completed === me.onboardingCompleted
        ) {
          return prev;
        }
        return {
          display_name: me.displayName,
          avatar_url: me.avatarUrl,
          onboarding_completed: me.onboardingCompleted,
        };
      });
    } catch (err) {
      // First /me call may fail if API is offline; degrade to a synthesized profile so the app shell still renders.
      if (mountedRef.current) {
        setProfile((prev) => {
          const fallback = {
            display_name: next.user!.user_metadata.display_name ?? null,
            avatar_url: next.user!.user_metadata.avatar_url ?? null,
            onboarding_completed: false,
          };
          if (
            prev &&
            prev.display_name === fallback.display_name &&
            prev.avatar_url === fallback.avatar_url &&
            prev.onboarding_completed === fallback.onboarding_completed
          ) {
            return prev;
          }
          return fallback;
        });
      }
      // Always log so a 401 here (e.g. apps/api running without Cognito env)
      // is visible instead of silently degrading the profile.
      // eslint-disable-next-line no-console
      console.warn("[auth] /me hydration failed", err);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    void hydrate().finally(() => {
      if (mountedRef.current) setLoading(false);
    });

    const unsubscribe = Hub.listen("auth", ({ payload }) => {
      switch (payload.event) {
        case "signedIn":
        case "signInWithRedirect":
          void hydrate();
          break;
        // Intentionally NOT handling "tokenRefresh" — Amplify fires it on
        // every fetchAuthSession() call (including the one inside apiFetch),
        // so re-hydrating on it produces an infinite loop with /me.
        case "signedOut":
          if (mountedRef.current) {
            setUser(null);
            setSession(null);
            setProfile(null);
          }
          break;
        default:
      }
    });

    return () => {
      mountedRef.current = false;
      unsubscribe();
    };
  }, [hydrate]);

  const signUp = useCallback(async (email: string, password: string, displayName?: string) => {
    try {
      const res = await amplifySignUp({
        username: email,
        password,
        options: {
          userAttributes: {
            email,
            ...(displayName ? { name: displayName } : {}),
          },
        },
      });
      // Cognito requires email confirmation by default — user must enter the
      // 6-digit code in the AuthPage before they have a session.
      return { error: null, hasSession: res.isSignUpComplete };
    } catch (err) {
      return { error: (err as Error).message ?? "sign-up failed", hasSession: false };
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      await amplifySignIn({ username: email, password });
      await hydrate();
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message ?? "sign-in failed" };
    }
  }, [hydrate]);

  const signOut = useCallback(async () => {
    await amplifySignOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  }, []);

  const updateProfile = useCallback(async (changes: Partial<Profile>) => {
    if (!user) return;
    const body: Record<string, unknown> = {};
    if (changes.display_name !== undefined) body.displayName = changes.display_name;
    if (changes.onboarding_completed !== undefined) body.onboardingCompleted = changes.onboarding_completed;
    if (Object.keys(body).length === 0) return;

    const updated = await apiFetch<{ displayName: string | null; avatarUrl: string | null; onboardingCompleted: boolean }>(
      "/me",
      { method: "PATCH", body: JSON.stringify(body) },
    );
    setProfile({
      display_name: updated.displayName,
      avatar_url: updated.avatarUrl,
      onboarding_completed: updated.onboardingCompleted,
    });
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
