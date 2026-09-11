import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function ProtectedRoute({ children }) {
  const { admin, ready } = useAuth();

  if (!ready) return null; // wait for the localStorage check to finish before deciding
  if (!admin) return <Navigate to="/login" replace />;

  return children;
}
