"use client";

import { createContext, useContext, ReactNode } from "react";
import { usePiAuth, PPAUser, AuthStatus } from "@/hooks/usePiAuth";

interface AuthContextType {
  user: PPAUser | null;
  status: AuthStatus;
  loading: boolean;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  status: "loading",
  loading: true,
  signOut: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = usePiAuth();
  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}