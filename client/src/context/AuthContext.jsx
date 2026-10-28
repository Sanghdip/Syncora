import { createContext, useContext, useEffect, useState, useCallback } from "react";

const AuthContext = createContext(null);

const API = "/api/auth";

async function jsonFetch(url, opts = {}) {
  const res = await fetch(url, {
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export function AuthProvider({ children }) {
  const [state, setState] = useState("loading");
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const data = await jsonFetch(`${API}/me`);
      if (data?.user) {
        setUser(data.user);
        setState(data.user.isGuest ? "guest" : "authenticated");
      } else {
        setUser(null);
        setState("unauthenticated");
      }
    } catch (err) {
      console.warn("[auth] me failed", err);
      setState((prev) => (prev === "loading" ? "unauthenticated" : prev));
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const loginWithGoogle = useCallback(async (credential) => {
    setError(null);
    try {
      const data = await jsonFetch(`${API}/google`, {
        method: "POST",
        body: JSON.stringify({ credential }),
      });
      setUser(data.user);
      setState(data.user.isGuest ? "guest" : "authenticated");
      return data.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const continueAsGuest = useCallback(async () => {
    setError(null);
    try {
      const data = await jsonFetch(`${API}/guest`, { method: "POST" });
      setUser(data.user);
      setState("guest");
      return data.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    try { await jsonFetch(`${API}/logout`, { method: "POST" }); } catch {}
    setUser(null);
    setState("unauthenticated");
  }, []);

  const updateProfile = useCallback(async ({ displayName, avatarUrl }) => {
    const data = await jsonFetch(`${API}/profile`, {
      method: "PATCH",
      body: JSON.stringify({ displayName, avatarUrl }),
    });
    setUser(data.user);
    return data.user;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        state,
        user,
        error,
        loginWithGoogle,
        continueAsGuest,
        logout,
        updateProfile,
        refresh,
        isAuthenticated: state === "authenticated" || state === "guest",
        isGuest: state === "guest",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}