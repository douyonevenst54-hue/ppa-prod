"use client";

import { createContext, useContext, ReactNode, useCallback } from "react";
import { usePiAuth, PPAUser, AuthStatus } from "@/hooks/usePiAuth";

interface AuthContextType {
  user: PPAUser | null;
  status: AuthStatus;
  loading: boolean;
  signOut: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  status: "loading",
  loading: true,
  signOut: () => {},
  refreshUser: async () => {},
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