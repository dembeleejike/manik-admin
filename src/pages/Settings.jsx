import React, { useEffect, useState } from "react";
import { Save, Plus, Trash2 } from "lucide-react";
import { api } from "../api";
import { C } from "../tokens";
import Layout from "../components/Layout";
import { PageHeader, Button, Card, Field, inputStyle, Loading, ErrorBanner, ExplainerBox } from "../components/ui";

const EMPTY = {
  businessName: "", tagline: "", phone: "", phone2: "", whatsapp: "", email: "",
  locations: [], hours: "", hoursSunday: "", aboutText: "", mapEmbedUrl: "",
  stats: { years: "", projects: "", quality: "", support: "" },
};

export default function Settings() {
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  // Separate from `error` (which is also used for save failures) so a failed
  // *load* can block the form entirely — saving a form that never actually
  // loaded your real data would silently overwrite it with blanks.
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setLoadFailed(false);
    try {
      const data = await api.getSettings();
      setForm({ ...EMPTY, ...data, stats: { ...EMPTY.stats, ...(data.stats || {}) }, locations: data.locations?.length ? data.locations : [] });
    } catch (err) {
      setError(err.message);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const updateStat = (k, v) => setForm(f => ({ ...f, stats: { ...f.stats, [k]: v } }));

  function addLocation() {
    setForm(f => ({ ...f, locations: [...f.locations, { label: "", address: "" }] }));
  }
  function updateLocation(i, field, value) {
    setForm(f => ({ ...f, locations: f.locations.map((loc, idx) => idx === i ? { ...loc, [field]: value } : loc) }));
  }
  function removeLocation(i) {
    setForm(f => ({ ...f, locations: f.locations.filter((_, idx) => idx !== i) }));
  }

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

  if (loadFailed) {
    return (
      <Layout>
        <PageHeader title="Business Settings — Your business info" />
        <ErrorBanner message={`Couldn't load your current settings (${error}). Saving now would overwrite your real business info with blanks, so the form is hidden until this loads successfully.`} />
        <Button type="button" onClick={load}>Try again</Button>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader title="Business Settings — Your business info" />
      <ExplainerBox>
        Everything here shows up on your public website automatically — the footer, contact page, and homepage numbers. Fill this in once with your real details, and the website updates itself. No need to touch any code.
      </ExplainerBox>
      <ErrorBanner message={error} />
      {saved && <div className="text-sm px-4 py-3 mb-4" style={{ background: C.greenBg, color: C.green }}>Saved — your website now shows this.</div>}

      <form onSubmit={handleSave} className="space-y-8">
        <Card>
          <p className="text-xs uppercase tracking-widest mb-4" style={{ color: "#6B6960" }}>Business info</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Business name"><input value={form.businessName} onChange={e => update("businessName", e.target.value)} style={inputStyle} /></Field>
            <Field label="Tagline / what the business does"><input value={form.tagline} onChange={e => update("tagline", e.target.value)} placeholder="General Trading and Marketing" style={inputStyle} /></Field>
            <Field label="Main phone number"><input value={form.phone} onChange={e => update("phone", e.target.value)} placeholder="08060984868" style={inputStyle} /></Field>
            <Field label="Second phone number (optional)"><input value={form.phone2} onChange={e => update("phone2", e.target.value)} placeholder="07026110486" style={inputStyle} /></Field>
            <Field label="WhatsApp number (digits only, with country code)"><input value={form.whatsapp} onChange={e => update("whatsapp", e.target.value)} placeholder="2348060984868" style={inputStyle} /></Field>
            <Field label="Email"><input value={form.email} onChange={e => update("email", e.target.value)} style={inputStyle} /></Field>
          </div>
        </Card>

        <Card>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#6B6960" }}>Locations</p>
          <p className="text-xs mb-4" style={{ color: "#8A877D" }}>Add every office, shop, or branch. Give each one a short name (like "Head Office") and its full address.</p>
          <div className="space-y-3 mb-4">
            {form.locations.map((loc, i) => (
              <div key={i} className="p-3 flex flex-col gap-2" style={{ background: C.concreteD }}>
                <div className="flex justify-between items-center">
                  <input value={loc.label} onChange={e => updateLocation(i, "label", e.target.value)} placeholder="e.g. Head Office" style={{ ...inputStyle, fontWeight: 600, marginBottom: 0, maxWidth: 220 }} />
                  <button type="button" onClick={() => removeLocation(i)}><Trash2 size={16} color={C.red} /></button>
                </div>
                <input value={loc.address} onChange={e => updateLocation(i, "address", e.target.value)} placeholder="Full address" style={inputStyle} />
              </div>
            ))}
            {form.locations.length === 0 && <p className="text-sm" style={{ color: "#8A877D" }}>No locations added yet.</p>}
          </div>
          <Button type="button" variant="ghost" icon={Plus} onClick={addLocation}>Add a location</Button>
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
          <p className="text-xs uppercase tracking-widest mb-4" style={{ color: "#6B6960" }}>Homepage numbers</p>
          <p className="text-xs mb-4" style={{ color: "#8A877D" }}>Only put numbers that are actually true — leave blank to use generic placeholders instead.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Years in business"><input value={form.stats.years} onChange={e => updateStat("years", e.target.value)} placeholder="10+" style={inputStyle} /></Field>
            <Field label="Projects done"><input value={form.stats.projects} onChange={e => updateStat("projects", e.target.value)} placeholder="500+" style={inputStyle} /></Field>
            <Field label="Quality"><input value={form.stats.quality} onChange={e => updateStat("quality", e.target.value)} placeholder="100%" style={inputStyle} /></Field>
            <Field label="Support"><input value={form.stats.support} onChange={e => updateStat("support", e.target.value)} placeholder="24/7" style={inputStyle} /></Field>
          </div>
        </Card>

        <Card>
          <p className="text-xs uppercase tracking-widest mb-4" style={{ color: "#6B6960" }}>Map</p>
          <Field label="Google Maps embed link (optional)">
            <input value={form.mapEmbedUrl} onChange={e => update("mapEmbedUrl", e.target.value)} placeholder="https://www.google.com/maps/embed?..." style={inputStyle} />
          </Field>
          <p className="text-xs mt-2" style={{ color: "#8A877D" }}>
            In Google Maps: search your location → Share → Embed a map → copy the link from the code shown.
          </p>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving} icon={Save}>
            {saving ? "Saving..." : saved ? "Saved ✓" : "Save changes"}
          </Button>
          {saved && <span className="text-sm" style={{ color: C.green }}>Your website now shows this.</span>}
          {error && <span className="text-sm" style={{ color: C.red }}>{error}</span>}
        </div>
      </form>
    </Layout>
  );
}
