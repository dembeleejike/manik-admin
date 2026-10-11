import React, { useEffect, useState } from "react";
import { UserPlus, Trash2, X } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { C } from "../tokens";
import { roleLabel } from "../utils/roles";
import Layout from "../components/Layout";
import { PageHeader, Button, Card, Badge, Field, inputStyle, Loading, ErrorBanner, ExplainerBox } from "../components/ui";

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

  async function handleRole(a) {
    const next = a.role === "owner" ? "staff" : "owner";
    if (!confirm(next === "owner" ? `Make ${a.name} an Admin? They will see profits, customers, expenses and settings.` : `Make ${a.name} Staff? They will lose access to money reports and settings.`)) return;
    try {
      const updated = await api.setAdminRole(a._id, next);
      setAdmins((prev) => prev.map((x) => (x._id === a._id ? { ...x, role: updated.role } : x)));
    } catch (err) {
      alert(err.message);
    }
  }

  // Admins and the super admin can remove admins and staff — never the super admin or yourself.
  const canRemove = (a) => a._id !== currentAdmin?.id && a.role !== "superadmin";

  async function handleDelete(id) {
    if (!confirm("Remove this person's access?")) return;
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
        title="Admins — Who can log in"
        action={<Button icon={UserPlus} onClick={() => setShowForm(true)}>Add admin</Button>}
      />
      <ExplainerBox>
        {currentAdmin?.isSuper && <><strong>Super admin</strong> is you — the one rank above everyone. Nobody else can see your account or your activity, and nobody can create another super admin. </>}
        <strong>Admin</strong> accounts can see everything — profits, customers, expenses — and can add admins and staff." Admins can make others admin or staff and remove them, but can never touch the super admin." <strong>Staff</strong> accounts handle day-to-day work (products, quotes, sales, purchases, returns) but can't see money reports or change settings.
      </ExplainerBox>
      <ErrorBanner message={error} />

      {loading ? (
        <Loading />
      ) : (
        <div className="space-y-2">
          {admins.map((a) => (
            <Card key={a._id} className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium" style={{ color: C.ink }}>{a.name}</p>
                  <Badge tone={a.role === "owner" || a.role === "superadmin" ? "green" : "default"}>{roleLabel(a.role)}</Badge>
                </div>
                <p className="text-xs" style={{ color: "#6B6960" }}>{a.email || a.phone}</p>
              </div>
              <div className="flex items-center gap-4">
                {a.role !== "superadmin" && a._id !== currentAdmin?.id && (
                  <button onClick={() => handleRole(a)} className="text-xs underline" style={{ color: C.ink }}>
                    {a.role === "owner" ? "Make staff" : "Make admin"}
                  </button>
                )}
                {canRemove(a) && (
                  <button onClick={() => handleDelete(a._id)} className="text-xs flex items-center gap-1" style={{ color: C.red }}>
                    <Trash2 size={12} /> Remove
                  </button>
                )}
              </div>
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
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("staff");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if ((!email && !phone) || !password) {
      setError("An email or phone number, plus a password, are required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.createAdmin({ name, email, phone, password, role });
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
          <Field label="Email (optional if phone is given)"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} /></Field>
          <Field label="Phone (optional if email is given)"><input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} /></Field>
          <Field label="Password"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} /></Field>
          <Field label="Access level">
            <div className="flex gap-3">
              <button type="button" onClick={() => setRole("staff")} className="text-xs uppercase px-3 py-2" style={{ border: `1px solid ${role === "staff" ? C.safety : "#C9C5BA"}`, color: role === "staff" ? C.safety : "#6B6960" }}>
                Staff (day-to-day only)
              </button>
              <button type="button" onClick={() => setRole("owner")} className="text-xs uppercase px-3 py-2" style={{ border: `1px solid ${role === "owner" ? C.safety : "#C9C5BA"}`, color: role === "owner" ? C.safety : "#6B6960" }}>
                Admin (full access)
              </button>
            </div>
          </Field>
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
