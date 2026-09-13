import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import OwnerRoute from "./components/OwnerRoute";
import Login from "./pages/Login";
import Overview from "./pages/Overview";
import Products from "./pages/Products";
import Quotes from "./pages/Quotes";
import Projects from "./pages/Projects";
import SettingsPage from "./pages/Settings";
import Admins from "./pages/Admins";
import Sales from "./pages/Sales";
import Purchases from "./pages/Purchases";
import Expenses from "./pages/Expenses";
import Reports from "./pages/Reports";
import Customers from "./pages/Customers";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Overview /></ProtectedRoute>} />
          <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
          <Route path="/quotes" element={<ProtectedRoute><Quotes /></ProtectedRoute>} />
          <Route path="/sales" element={<ProtectedRoute><Sales /></ProtectedRoute>} />
          <Route path="/purchases" element={<ProtectedRoute><Purchases /></ProtectedRoute>} />
          <Route path="/expenses" element={<ProtectedRoute><OwnerRoute><Expenses /></OwnerRoute></ProtectedRoute>} />
          <Route path="/customers" element={<ProtectedRoute><OwnerRoute><Customers /></OwnerRoute></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><OwnerRoute><Reports /></OwnerRoute></ProtectedRoute>} />
          <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><OwnerRoute><SettingsPage /></OwnerRoute></ProtectedRoute>} />
          <Route path="/admins" element={<ProtectedRoute><OwnerRoute><Admins /></OwnerRoute></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
