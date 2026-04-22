"use client";

import { createContext, useContext, ReactNode } from "react";
import { usePiAuth, PPAUser } from "@/hooks/usePiAuth";

interface AuthContextType {
  user: PPAUser | null;
  loading: boolean;
  error: string | null;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  error: null,
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