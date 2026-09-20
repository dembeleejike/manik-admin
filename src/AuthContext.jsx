import React, { createContext, useContext, useState, useEffect } from "react";
import { api } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("manik_admin_token");
    const savedAdmin = localStorage.getItem("manik_admin_info");
    if (token && savedAdmin) {
      try {
        setAdmin(JSON.parse(savedAdmin));
      } catch {
        localStorage.removeItem("manik_admin_token");
        localStorage.removeItem("manik_admin_info");
      }
    }
    setReady(true);
  }, []);

  async function login(identifier, password) {
    const data = await api.login(identifier, password);
    localStorage.setItem("manik_admin_token", data.token);
    localStorage.setItem("manik_admin_info", JSON.stringify(data.admin));
    setAdmin(data.admin);
  }

  function logout() {
    localStorage.removeItem("manik_admin_token");
    localStorage.removeItem("manik_admin_info");
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
