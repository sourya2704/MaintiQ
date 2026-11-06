import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, setUnauthorizedHandler, tokenStore } from "./api";
import type { User } from "./types";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (organization_name: string, name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  /** Replace the signed-in user after a profile change (e.g. language). */
  updateUser: (user: User) => void;
  can: (...roles: User["role"][]) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));
  const qc = useQueryClient();

  const logout = useCallback(() => {
    tokenStore.set(null);
    setUser(null);
    qc.clear();
  }, [qc]);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!tokenStore.get()) return;
    api
      .get<User>("/api/auth/me")
      .then(setUser)
      .catch(() => tokenStore.set(null))
      .finally(() => setLoading(false));
  }, [logout]);

  const accept = (res: { access_token: string; user: User }) => {
    tokenStore.set(res.access_token);
    setUser(res.user);
  };

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      login: async (email, password) => accept(await api.post("/api/auth/login", { email, password })),
      register: async (organization_name, name, email, password) =>
        accept(await api.post("/api/auth/register", { organization_name, name, email, password })),
      logout,
      updateUser: setUser,
      can: (...roles) => Boolean(user && roles.includes(user.role)),
    }),
    [user, loading, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
