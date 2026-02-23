import { useState, useEffect, useCallback } from "react";
import { apiFetch, getSessionToken, clearSessionToken } from "../lib/api";

interface User {
  id: string;
  displayName: string | null;
  image: string | null;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getSessionToken();
    if (!token) {
      setLoading(false);
      return;
    }

    apiFetch<User>("/auth/me")
      .then(setUser)
      .catch(() => {
        clearSessionToken();
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(() => {
    const apiBase = import.meta.env.VITE_API_URL || "http://localhost:8787";
    window.location.href = `${apiBase}/auth/login`;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {
      // Ignore — we're clearing the session regardless
    }
    clearSessionToken();
    setUser(null);
  }, []);

  return { user, loading, login, logout };
}
