import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { adminStorage } from "./storage";
import { adminApi, AdminUser } from "./api";

type Ctx = {
  admin: AdminUser | null;
  loading: boolean;
  isOwner: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AdminCtx = createContext<Ctx | null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    try {
      const token = await adminStorage.getToken();
      if (!token) {
        setAdmin(null);
        return;
      }
      const me = await adminApi.me();
      setAdmin(me);
      await adminStorage.setAdmin(me);
    } catch {
      await adminStorage.clearToken();
      await adminStorage.clearAdmin();
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const signIn = async (email: string, password: string) => {
    const r = await adminApi.login(email, password);
    await adminStorage.setToken(r.access_token);
    await adminStorage.setAdmin(r.admin);
    setAdmin(r.admin);
  };

  const signOut = async () => {
    await adminStorage.clearToken();
    await adminStorage.clearAdmin();
    setAdmin(null);
  };

  return (
    <AdminCtx.Provider value={{ admin, loading, isOwner: admin?.role === "owner", signIn, signOut }}>
      {children}
    </AdminCtx.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminCtx);
  if (!ctx) throw new Error("useAdmin must be used within AdminAuthProvider");
  return ctx;
}
