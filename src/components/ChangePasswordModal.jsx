import React, { useState } from "react";
import { X } from "lucide-react";
import { api } from "../api";
import { C } from "../tokens";
import { Button, Field, inputStyle } from "./ui";

export default function ChangePasswordModal({ onClose }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirm) {
      setError("The two new passwords don't match.");
      return;
    }
    setSaving(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setDone(true);
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
          <h2 className="font-bold text-lg" style={{ color: C.ink }}>Change password</h2>
          <button onClick={onClose} aria-label="Close"><X size={18} color={C.ink} /></button>
        </div>

        {done ? (
          <div>
            <p className="text-sm mb-5" style={{ color: C.ink }}>Your password has been updated. Use the new one next time you sign in.</p>
            <Button onClick={onClose}>Done</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Current password">
              <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" required style={inputStyle} />
            </Field>
            <Field label="New password (at least 8 characters)">
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" required style={inputStyle} />
            </Field>
            <Field label="Repeat new password">
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required style={inputStyle} />
            </Field>
            {error && <p className="text-sm" style={{ color: C.red }}>{error}</p>}
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Update password"}</Button>
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
