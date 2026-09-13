import React, { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X, Tag } from "lucide-react";
import { api } from "../api";
import { C } from "../tokens";
import Layout from "../components/Layout";
import { PageHeader, Button, Card, Badge, Field, inputStyle, Loading, EmptyState, ErrorBanner, ExplainerBox } from "../components/ui";

const STATUS_OPTIONS = ["In stock", "Low stock", "Made to order", "Out of stock"];

export default function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null); // null = closed, {} = new, {...} = editing existing
  const [showCategories, setShowCategories] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([api.listProducts(), api.listCategories()]);
      setProducts(p);
      setCategories(c);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id) {
    if (!confirm("Delete this product? This can't be undone.")) return;
    try {
      await api.deleteProduct(id);
      setProducts((prev) => prev.filter((p) => p._id !== id));
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <Layout>
      <PageHeader
        title="Products — What you sell"
        action={
          <div className="flex gap-2">
            <Button variant="ghost" icon={Tag} onClick={() => setShowCategories(true)}>Categories</Button>
            <Button icon={Plus} onClick={() => setEditing({})}>Add product</Button>
          </div>
        }
      />
      <ExplainerBox>
        This is your full catalogue — everything customers can see and ask about on the website. Add a new product here once, then use Sales and Purchases pages to track how many you have left.
      </ExplainerBox>
      <ErrorBanner message={error} />

      {loading ? (
        <Loading />
      ) : products.length === 0 ? (
        <EmptyState message="No products yet — click 'Add product' to create the first one." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {products.map((p) => (
            <Card key={p._id} className="flex gap-4">
              <div className="w-20 h-20 shrink-0 flex items-center justify-center text-xs" style={{ background: C.concreteD, color: "#8A877D" }}>
                {p.images?.[0] ? (
                  <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                ) : "No photo"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs" style={{ color: C.blueprint }}>{p.ref}</p>
                    <p className="font-semibold truncate" style={{ color: C.ink }}>{p.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: "#6B6960" }}>{p.category?.name || "Uncategorized"} · {p.quantity ?? 0} in stock</p>
                  </div>
                  <Badge tone={p.status === "In stock" ? "green" : p.status === "Out of stock" ? "red" : "default"}>
                    {p.status}
                  </Badge>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setEditing(p)} className="text-xs flex items-center gap-1" style={{ color: C.blueprint }}>
                    <Pencil size={12} /> Edit
                  </button>
                  <button onClick={() => handleDelete(p._id)} className="text-xs flex items-center gap-1" style={{ color: C.red }}>
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing !== null && (
        <ProductModal
          product={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}

      {showCategories && (
        <CategoriesModal
          categories={categories}
          onClose={() => setShowCategories(false)}
          onChanged={load}
        />
      )}
    </Layout>
  );
}

function CategoriesModal({ categories, onClose, onChanged }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleAdd(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      await api.createCategory(name.trim());
      setName("");
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this category? Products in it will keep it referenced but it won't be selectable for new ones.")) return;
    try {
      await api.deleteCategory(id);
      onChanged();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "#00000088" }} onClick={onClose}>
      <div className="max-w-sm w-full p-6" style={{ background: C.cream }} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h2 className="font-bold text-lg" style={{ color: C.ink }}>Categories</h2>
          <button onClick={onClose}><X size={18} color={C.ink} /></button>
        </div>

        <div className="space-y-2 mb-5 max-h-52 overflow-y-auto">
          {categories.length === 0 && <p className="text-sm" style={{ color: "#8A877D" }}>No categories yet.</p>}
          {categories.map((c) => (
            <div key={c._id} className="flex items-center justify-between text-sm px-3 py-2" style={{ background: "white", border: "1px solid #C9C5BA" }}>
              <span style={{ color: C.ink }}>{c.name}</span>
              <button onClick={() => handleDelete(c._id)}><Trash2 size={13} color={C.red} /></button>
            </div>
          ))}
        </div>

        <form onSubmit={handleAdd} className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category name" style={{ ...inputStyle, flex: 1 }} />
          <Button type="submit" disabled={saving}>Add</Button>
        </form>
        {error && <p className="text-sm mt-2" style={{ color: C.red }}>{error}</p>}
      </div>
    </div>
  );
}

function ProductModal({ product, categories, onClose, onSaved }) {
  const isNew = !product._id;
  const [name, setName] = useState(product.name || "");
  const [ref, setRef] = useState(product.ref || "");
  const [category, setCategory] = useState(product.category?._id || categories[0]?._id || "");
  const [description, setDescription] = useState(product.description || "");
  const [status, setStatus] = useState(product.status || "In stock");
  const [quantity, setQuantity] = useState(product.quantity ?? 0);
  const [costPrice, setCostPrice] = useState(product.costPrice ?? "");
  const [sellingPrice, setSellingPrice] = useState(product.sellingPrice ?? "");
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name || !ref || !category) {
      setError("Name, reference code and category are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("ref", ref);
      formData.append("category", category);
      formData.append("description", description);
      formData.append("status", status);
      formData.append("quantity", quantity);
      formData.append("costPrice", costPrice || 0);
      formData.append("sellingPrice", sellingPrice || 0);
      files.forEach((f) => formData.append("images", f));

      if (isNew) {
        await api.createProduct(formData);
      } else {
        await api.updateProduct(product._id, formData);
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "#00000088" }} onClick={onClose}>
      <div className="max-w-lg w-full max-h-[85vh] overflow-y-auto p-6" style={{ background: C.cream }} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h2 className="font-bold text-lg" style={{ color: C.ink }}>{isNew ? "Add product" : "Edit product"}</h2>
          <button onClick={onClose}><X size={18} color={C.ink} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} /></Field>
          <Field label="Reference code (e.g. AL-SW-014)"><input value={ref} onChange={(e) => setRef(e.target.value)} style={inputStyle} /></Field>
          <Field label="Category">
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
              <option value="">Select a category</option>
              {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={inputStyle} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Stock quantity"><input type="number" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} style={inputStyle} /></Field>
            <Field label="Cost price (₦)"><input type="number" min="0" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} style={inputStyle} /></Field>
            <Field label="Selling price (₦)"><input type="number" min="0" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} style={inputStyle} /></Field>
          </div>
          <p className="text-xs -mt-2" style={{ color: "#8A877D" }}>
            Quantity updates automatically from Purchases and Sales going forward — set it here only for the initial stock count.
          </p>
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label={isNew ? "Photos" : "Add more photos (optional)"}>
            <input type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files))} className="text-sm" />
          </Field>

          {error && <p className="text-sm" style={{ color: C.red }}>{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save product"}</Button>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
