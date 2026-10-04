import React, { createContext, useContext, useState, useEffect } from "react";
import { api } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [ready, setReady] = useState(false);

  // The session lives in an httpOnly cookie this code cannot read, so on load we
  // simply ask the server who (if anyone) is signed in.
  useEffect(() => {
    let cancelled = false;
    api.me()
      .then((data) => { if (!cancelled) setAdmin(data.admin); })
      .catch(() => { if (!cancelled) setAdmin(null); })
      .finally(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, []);

  async function login(identifier, password) {
    const data = await api.login(identifier, password);
    // Confirm the browser actually kept the secure cookie before trusting the login.
    try {
      const me = await api.me();
      setAdmin(me.admin);
    } catch {
      setAdmin(null);
      throw new Error("You signed in, but your browser blocked the secure sign-in cookie. Turn off \"block all cookies\" for this site, or ask the developer to check the setup guide.");
    }
    return data.admin;
  }

  async function logout() {
    try { await api.logout(); } catch { /* signing out locally either way */ }
    setAdmin(null);
  }

  return (
    <AuthContext.Provider value={{ admin, login, logout, ready }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
