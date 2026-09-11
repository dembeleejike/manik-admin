import React, { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X, MapPin } from "lucide-react";
import { api } from "../api";
import { C } from "../tokens";
import Layout from "../components/Layout";
import { PageHeader, Button, Card, Field, inputStyle, Loading, EmptyState, ErrorBanner } from "../components/ui";

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);

  async function load() {
    setLoading(true);
    try {
      setProjects(await api.listProjects());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id) {
    if (!confirm("Delete this project from the gallery?")) return;
    try {
      await api.deleteProject(id);
      setProjects((prev) => prev.filter((p) => p._id !== id));
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <Layout>
      <PageHeader title="Projects" action={<Button icon={Plus} onClick={() => setEditing({})}>Add project</Button>} />
      <ErrorBanner message={error} />

      {loading ? (
        <Loading />
      ) : projects.length === 0 ? (
        <EmptyState message="No completed projects added yet." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Card key={p._id}>
              <div className="w-full h-32 mb-3 flex items-center justify-center text-xs" style={{ background: C.concreteD, color: "#8A877D" }}>
                {p.images?.[0] ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" /> : "No photo"}
              </div>
              <p className="text-xs flex items-center gap-1" style={{ color: C.safety }}><MapPin size={11} /> {p.location}</p>
              <p className="font-semibold mt-1" style={{ color: C.ink }}>{p.name}</p>
              {p.tag && <p className="text-xs mt-1" style={{ color: "#6B6960" }}>{p.tag}</p>}
              <div className="flex gap-2 mt-3">
                <button onClick={() => setEditing(p)} className="text-xs flex items-center gap-1" style={{ color: C.blueprint }}>
                  <Pencil size={12} /> Edit
                </button>
                <button onClick={() => handleDelete(p._id)} className="text-xs flex items-center gap-1" style={{ color: C.red }}>
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing !== null && (
        <ProjectModal project={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
    </Layout>
  );
}

function ProjectModal({ project, onClose, onSaved }) {
  const isNew = !project._id;
  const [name, setName] = useState(project.name || "");
  const [location, setLocation] = useState(project.location || "");
  const [tag, setTag] = useState(project.tag || "");
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name || !location) {
      setError("Name and location are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("location", location);
      formData.append("tag", tag);
      files.forEach((f) => formData.append("images", f));

      if (isNew) await api.createProject(formData);
      else await api.updateProject(project._id, formData);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "#00000088" }} onClick={onClose}>
      <div className="max-w-md w-full max-h-[85vh] overflow-y-auto p-6" style={{ background: C.cream }} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h2 className="font-bold text-lg" style={{ color: C.ink }}>{isNew ? "Add project" : "Edit project"}</h2>
          <button onClick={onClose}><X size={18} color={C.ink} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Project name"><input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} /></Field>
          <Field label="Location"><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Suleja, Niger State" style={inputStyle} /></Field>
          <Field label="Tag (optional)"><input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="e.g. Windows & doors" style={inputStyle} /></Field>
          <Field label={isNew ? "Photos" : "Add more photos (optional)"}>
            <input type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files))} className="text-sm" />
          </Field>
          {error && <p className="text-sm" style={{ color: C.red }}>{error}</p>}
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save project"}</Button>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
