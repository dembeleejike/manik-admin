import React, { useEffect, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { api } from "../api";
import { C } from "../tokens";
import Layout from "../components/Layout";
import { PageHeader, Button, Card, Field, inputStyle, Loading, EmptyState, ErrorBanner, ExplainerBox, SearchInput, PeriodFilter, filterByPeriod } from "../components/ui";

function formatMoney(n) {
  return "₦" + Number(n || 0).toLocaleString();
}

export default function Purchases() {
  const [purchases, setPurchases] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("All");

  async function load() {
    setLoading(true);
    try {
      const [pu, pr] = await Promise.all([api.listPurchases(), api.listProducts()]);
      setPurchases(pu);
      setProducts(pr);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id) {
    if (!confirm("Delete this purchase? Stock quantity will be reduced back.")) return;
    try {
      await api.deletePurchase(id);
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <Layout>
      <PageHeader title="Purchases — Record new stock you bought" action={<Button icon={Plus} onClick={() => setShowForm(true)}>Record purchase</Button>} />
      <ExplainerBox>
        Every time you buy new stock from a supplier, add it here. This automatically adds to how many you have in stock — you don't need to update the product separately.
      </ExplainerBox>
      <ErrorBanner message={error} />

      {loading ? <Loading /> : (() => {
        const filtered = filterByPeriod(purchases, period).filter(p => {
          const term = search.trim().toLowerCase();
          if (!term) return true;
          return p.productName.toLowerCase().includes(term) ||
            (p.supplier || "").toLowerCase().includes(term) ||
            (p.invoiceRef || "").toLowerCase().includes(term) ||
            new Date(p.date).toLocaleDateString().includes(term);
        });
        return (
          <>
            <div className="flex flex-wrap gap-3 items-center justify-between mb-5">
              <SearchInput value={search} onChange={setSearch} placeholder="Search product, supplier, invoice..." />
              <PeriodFilter value={period} onChange={setPeriod} />
            </div>
            {filtered.length === 0 ? (
              <EmptyState message="No purchases match this search." />
            ) : (
              <div className="space-y-2">
                {filtered.map(p => (
                  <Card key={p._id}>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className="font-semibold" style={{ color: C.ink }}>{p.productName}</p>
                        <p className="text-sm mt-1" style={{ color: "#6B6960" }}>
                          +{p.quantity} units @ {formatMoney(p.unitCost)} = <strong style={{ color: C.ink }}>{formatMoney(p.totalCost)}</strong>
                        </p>
                        {p.supplier && <p className="text-sm mt-1" style={{ color: "#6B6960" }}>Supplier: {p.supplier}</p>}
                        <p className="text-xs mt-2" style={{ color: "#8A877D" }}>{new Date(p.date).toLocaleDateString()} {p.invoiceRef && `· Ref: ${p.invoiceRef}`}</p>
                      </div>
                      <button onClick={() => handleDelete(p._id)} className="text-xs flex items-center gap-1" style={{ color: C.red }}>
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        );
      })()}

      {showForm && <PurchaseModal products={products} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </Layout>
  );
}

function PurchaseModal({ products, onClose, onSaved }) {
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [supplier, setSupplier] = useState("");
  const [invoiceRef, setInvoiceRef] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!productId || !quantity || !unitCost) {
      setError("Product, quantity and unit cost are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.createPurchase({ product: productId, quantity: Number(quantity), unitCost: Number(unitCost), supplier, invoiceRef });
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
          <h2 className="font-bold text-lg" style={{ color: C.ink }}>Record a stock purchase</h2>
          <button onClick={onClose}><X size={18} color={C.ink} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Product">
            <select value={productId} onChange={e => setProductId(e.target.value)} style={inputStyle}>
              <option value="">Select a product</option>
              {products.map(p => <option key={p._id} value={p._id}>{p.name} ({p.quantity} in stock)</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Quantity received"><input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} style={inputStyle} /></Field>
            <Field label="Cost per unit (₦)"><input type="number" min="0" value={unitCost} onChange={e => setUnitCost(e.target.value)} style={inputStyle} /></Field>
          </div>
          <Field label="Supplier (optional)"><input value={supplier} onChange={e => setSupplier(e.target.value)} style={inputStyle} /></Field>
          <Field label="Invoice reference (optional)"><input value={invoiceRef} onChange={e => setInvoiceRef(e.target.value)} style={inputStyle} /></Field>
          {error && <p className="text-sm" style={{ color: C.red }}>{error}</p>}
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Record purchase"}</Button>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
