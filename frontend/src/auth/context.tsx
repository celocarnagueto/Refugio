import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { authStorage } from "./storage";
import { api, User } from "../api";

type AuthCtx = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (data: { name: string; phone: string; email: string; password: string; lgpd_accepted: boolean }) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (u: User | null) => void;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    try {
      const token = await authStorage.getToken();
      if (!token) {
        setUser(null);
        return;
      }
      const me = await api.me();
      setUser(me);
      await authStorage.setUser(me);
    } catch {
      await authStorage.clearToken();
      await authStorage.clearUser();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const signIn = async (email: string, password: string) => {
    const r = await api.login(email, password);
    await authStorage.setToken(r.access_token);
    await authStorage.setUser(r.user);
    setUser(r.user);
  };

  const signUp = async (data: Parameters<AuthCtx["signUp"]>[0]) => {
    const r = await api.register(data);
    await authStorage.setToken(r.access_token);
    await authStorage.setUser(r.user);
    setUser(r.user);
  };

  const signOut = async () => {
    await authStorage.clearToken();
    await authStorage.clearUser();
    setUser(null);
  };

  const refresh = async () => {
    const me = await api.me();
    setUser(me);
    await authStorage.setUser(me);
  };

  return <Ctx.Provider value={{ user, loading, signIn, signUp, signOut, refresh, setUser }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
