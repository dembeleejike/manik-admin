import React, { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { api } from "../api";
import { C } from "../tokens";
import Layout from "../components/Layout";
import { PageHeader, Button, Card, Field, inputStyle, Loading, ErrorBanner } from "../components/ui";

const EMPTY = {
  businessName: "", phone: "", whatsapp: "", email: "", address: "",
  hours: "", hoursSunday: "", aboutText: "", mapEmbedUrl: "",
  stats: { years: "", projects: "", quality: "", support: "" },
};

export default function Settings() {
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await api.getSettings();
        setForm({ ...EMPTY, ...data, stats: { ...EMPTY.stats, ...(data.stats || {}) } });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const updateStat = (k, v) => setForm(f => ({ ...f, stats: { ...f.stats, [k]: v } }));

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await api.updateSettings(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <Layout><PageHeader title="Business Settings" /><Loading /></Layout>;
  }

  return (
    <Layout>
      <PageHeader title="Business Settings" />
      <p className="text-sm mb-6" style={{ color: "#6B6960" }}>
        This information appears across the public site — footer, contact page, and hero stats. Changes go live the next time someone loads the site.
      </p>
      <ErrorBanner message={error} />
      {saved && <div className="text-sm px-4 py-3 mb-4" style={{ background: C.greenBg, color: C.green }}>Saved.</div>}

      <form onSubmit={handleSave} className="space-y-8">
        <Card>
          <p className="text-xs uppercase tracking-widest mb-4" style={{ color: "#6B6960" }}>Business info</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Business name"><input value={form.businessName} onChange={e => update("businessName", e.target.value)} style={inputStyle} /></Field>
            <Field label="Phone (display)"><input value={form.phone} onChange={e => update("phone", e.target.value)} placeholder="+234 806 098 4868" style={inputStyle} /></Field>
            <Field label="WhatsApp number (digits only, with country code)"><input value={form.whatsapp} onChange={e => update("whatsapp", e.target.value)} placeholder="2348060984868" style={inputStyle} /></Field>
            <Field label="Email"><input value={form.email} onChange={e => update("email", e.target.value)} style={inputStyle} /></Field>
            <Field label="Address" full><input value={form.address} onChange={e => update("address", e.target.value)} style={inputStyle} /></Field>
          </div>
        </Card>

        <Card>
          <p className="text-xs uppercase tracking-widest mb-4" style={{ color: "#6B6960" }}>Hours</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Weekday hours"><input value={form.hours} onChange={e => update("hours", e.target.value)} placeholder="Mon – Sat, 8am – 6pm" style={inputStyle} /></Field>
            <Field label="Sunday"><input value={form.hoursSunday} onChange={e => update("hoursSunday", e.target.value)} placeholder="Closed" style={inputStyle} /></Field>
          </div>
        </Card>

        <Card>
          <p className="text-xs uppercase tracking-widest mb-4" style={{ color: "#6B6960" }}>About text</p>
          <Field label="Shown on the About page and used as the main business description">
            <textarea value={form.aboutText} onChange={e => update("aboutText", e.target.value)} rows={4} style={inputStyle} />
          </Field>
        </Card>

        <Card>
          <p className="text-xs uppercase tracking-widest mb-4" style={{ color: "#6B6960" }}>Homepage stats</p>
          <p className="text-xs mb-4" style={{ color: "#8A877D" }}>Only publish numbers that are actually true — leave blank to use generic placeholders.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Years"><input value={form.stats.years} onChange={e => updateStat("years", e.target.value)} placeholder="10+" style={inputStyle} /></Field>
            <Field label="Projects"><input value={form.stats.projects} onChange={e => updateStat("projects", e.target.value)} placeholder="500+" style={inputStyle} /></Field>
            <Field label="Quality"><input value={form.stats.quality} onChange={e => updateStat("quality", e.target.value)} placeholder="100%" style={inputStyle} /></Field>
            <Field label="Support"><input value={form.stats.support} onChange={e => updateStat("support", e.target.value)} placeholder="24/7" style={inputStyle} /></Field>
          </div>
        </Card>

        <Card>
          <p className="text-xs uppercase tracking-widest mb-4" style={{ color: "#6B6960" }}>Map</p>
          <Field label="Google Maps embed URL (optional)">
            <input value={form.mapEmbedUrl} onChange={e => update("mapEmbedUrl", e.target.value)} placeholder="https://www.google.com/maps/embed?..." style={inputStyle} />
          </Field>
          <p className="text-xs mt-2" style={{ color: "#8A877D" }}>
            In Google Maps: search your location → Share → Embed a map → copy the "src" URL from the code shown.
          </p>
        </Card>

        <Button type="submit" disabled={saving} icon={Save}>{saving ? "Saving..." : "Save changes"}</Button>
      </form>
    </Layout>
  );
}
