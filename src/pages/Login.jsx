import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { useAuth } from "../AuthContext";
import { C } from "../tokens";

// Read once, synchronously, so it's ready before the first render — and
// remove it immediately so it doesn't resurface on a later, unrelated visit.
function takeSessionMessage() {
  const msg = sessionStorage.getItem("manik_admin_session_msg");
  if (msg) sessionStorage.removeItem("manik_admin_session_msg");
  return msg || "";
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(takeSessionMessage);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: C.steel }}>
      <div className="w-full max-w-sm p-8" style={{ background: C.cream }}>
        <div className="flex items-center gap-2 mb-1">
          <span style={{ width: 10, height: 10, background: C.safety }} />
          <span className="font-bold text-lg tracking-tight" style={{ color: C.ink }}>MANIK</span>
        </div>
        <p className="text-sm mb-6" style={{ color: "#6B6960" }}>Admin dashboard</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wide mb-1.5" style={{ color: "#6B6960" }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2.5 text-sm"
              style={{ border: "1px solid #C9C5BA", background: "white" }}
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide mb-1.5" style={{ color: "#6B6960" }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2.5 text-sm"
              style={{ border: "1px solid #C9C5BA", background: "white" }}
            />
          </div>

          {error && <p className="text-sm" style={{ color: C.red }}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium uppercase tracking-wide text-white disabled:opacity-60"
            style={{ background: C.safety }}
          >
            <Lock size={14} /> {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
