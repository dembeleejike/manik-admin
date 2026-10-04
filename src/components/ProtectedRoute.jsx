import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function ProtectedRoute({ children }) {
  const { admin, ready } = useAuth();

  if (!ready) return null; // wait for the server to say who is signed in before deciding
  if (!admin) return <Navigate to="/login" replace />;

  return children;
}
