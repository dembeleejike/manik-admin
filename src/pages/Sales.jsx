import React, { useEffect, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { api } from "../api";
import { C } from "../tokens";
import Layout from "../components/Layout";
import { PageHeader, Button, Card, Badge, Field, inputStyle, Loading, EmptyState, ErrorBanner, ExplainerBox } from "../components/ui";

function formatMoney(n) {
  return "₦" + Number(n || 0).toLocaleString();
}

const STATUS_TONE = { Paid: "green", Partial: "default", Unpaid: "red" };

export default function Sales() {
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [s, p] = await Promise.all([api.listSales(), api.listProducts()]);
      setSales(s);
      setProducts(p);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id) {
    if (!confirm("Delete this sale? Stock quantity will be restored.")) return;
    try {
      await api.deleteSale(id);
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <Layout>
      <PageHeader title="Sales — Record what you sold" action={<Button icon={Plus} onClick={() => setShowForm(true)}>Record sale</Button>} />
      <ExplainerBox>
        Every time you sell something, add it here. This automatically reduces how many you have left in stock, and it's how the Reports page knows how much money came in.
      </ExplainerBox>
      <ErrorBanner message={error} />

      {loading ? <Loading /> : sales.length === 0 ? (
        <EmptyState message="No sales recorded yet." />
      ) : (
        <div className="space-y-2">
          {sales.map(s => (
            <Card key={s._id}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold" style={{ color: C.ink }}>{s.productName}</p>
                    <Badge tone={STATUS_TONE[s.paymentStatus]}>{s.paymentStatus}</Badge>
                  </div>
                  <p className="text-sm mt-1" style={{ color: "#6B6960" }}>
                    {s.quantity} units @ {formatMoney(s.unitPrice)} = <strong style={{ color: C.ink }}>{formatMoney(s.totalAmount)}</strong>
                  </p>
                  {s.customerName && <p className="text-sm mt-1" style={{ color: "#6B6960" }}>Customer: {s.customerName} {s.customerPhone && `· ${s.customerPhone}`}</p>}
                  <p className="text-xs mt-2" style={{ color: "#8A877D" }}>{new Date(s.date).toLocaleDateString()} · {s.paymentMethod}</p>
                </div>
                <button onClick={() => handleDelete(s._id)} className="text-xs flex items-center gap-1" style={{ color: C.red }}>
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showForm && <SaleModal products={products} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </Layout>
  );
}

function SaleModal({ products, onClose, onSaved }) {
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("Paid");
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedProduct = products.find(p => p._id === productId);

  function handleProductChange(id) {
    setProductId(id);
    const p = products.find(x => x._id === id);
    if (p?.sellingPrice) setUnitPrice(String(p.sellingPrice));
  }

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
        customerName, customerPhone, paymentStatus,
        amountPaid: amountPaid ? Number(amountPaid) : undefined, paymentMethod,
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
          <h2 className="font-bold text-lg" style={{ color: C.ink }}>Record a sale</h2>
          <button onClick={onClose}><X size={18} color={C.ink} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Product">
            <select value={productId} onChange={e => handleProductChange(e.target.value)} style={inputStyle}>
              <option value="">Select a product</option>
              {products.map(p => <option key={p._id} value={p._id}>{p.name} ({p.quantity} in stock)</option>)}
            </select>
            {selectedProduct && <p className="text-xs mt-1" style={{ color: "#8A877D" }}>{selectedProduct.quantity} currently in stock</p>}
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Quantity"><input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} style={inputStyle} /></Field>
            <Field label="Unit price (₦)"><input type="number" min="0" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} style={inputStyle} /></Field>
          </div>
          <Field label="Customer name (optional)"><input value={customerName} onChange={e => setCustomerName(e.target.value)} style={inputStyle} /></Field>
          <Field label="Customer phone (optional)"><input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} style={inputStyle} /></Field>
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
          {paymentStatus !== "Paid" && (
            <Field label="Amount paid so far (₦)"><input type="number" min="0" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} style={inputStyle} /></Field>
          )}
          {error && <p className="text-sm" style={{ color: C.red }}>{error}</p>}
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Record sale"}</Button>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
