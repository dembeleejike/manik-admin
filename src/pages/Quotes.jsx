import React, { useEffect, useState } from "react";
import { Phone, Trash2, ShoppingCart, X } from "lucide-react";
import { api } from "../api";
import { C } from "../tokens";
import Layout from "../components/Layout";
import { PageHeader, Button, Card, Badge, Field, inputStyle, Loading, EmptyState, ErrorBanner, ExplainerBox, SearchInput } from "../components/ui";

const STATUS_TONE = { New: "red", Contacted: "default", Closed: "green" };

export default function Quotes() {
  const [quotes, setQuotes] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [converting, setConverting] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const [q, p] = await Promise.all([api.listQuotes(), api.listProducts()]);
      setQuotes(q);
      setProducts(p);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function updateStatus(id, status) {
    try {
      await api.updateQuoteStatus(id, status);
      setQuotes((prev) => prev.map((q) => (q._id === id ? { ...q, status } : q)));
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this quote request?")) return;
    try {
      await api.deleteQuote(id);
      setQuotes((prev) => prev.filter((q) => q._id !== id));
    } catch (err) {
      alert(err.message);
    }
  }

  const statusFiltered = filter === "All" ? quotes : quotes.filter((q) => q.status === filter);
  const term = search.trim().toLowerCase();
  const filtered = !term ? statusFiltered : statusFiltered.filter(q =>
    q.name.toLowerCase().includes(term) ||
    (q.product || "").toLowerCase().includes(term) ||
    q.phone.includes(term) ||
    (q.location || "").toLowerCase().includes(term) ||
    new Date(q.createdAt).toLocaleDateString().includes(term)
  );

  return (
    <Layout>
      <PageHeader title="Quote requests — Customers asking about prices" />
      <ExplainerBox>
        When someone fills the "Request a Quote" form on your website, it appears here. Call or WhatsApp them back, then mark it Contacted. If they buy, tap "Convert to sale" so it's properly recorded.
      </ExplainerBox>
      <ErrorBanner message={error} />

      <div className="mb-4"><SearchInput value={search} onChange={setSearch} placeholder="Search name, product, phone, location..." /></div>
      <div className="flex gap-2 mb-5">
        {["All", "New", "Contacted", "Closed"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="text-xs uppercase tracking-wide px-3 py-1.5"
            style={{
              border: `1px solid ${filter === f ? C.safety : "#C9C5BA"}`,
              color: filter === f ? C.safety : "#6B6960",
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <EmptyState message="No quote requests here yet." />
      ) : (
        <div className="space-y-3">
          {filtered.map((q) => (
            <Card key={q._id}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold" style={{ color: C.ink }}>{q.name}</p>
                    <Badge tone={STATUS_TONE[q.status]}>{q.status}</Badge>
                    {q.requestType && <Badge>{q.requestType}</Badge>}
                  </div>
                  <p className="text-sm mt-1 flex items-center gap-1.5" style={{ color: "#6B6960" }}>
                    <Phone size={12} /> {q.phone} · prefers {q.preferredContact}
                  </p>
                  {q.product && <p className="text-sm mt-2" style={{ color: C.ink }}><strong>{q.product}</strong>{q.quantity ? ` — ${q.quantity}` : ""}</p>}
                  {q.location && <p className="text-sm mt-1" style={{ color: "#6B6960" }}>📍 {q.location}</p>}
                  {q.notes && <p className="text-sm mt-1" style={{ color: "#6B6960" }}>{q.notes}</p>}
                  <p className="text-xs mt-2" style={{ color: "#8A877D" }}>{new Date(q.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <select
                    value={q.status}
                    onChange={(e) => updateStatus(q._id, e.target.value)}
                    className="text-xs px-2 py-1.5"
                    style={{ border: "1px solid #C9C5BA", background: "white" }}
                  >
                    <option>New</option>
                    <option>Contacted</option>
                    <option>Closed</option>
                  </select>
                  {q.status !== "Closed" && (
                    <button onClick={() => setConverting(q)} className="text-xs flex items-center gap-1" style={{ color: C.blueprint }}>
                      <ShoppingCart size={12} /> Convert to sale
                    </button>
                  )}
                  <button onClick={() => handleDelete(q._id)} className="text-xs flex items-center gap-1" style={{ color: C.red }}>
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {converting && (
        <ConvertModal
          quote={converting}
          products={products}
          onClose={() => setConverting(null)}
          onSaved={() => { setConverting(null); load(); }}
        />
      )}
    </Layout>
  );
}

function ConvertModal({ quote, products, onClose, onSaved }) {
  const matchingProduct = products.find(p => p.name === quote.product);
  const [productId, setProductId] = useState(matchingProduct?._id || "");
  const [quantity, setQuantity] = useState(quote.quantity?.match(/\d+/)?.[0] || "1");
  const [unitPrice, setUnitPrice] = useState(matchingProduct?.sellingPrice ? String(matchingProduct.sellingPrice) : "");
  const [paymentStatus, setPaymentStatus] = useState("Paid");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!productId || !quantity || !unitPrice) {
      setError("Product, quantity and unit price are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.createSale({
        product: productId, quantity: Number(quantity), unitPrice: Number(unitPrice),
        customerName: quote.name, customerPhone: quote.phone,
        paymentStatus, paymentMethod, fromQuote: quote._id,
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "#00000088" }} onClick={onClose}>
      <div className="max-w-md w-full max-h-[85vh] overflow-y-auto p-6" style={{ background: C.cream }} onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h2 className="font-bold text-lg" style={{ color: C.ink }}>Convert to sale</h2>
          <button onClick={onClose}><X size={18} color={C.ink} /></button>
        </div>
        <p className="text-sm mb-5" style={{ color: "#6B6960" }}>
          Converting {quote.name}'s request. This records a real sale, reduces stock, and marks the quote Closed.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Product">
            <select value={productId} onChange={e => setProductId(e.target.value)} style={inputStyle}>
              <option value="">Select a product</option>
              {products.map(p => <option key={p._id} value={p._id}>{p.name} ({p.quantity} in stock)</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Quantity"><input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} style={inputStyle} /></Field>
            <Field label="Unit price (₦)"><input type="number" min="0" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} style={inputStyle} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Payment status">
              <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)} style={inputStyle}>
                <option>Paid</option><option>Partial</option><option>Unpaid</option>
              </select>
            </Field>
            <Field label="Payment method">
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} style={inputStyle}>
                <option>Cash</option><option>Bank Transfer</option><option>POS</option><option>Other</option>
              </select>
            </Field>
          </div>
          {error && <p className="text-sm" style={{ color: C.red }}>{error}</p>}
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Confirm sale"}</Button>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
