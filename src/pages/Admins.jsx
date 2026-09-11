import React, { useEffect, useState } from "react";
import { UserPlus, Trash2, X } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { C } from "../tokens";
import Layout from "../components/Layout";
import { PageHeader, Button, Card, Field, inputStyle, Loading, ErrorBanner } from "../components/ui";

export default function Admins() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const { admin: currentAdmin } = useAuth();

  async function load() {
    setLoading(true);
    try {
      setAdmins(await api.listAdmins());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id) {
    if (!confirm("Remove this admin's access?")) return;
    try {
      await api.deleteAdmin(id);
      setAdmins((prev) => prev.filter((a) => a._id !== id));
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <Layout>
      <PageHeader
        title="Admins"
        action={<Button icon={UserPlus} onClick={() => setShowForm(true)}>Add admin</Button>}
      />
      <p className="text-sm mb-6" style={{ color: "#6B6960" }}>
        Everyone listed here can log into this dashboard. Use "Add admin" to set up a new login — a good moment for this is right when you're handing the dashboard over to someone new, so they can type in their own email and password themselves.
      </p>
      <ErrorBanner message={error} />

      {loading ? (
        <Loading />
      ) : (
        <div className="space-y-2">
          {admins.map((a) => (
            <Card key={a._id} className="flex items-center justify-between">
              <div>
                <p className="font-medium" style={{ color: C.ink }}>{a.name}</p>
                <p className="text-xs" style={{ color: "#6B6960" }}>{a.email}</p>
              </div>
              {a._id !== currentAdmin?.id && (
                <button onClick={() => handleDelete(a._id)} className="text-xs flex items-center gap-1" style={{ color: C.red }}>
                  <Trash2 size={12} /> Remove
                </button>
              )}
              {a._id === currentAdmin?.id && (
                <span className="text-xs" style={{ color: "#8A877D" }}>This is you</span>
              )}
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <AddAdminModal onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />
      )}
    </Layout>
  );
}

function AddAdminModal({ onClose, onSaved }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.createAdmin({ name, email, password });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "#00000088" }} onClick={onClose}>
      <div className="max-w-sm w-full p-6" style={{ background: C.cream }} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h2 className="font-bold text-lg" style={{ color: C.ink }}>Add admin</h2>
          <button onClick={onClose}><X size={18} color={C.ink} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. the owner's name" style={inputStyle} /></Field>
          <Field label="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} /></Field>
          <Field label="Password"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} /></Field>
          {error && <p className="text-sm" style={{ color: C.red }}>{error}</p>}
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving}>{saving ? "Creating..." : "Create login"}</Button>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
