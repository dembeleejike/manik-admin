import React, { useEffect, useState } from "react";
import { Plus, Trash2, X, Printer, Banknote } from "lucide-react";
import { api } from "../api";
import { printReceipt } from "../receipt";
import { C } from "../tokens";
import Layout from "../components/Layout";
import { PageHeader, Button, Card, Badge, Field, inputStyle, Loading, EmptyState, ErrorBanner, ExplainerBox } from "../components/ui";
import { useListView, FilterBar, ExportMenu } from "../components/Filters";
import { useAuth } from "../AuthContext";
import { naira } from "../utils/files";
import { buildSalePdf } from "../utils/documents";
import PdfActions from "../components/PdfActions";

function formatMoney(n) {
  return "₦" + Number(n || 0).toLocaleString();
}

const STATUS_TONE = { Paid: "green", Partial: "default", Unpaid: "red" };

export default function Sales() {
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [paying, setPaying] = useState(null); // the sale a payment is being recorded for
  const { admin } = useAuth();

  async function load() {
    setLoading(true);
    try {
      const [s, p, st] = await Promise.all([api.listSales(), api.listProducts(), api.getSettings().catch(() => null)]);
      setSales(s);
      setProducts(p);
      setSettings(st);
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

  async function handleDeletePayment(saleId, paymentId) {
    if (!confirm("Undo this payment? The sale will show that amount as owed again.")) return;
    try {
      await api.deletePayment(saleId, paymentId);
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

      {loading ? <Loading /> : (
        <SalesList sales={sales} settings={settings} isOwner={admin?.role === "owner"} onDelete={handleDelete} onPay={setPaying} onDeletePayment={handleDeletePayment} />
      )}

      {showForm && <SaleModal products={products} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {paying && <PaymentModal sale={paying} onClose={() => setPaying(null)} onSaved={() => { setPaying(null); load(); }} />}
    </Layout>
  );
}

const SALES_CFG = {
  dateField: "date",
  search: (s) => [s.productName, s.customerName, s.customerPhone, s.product?.category?.name, s.product?.ref, s.notes, s.paymentMethod, s.paymentStatus].join(" "),
  filters: [
    { key: "category", label: "Category", get: (s) => s.product?.category?.name || "" },
    { key: "product", label: "Product", get: (s) => s.productName },
    { key: "status", label: "Payment", get: (s) => s.paymentStatus, options: ["Paid", "Partial", "Unpaid"] },
    { key: "method", label: "Method", get: (s) => s.paymentMethod },
  ],
  sorts: [
    { key: "date", label: "Date", get: (s) => new Date(s.date) },
    { key: "amount", label: "Amount", get: (s) => s.totalAmount },
    { key: "customer", label: "Customer", get: (s) => s.customerName || "" },
    { key: "product", label: "Product", get: (s) => s.productName },
    { key: "qty", label: "Quantity", get: (s) => s.quantity },
    { key: "owed", label: "Balance owed", get: (s) => s.totalAmount - s.amountPaid },
  ],
  defaultSort: "date",
  defaultDir: "desc",
};

const SALES_COLUMNS = [
  { label: "Date", get: (s) => s.date, type: "date" },
  { label: "Customer", get: (s) => s.customerName },
  { label: "Phone", get: (s) => s.customerPhone },
  { label: "Product", get: (s) => s.productName },
  { label: "Category", get: (s) => s.product?.category?.name || "" },
  { label: "Quantity", get: (s) => s.quantity, type: "number" },
  { label: "Unit price", get: (s) => s.unitPrice, type: "money" },
  { label: "Total", get: (s) => s.totalAmount, type: "money" },
  { label: "Amount paid", get: (s) => s.amountPaid, type: "money" },
  { label: "Balance owed", get: (s) => s.totalAmount - s.amountPaid, type: "money" },
  { label: "Payment status", get: (s) => s.paymentStatus },
  { label: "Payment method", get: (s) => s.paymentMethod },
  { label: "Notes", get: (s) => s.notes },
];

// A plain-text receipt that can be sent to the customer on WhatsApp.
function receiptText(s, settings) {
  const owed = s.totalAmount - s.amountPaid;
  return [
    `*${settings?.businessName || "Receipt"}*`,
    `Receipt — ${new Date(s.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`,
    "",
    `${s.quantity} × ${s.productName} @ ${naira(s.unitPrice)}`,
    `Total: ${naira(s.totalAmount)}`,
    `Paid: ${naira(s.amountPaid)} (${s.paymentMethod})`,
    owed > 0 ? `Balance owed: ${naira(owed)}` : "Fully paid ✓",
    "",
    "Thank you for your business.",
  ].join("\n");
}

function SalesList({ sales, settings, isOwner, onDelete, onPay, onDeletePayment }) {
  const view = useListView(sales, SALES_CFG);
  const totalShown = view.rows.reduce((n, s) => n + s.totalAmount, 0);
  const owedShown = view.rows.reduce((n, s) => n + (s.totalAmount - s.amountPaid), 0);
  return (
    <>
      <FilterBar
        view={view} cfg={SALES_CFG} items={sales}
        placeholder="Search customer, product, phone, month…"
        actions={<ExportMenu rows={view.rows} columns={SALES_COLUMNS} filename="manik-sales" sheetName="Sales" title="MANIK sales" />}
      />
      {view.rows.length > 0 && (
        <p className="text-sm mb-4" style={{ color: "#6B6960" }}>
          These sales add up to <strong style={{ color: C.ink }}>{formatMoney(totalShown)}</strong>
          {owedShown > 0 && <> · customers still owe <strong style={{ color: C.red }}>{formatMoney(owedShown)}</strong></>}
        </p>
      )}
      {view.rows.length === 0 ? (
        <EmptyState message={sales.length === 0 ? "No sales recorded yet." : "No sales match these filters."} />
      ) : (
        <div className="space-y-2">
          {view.rows.map((s) => (
            <Card key={s._id}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold" style={{ color: C.ink }}>{s.productName}</p>
                    <Badge tone={STATUS_TONE[s.paymentStatus]}>{s.paymentStatus}</Badge>
                    {s.product?.category?.name && <span className="text-xs" style={{ color: "#8A877D" }}>{s.product.category.name}</span>}
                  </div>
                  <p className="text-sm mt-1" style={{ color: "#6B6960" }}>
                    {s.quantity} units @ {formatMoney(s.unitPrice)} = <strong style={{ color: C.ink }}>{formatMoney(s.totalAmount)}</strong>
                    {s.totalAmount - s.amountPaid > 0 && <span style={{ color: C.red }}> · owes {formatMoney(s.totalAmount - s.amountPaid)}</span>}
                  </p>
                  {s.customerName && <p className="text-sm mt-1" style={{ color: "#6B6960" }}>Customer: {s.customerName} {s.customerPhone && `· ${s.customerPhone}`}</p>}
                  <p className="text-xs mt-2" style={{ color: "#8A877D" }}>{new Date(s.date).toLocaleDateString()} · {s.paymentMethod}</p>
                  {(s.payments || []).length > 0 && (
                    <div className="mt-2 text-xs" style={{ color: "#54524C" }}>
                      {s.payments.map((p) => (
                        <p key={p._id}>
                          + {formatMoney(p.amount)} paid {new Date(p.date).toLocaleDateString()} ({p.method}){p.note ? ` — ${p.note}` : ""}
                          {isOwner && <button onClick={() => onDeletePayment(s._id, p._id)} className="ml-2 underline" style={{ color: C.red }}>undo</button>}
                        </p>
                      ))}
                    </div>
                  )}
                  <div className="mt-3">
                    <PdfActions
                      size="small"
                      title={`Invoice ${s.productName}`}
                      filename={`Invoice-${String(s._id).slice(-8).toUpperCase()}`}
                      build={() => buildSalePdf(s, settings, "invoice")}
                      whatsapp={s.customerPhone ? { phone: s.customerPhone, text: receiptText(s, settings) } : undefined}
                    />
                    {s.paymentStatus !== "Unpaid" && (
                      <div className="mt-2">
                        <PdfActions
                          size="small"
                          title={`Receipt ${s.productName}`}
                          filename={`Receipt-${String(s._id).slice(-8).toUpperCase()}`}
                          build={() => buildSalePdf(s, settings, "receipt")}
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <button onClick={() => printReceipt(s, settings)} className="text-xs flex items-center gap-1" style={{ color: C.blueprint }}>
                    <Printer size={12} /> Print receipt
                  </button>
                  {s.totalAmount - s.amountPaid > 0.005 && (
                    <button onClick={() => onPay(s)} className="text-xs flex items-center gap-1 font-semibold" style={{ color: C.green }}>
                      <Banknote size={12} /> Record payment
                    </button>
                  )}
                  {isOwner && (
                    <button onClick={() => onDelete(s._id)} className="text-xs flex items-center gap-1" style={{ color: C.red }}>
                      <Trash2 size={12} /> Delete
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function PaymentModal({ sale, onClose, onSaved }) {
  const owed = Math.round((sale.totalAmount - sale.amountPaid) * 100) / 100;
  const [amount, setAmount] = useState(String(owed));
  const [method, setMethod] = useState("Cash");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const value = Number(amount);
    if (!value || value <= 0) { setError("Enter the amount received."); return; }
    if (value > owed + 0.005) { setError(`That's more than is owed (${formatMoney(owed)}).`); return; }
    setSaving(true);
    try {
      await api.addPayment(sale._id, { amount: value, method, date, note });
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "#00000088" }} onClick={onClose}>
      <div className="max-w-sm w-full p-6" style={{ background: C.cream }} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-lg" style={{ color: C.ink }}>Record payment</h2>
          <button onClick={onClose} aria-label="Close"><X size={18} color={C.ink} /></button>
        </div>
        <p className="text-sm mb-1" style={{ color: C.ink }}><strong>{sale.productName}</strong>{sale.customerName ? ` — ${sale.customerName}` : ""}</p>
        <p className="text-sm mb-4" style={{ color: "#6B6960" }}>Total {formatMoney(sale.totalAmount)} · paid {formatMoney(sale.amountPaid)} · <strong style={{ color: C.red }}>owes {formatMoney(owed)}</strong></p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Amount received (₦)"><input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} style={inputStyle} autoFocus /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="How paid">
              <select value={method} onChange={(e) => setMethod(e.target.value)} style={inputStyle}>
                {["Cash", "Bank Transfer", "POS", "Other"].map((m) => <option key={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} /></Field>
          </div>
          <Field label="Note (optional)"><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} style={inputStyle} /></Field>
          {error && <p className="text-sm" style={{ color: C.red }}>{error}</p>}
          <div className="flex gap-3">
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save payment"}</Button>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>
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
          {paymentStatus === "Partial" && (
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
