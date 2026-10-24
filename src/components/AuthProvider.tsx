"use client";
import { createContext, useContext, ReactNode, useCallback } from "react";
import { usePiAuth, PPAUser, AuthStatus } from "@/hooks/usePiAuth";
import type { SessionOrigin } from "@/lib/pi-session";

interface AuthContextType {
  user: PPAUser | null;
  status: AuthStatus;
  loading: boolean;
  /** 'pi-browser' or 'web'; null when nobody is signed in. */
  origin: SessionOrigin | null;
  /** Pi payments need the `payments` scope, which only Pi Browser can grant. */
  canPay: boolean;
  /** Whether this deployment has a Pi Sign-In client ID configured. */
  webSignInAvailable: boolean;
  signIn: () => Promise<void>;
  signInWithWeb: (returnTo?: string) => void;
  completeWebSignIn: (accessToken: string, username?: string) => Promise<void>;
  signOut: () => void;
  forceReauth: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUser: (u: PPAUser) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  status: "loading",
  loading: true,
  origin: null,
  canPay: false,
  webSignInAvailable: false,
  signIn: async () => {},
  signInWithWeb: () => {},
  completeWebSignIn: async () => {},
  signOut: () => {},
  forceReauth: async () => {},
  refreshUser: async () => {},
  updateUser: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = usePiAuth();
  const refreshUser = useCallback(async () => {
    if (!auth.user?.id) return;
    try {
      const res = await fetch(`/api/user/${auth.user.id}`);
      const data = await res.json();
      if (data.user) {
        auth.updateUser(data.user);
      }
    } catch (err) {
      console.error("Failed to refresh user:", err);
    }
  }, [auth]);
  return (
    <AuthContext.Provider value={{ ...auth, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}