import React, { useEffect, useState } from "react";
import { Save, Plus, Trash2, Download } from "lucide-react";
import { api } from "../api";
import { C } from "../tokens";
import Layout from "../components/Layout";
import { PageHeader, Button, Card, Field, inputStyle, Loading, ErrorBanner, ExplainerBox } from "../components/ui";

const EMPTY = {
  businessName: "", tagline: "", phone: "", phone2: "", whatsapp: "", email: "",
  locations: [], hours: "", hoursSunday: "", aboutText: "", heroImageUrl: "",
  stats: { years: "", projects: "", quality: "", support: "" },
};

export default function Settings() {
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [heroFile, setHeroFile] = useState(null);
  const [heroUploading, setHeroUploading] = useState(false);
  const [heroError, setHeroError] = useState("");

  async function handleHeroUpload() {
    if (!heroFile) return;
    setHeroUploading(true);
    setHeroError("");
    try {
      const updated = await api.uploadHeroImage(heroFile);
      setForm(f => ({ ...f, heroImageUrl: updated.heroImageUrl }));
      setHeroFile(null);
    } catch (err) {
      setHeroError(err.message);
    } finally {
      setHeroUploading(false);
    }
  }

  async function handleDownload(path, filename) {
    setDownloadError("");
    try {
      await api.downloadFile(path, filename);
    } catch (err) {
      setDownloadError(err.message);
    }
  }

  useEffect(() => {
    async function load() {
      try {
        const data = await api.getSettings();
        setForm({ ...EMPTY, ...data, stats: { ...EMPTY.stats, ...(data.stats || {}) }, locations: data.locations?.length ? data.locations : [] });
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

  function addLocation() {
    setForm(f => ({ ...f, locations: [...f.locations, { label: "", address: "", mapEmbedUrl: "" }] }));
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

  return (
    <Layout>
      <PageHeader title="Business Settings — Your business info" />
      <ExplainerBox>
        Everything here shows up on your public website automatically — the footer, contact page, and homepage numbers. Fill this in once with your real details, and the website updates itself. No need to touch any code.
      </ExplainerBox>
      <ErrorBanner message={error} />

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
          <p className="text-xs mb-4" style={{ color: "#8A877D" }}>Add every office, shop, or branch. Give each one a short name, its full address, and optionally its own Google Maps link.</p>
          <div className="space-y-3 mb-4">
            {form.locations.map((loc, i) => (
              <div key={i} className="p-3 flex flex-col gap-2" style={{ background: C.concreteD }}>
                <div className="flex justify-between items-center">
                  <input value={loc.label} onChange={e => updateLocation(i, "label", e.target.value)} placeholder="e.g. Head Office" style={{ ...inputStyle, fontWeight: 600, marginBottom: 0, maxWidth: 220 }} />
                  <button type="button" onClick={() => removeLocation(i)}><Trash2 size={16} color={C.red} /></button>
                </div>
                <input value={loc.address} onChange={e => updateLocation(i, "address", e.target.value)} placeholder="Full address" style={inputStyle} />
                <input value={loc.mapEmbedUrl || ""} onChange={e => updateLocation(i, "mapEmbedUrl", e.target.value)} placeholder="Google Maps embed link (optional)" style={inputStyle} />
              </div>
            ))}
            {form.locations.length === 0 && <p className="text-sm" style={{ color: "#8A877D" }}>No locations added yet.</p>}
          </div>
          <Button type="button" variant="ghost" icon={Plus} onClick={addLocation}>Add a location</Button>
          <p className="text-xs mt-3" style={{ color: "#8A877D" }}>
            To get a map link: on Google Maps, search the address → Share → Embed a map → copy just the URL inside <code>src="..."</code>.
          </p>
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
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#6B6960" }}>Homepage photo</p>
          <p className="text-xs mb-4" style={{ color: "#8A877D" }}>
            This is the big photo at the top of your website. A real photo of your shop, products, or finished work looks much better than the "Photo pending" placeholder.
          </p>
          {form.heroImageUrl && (
            <img src={form.heroImageUrl} alt="Current homepage photo" className="w-full max-w-sm h-40 object-cover mb-4" style={{ border: "1px solid #C9C5BA" }} />
          )}
          <input type="file" accept="image/*" onChange={e => setHeroFile(e.target.files[0])} className="text-sm mb-3" />
          {heroError && <p className="text-sm mb-2" style={{ color: C.red }}>{heroError}</p>}
          <div>
            <Button type="button" variant="ghost" disabled={!heroFile || heroUploading} onClick={handleHeroUpload}>
              {heroUploading ? "Uploading..." : "Upload photo"}
            </Button>
          </div>
        </Card>

        <Card>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#6B6960" }}>Backup your data</p>
          <p className="text-xs mb-4" style={{ color: "#8A877D" }}>
            A full backup also runs automatically every night and is emailed to the owner — this button is for grabbing a copy right now, any time you want one.
          </p>
          {downloadError && <p className="text-sm mb-3" style={{ color: C.red }}>{downloadError}</p>}
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="ghost" icon={Download} onClick={() => handleDownload("/api/export/backup", `manik-backup-${new Date().toISOString().slice(0, 10)}.json`)}>
              Download full backup
            </Button>
            <Button type="button" variant="ghost" icon={Download} onClick={() => handleDownload("/api/export/sales.csv", `manik-sales-${new Date().toISOString().slice(0, 10)}.csv`)}>
              Download sales as spreadsheet
            </Button>
          </div>
        </Card>

        <div>
          <Button type="submit" disabled={saving} icon={Save}>{saving ? "Saving..." : "Save changes"}</Button>
          {saved && <p className="text-sm mt-3 font-medium" style={{ color: C.green }}>✓ Saved — your website now shows this.</p>}
          {error && <p className="text-sm mt-3" style={{ color: C.red }}>Couldn't save: {error}</p>}
        </div>
      </form>
    </Layout>
  );
}
