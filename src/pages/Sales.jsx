import React, { useEffect, useState } from "react";
import { Plus, Trash2, X, Printer, Banknote, RotateCcw } from "lucide-react";
import { api } from "../api";
import { printReceipt } from "../receipt";
import { C } from "../tokens";
import Layout from "../components/Layout";
import { PageHeader, Button, Card, Badge, Field, inputStyle, Loading, EmptyState, ErrorBanner, ExplainerBox } from "../components/ui";
import { useListView, FilterBar, ExportMenu } from "../components/Filters";
import { useAuth } from "../AuthContext";
import { naira } from "../utils/files";
import { saleNet, returnLimits } from "../utils/saleMath";
import useLocations from "../components/useLocations";
import { qtyAt, unassigned, defaultLocationId } from "../utils/stockPlaces";
import { buildSalePdf } from "../utils/documents";
import PdfActions from "../components/PdfActions";

function formatMoney(n) {
  return "₦" + Number(n || 0).toLocaleString();
}

const STATUS_TONE = { Paid: "green", Partial: "default", Unpaid: "red" };
const METHODS = ["Cash", "Bank Transfer", "POS", "Other"];

export default function Sales() {
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [paying, setPaying] = useState(null); // the sale a payment is being recorded for
  const [returning, setReturning] = useState(null); // the sale goods are being returned from
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

  async function handleDeleteReturn(saleId, returnId) {
    if (!confirm("Undo this return? The goods are taken back off the shelf and the sale goes back to how it was.")) return;
    try {
      await api.deleteReturn(saleId, returnId);
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <Layout>
      <PageHeader title="Sales — Record what you sold" action={<Button icon={Plus} onClick={() => setShowForm(true)}>Record sale</Button>} />
      <ExplainerBox>
        Every time you sell something, add it here. This automatically reduces how many you have left in stock, and it's how the Reports page knows how much money came in. If a customer brings goods back, press <strong>Return</strong> on that sale — stock and money follow automatically.
      </ExplainerBox>
      <ErrorBanner message={error} />

      {loading ? <Loading /> : (
        <SalesList sales={sales} settings={settings} isOwner={admin?.isOwner} onDelete={handleDelete} onPay={setPaying} onReturn={setReturning} onDeletePayment={handleDeletePayment} onDeleteReturn={handleDeleteReturn} />
      )}

      {showForm && <SaleModal products={products} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {returning && <ReturnModal sale={returning} onClose={() => setReturning(null)} onSaved={() => { setReturning(null); load(); }} />}
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
    { key: "returned", label: "Returns", get: (s) => (saleNet(s).fullyReturned ? "Fully returned" : saleNet(s).hasReturns ? "Part returned" : "No returns"), options: ["No returns", "Part returned", "Fully returned"] },
    { key: "method", label: "Method", get: (s) => s.paymentMethod },
    { key: "location", label: "Sold from", get: (s) => s.locationName || "" },
  ],
  sorts: [
    { key: "date", label: "Date", get: (s) => new Date(s.date) },
    { key: "amount", label: "Amount", get: (s) => saleNet(s).total },
    { key: "customer", label: "Customer", get: (s) => s.customerName || "" },
    { key: "product", label: "Product", get: (s) => s.productName },
    { key: "qty", label: "Quantity", get: (s) => saleNet(s).qty },
    { key: "owed", label: "Balance owed", get: (s) => saleNet(s).owed },
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
  { label: "Sold from", get: (s) => s.locationName },
  { label: "Quantity", get: (s) => s.quantity, type: "number" },
  { label: "Unit price", get: (s) => s.unitPrice, type: "money" },
  { label: "Total", get: (s) => s.totalAmount, type: "money" },
  { label: "Qty returned", get: (s) => s.returnedQuantity || 0, type: "number" },
  { label: "Value returned", get: (s) => s.returnedAmount || 0, type: "money" },
  { label: "Net total", get: (s) => saleNet(s).total, type: "money" },
  { label: "Amount paid", get: (s) => s.amountPaid, type: "money" },
  { label: "Refunded", get: (s) => s.refundedAmount || 0, type: "money" },
  { label: "Balance owed", get: (s) => saleNet(s).owed, type: "money" },
  { label: "Payment status", get: (s) => s.paymentStatus },
  { label: "Payment method", get: (s) => s.paymentMethod },
  { label: "Notes", get: (s) => s.notes },
];

// A plain-text receipt that can be sent to the customer on WhatsApp.
function receiptText(s, settings) {
  const n = saleNet(s);
  const owed = n.owed;
  return [
    `*${settings?.businessName || "Receipt"}*`,
    `Receipt — ${new Date(s.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`,
    "",
    `${s.quantity} × ${s.productName} @ ${naira(s.unitPrice)}`,
    `Total: ${naira(s.totalAmount)}`,
    ...(n.hasReturns ? [`Returned: ${n.returnedQty} unit(s), credit ${naira(n.returnedAmt)}`, `Net total: ${naira(n.total)}`] : []),
    `Paid: ${naira(s.amountPaid)} (${s.paymentMethod})`,
    ...(n.refunded > 0 ? [`Refunded: ${naira(n.refunded)}`] : []),
    owed > 0 ? `Balance owed: ${naira(owed)}` : "Fully paid ✓",
    "",
    "Thank you for your business.",
  ].join("\n");
}

function SalesList({ sales, settings, isOwner, onDelete, onPay, onReturn, onDeletePayment, onDeleteReturn }) {
  const view = useListView(sales, SALES_CFG);
  const totalShown = view.rows.reduce((n, s) => n + saleNet(s).total, 0);
  const owedShown = view.rows.reduce((n, s) => n + saleNet(s).owed, 0);
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
          {view.rows.map((s) => { const net = saleNet(s); return (
            <Card key={s._id}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold" style={{ color: C.ink }}>{s.productName}</p>
                    <Badge tone={STATUS_TONE[s.paymentStatus]}>{s.paymentStatus}</Badge>
                    {net.hasReturns && <Badge tone="red">{net.fullyReturned ? "Fully returned" : "Part returned"}</Badge>}
                    {s.product?.category?.name && <span className="text-xs" style={{ color: "#8A877D" }}>{s.product.category.name}</span>}
                  </div>
                  <p className="text-sm mt-1" style={{ color: "#6B6960" }}>
                    {s.quantity} units @ {formatMoney(s.unitPrice)} = <strong style={{ color: C.ink }}>{formatMoney(s.totalAmount)}</strong>
                    {net.hasReturns && <> · after returns <strong style={{ color: C.ink }}>{formatMoney(net.total)}</strong></>}
                    {net.owed > 0.005 && <span style={{ color: C.red }}> · owes {formatMoney(net.owed)}</span>}
                    {net.credit > 0.005 && <span style={{ color: C.green }}> · customer is owed {formatMoney(net.credit)}</span>}
                  </p>
                  {s.customerName && <p className="text-sm mt-1" style={{ color: "#6B6960" }}>Customer: {s.customerName} {s.customerPhone && `· ${s.customerPhone}`}</p>}
                  <p className="text-xs mt-2" style={{ color: "#8A877D" }}>{new Date(s.date).toLocaleDateString()} · {s.paymentMethod}{s.locationName ? ` · from ${s.locationName}` : ""}</p>
                  {(s.returns || []).length > 0 && (
                    <div className="mt-2 text-xs" style={{ color: "#8A3B12" }}>
                      {s.returns.map((r) => (
                        <p key={r._id}>
                          ↩ {r.quantity} returned {new Date(r.date).toLocaleDateString()} — credit {formatMoney(r.amount)}
                          {r.refund > 0 ? `, refunded ${formatMoney(r.refund)} (${r.refundMethod})` : ""}
                          {r.restocked ? ` · back in ${r.locationName || "stock"}` : " · not restocked"}
                          {r.reason ? ` · ${r.reason}` : ""}
                          {isOwner && <button onClick={() => onDeleteReturn(s._id, r._id)} className="ml-2 underline" style={{ color: C.red }}>undo</button>}
                        </p>
                      ))}
                    </div>
                  )}
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
                  {!net.fullyReturned && (
                    <button onClick={() => onReturn(s)} className="text-xs flex items-center gap-1 font-semibold" style={{ color: "#8A3B12" }}>
                      <RotateCcw size={12} /> Return
                    </button>
                  )}
                  {net.owed > 0.005 && (
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
          ); })}
        </div>
      )}
    </>
  );
}

function PaymentModal({ sale, onClose, onSaved }) {
  const owed = saleNet(sale).owed;
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
        <p className="text-sm mb-4" style={{ color: "#6B6960" }}>Total {formatMoney(saleNet(sale).total)} · paid {formatMoney(saleNet(sale).paid)} · <strong style={{ color: C.red }}>owes {formatMoney(owed)}</strong></p>
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

function ReturnModal({ sale, onClose, onSaved }) {
  const { activeLocations } = useLocations();
  const net = saleNet(sale);
  const [quantity, setQuantity] = useState(String(net.qty));
  const [amount, setAmount] = useState(null); // null = follow quantity × price automatically
  const [refund, setRefund] = useState(null); // null = refund whatever the customer has overpaid
  const [refundMethod, setRefundMethod] = useState(sale.paymentMethod || "Cash");
  const [restock, setRestock] = useState(true);
  const [locationId, setLocationId] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const lim = returnLimits(sale, quantity);
  const shownAmount = amount ?? lim.defaultAmount;
  const maxRefund = lim.maxRefundFor(shownAmount);
  const shownRefund = refund ?? maxRefund;
  const backTo = locationId || sale.location || defaultLocationId(activeLocations, "selling") || "";
  const afterOwed = Math.max(0, Math.round((lim.leftValue - Number(shownAmount || 0) - (lim.netPaid - Number(shownRefund || 0))) * 100) / 100);
  const afterCredit = Math.max(0, Math.round((lim.netPaid - Number(shownRefund || 0) - (lim.leftValue - Number(shownAmount || 0))) * 100) / 100);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const q = Number(quantity);
    if (!q || q <= 0) { setError("Enter how many are coming back."); return; }
    if (q > lim.leftQty + 0.00005) { setError(`Only ${lim.leftQty} can still be returned on this sale.`); return; }
    if (Number(shownAmount) > lim.leftValue + 0.005) { setError(`The credit can't be more than ${formatMoney(lim.leftValue)}.`); return; }
    if (Number(shownRefund) > maxRefund + 0.005) { setError(maxRefund > 0 ? `You can refund at most ${formatMoney(maxRefund)}.` : "Nothing can be refunded — the customer hasn't paid more than they still owe. Set the refund to 0."); return; }
    setSaving(true);
    try {
      await api.addReturn(sale._id, {
        quantity: q, amount: Number(shownAmount), refund: Number(shownRefund), refundMethod,
        restock, location: restock ? backTo || undefined : undefined, reason, note, date,
      });
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "#00000088" }} onClick={onClose}>
      <div className="max-w-md w-full max-h-[88vh] overflow-y-auto p-6" style={{ background: C.cream }} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-lg" style={{ color: C.ink }}>Return goods</h2>
          <button onClick={onClose} aria-label="Close"><X size={18} color={C.ink} /></button>
        </div>
        <p className="text-sm mb-1" style={{ color: C.ink }}><strong>{sale.productName}</strong>{sale.customerName ? ` — ${sale.customerName}` : ""}</p>
        <p className="text-sm mb-4" style={{ color: "#6B6960" }}>
          Sold {sale.quantity} @ {formatMoney(sale.unitPrice)} · paid {formatMoney(net.paid)}
          {net.hasReturns && ` · already returned ${net.returnedQty}`} · <strong style={{ color: C.ink }}>{net.qty} can still come back</strong>
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity coming back"><input type="number" min="0" step="any" max={net.qty} value={quantity} onChange={(e) => { setQuantity(e.target.value); setAmount(null); setRefund(null); }} style={inputStyle} autoFocus /></Field>
            <Field label="Credit for them (₦)"><input type="number" min="0" step="0.01" value={shownAmount} onChange={(e) => { setAmount(e.target.value); setRefund(null); }} style={inputStyle} /></Field>
          </div>
          <p className="text-xs -mt-2" style={{ color: "#8A877D" }}>The credit is worth the returned goods (quantity × price). Lower it to keep a restocking fee.</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setRefund(null)} className="text-xs px-3 py-2" style={{ border: `1px solid ${refund === null || Number(refund) > 0 ? C.safety : "#C9C5BA"}`, color: refund === null || Number(refund) > 0 ? C.safety : "#6B6960" }}>Give money back</button>
            <button type="button" onClick={() => setRefund("0")} className="text-xs px-3 py-2" style={{ border: `1px solid ${refund !== null && Number(refund) === 0 ? C.safety : "#C9C5BA"}`, color: refund !== null && Number(refund) === 0 ? C.safety : "#6B6960" }}>No refund (lower balance / keep credit)</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Money handed back (₦)"><input type="number" min="0" step="0.01" value={shownRefund} onChange={(e) => setRefund(e.target.value)} style={inputStyle} /></Field>
            <Field label="Refunded by">
              <select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)} style={inputStyle}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select>
            </Field>
          </div>
          <p className="text-xs -mt-2" style={{ color: "#8A877D" }}>
            {maxRefund > 0 ? `Up to ${formatMoney(maxRefund)} can be refunded. Set 0 to keep it as credit for the customer.` : "Nothing to refund: the customer hasn't paid more than they still owe, so their balance simply drops."}
          </p>
          <div className="p-3 text-sm" style={{ background: "white", border: "1px solid #C9C5BA" }}>
            {afterOwed > 0.005 ? <span style={{ color: C.red }}>After this the customer still owes {formatMoney(afterOwed)}.</span>
              : afterCredit > 0.005 ? <span style={{ color: C.green }}>After this the shop owes the customer {formatMoney(afterCredit)} (credit).</span>
              : <span style={{ color: C.green }}>After this the sale is settled — nothing owed either way.</span>}
          </div>
          <label className="flex items-center gap-2 text-sm" style={{ color: C.ink }}>
            <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} />
            Put the goods back in stock (untick if damaged or not resellable)
          </label>
          {restock && (
            <Field label="Where are the returned goods being kept?">
              <select value={backTo} onChange={(e) => setLocationId(e.target.value)} style={inputStyle}>
                {activeLocations.map((l) => <option key={l._id} value={l._id}>{l.name}{l._id === sale.location ? " (where it was sold from)" : ""}</option>)}
              </select>
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Reason (optional)"><input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} list="return-reasons" placeholder="e.g. wrong size" style={inputStyle} /><datalist id="return-reasons">{["Wrong size", "Wrong colour / type", "Damaged", "Customer changed mind", "Ordered too many"].map((r) => <option key={r} value={r} />)}</datalist></Field>
            <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} /></Field>
          </div>
          <Field label="Note (optional)"><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} style={inputStyle} /></Field>
          {error && <p className="text-sm" style={{ color: C.red }}>{error}</p>}
          <div className="flex gap-3">
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Confirm return"}</Button>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SaleModal({ products, onClose, onSaved }) {
  const { activeLocations } = useLocations();
  const [locationId, setLocationId] = useState("");
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
  const sellFrom = locationId || defaultLocationId(activeLocations, "selling"); // the shop unless another place is chosen
  const sellFromName = activeLocations.find((l) => l._id === sellFrom)?.name || "";
  const sellingId = defaultLocationId(activeLocations, "selling");
  // stock that has no place yet counts as being in the selling location (that is where it is taken from)
  const availableAt = (p) => qtyAt(p, sellFrom) + (sellFrom === sellingId ? unassigned(p) : 0);

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
        product: productId, location: sellFrom || undefined, quantity: Number(quantity), unitPrice: Number(unitPrice),
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
          {activeLocations.length > 1 && (
            <Field label="Sold from">
              <select value={sellFrom} onChange={e => setLocationId(e.target.value)} style={inputStyle}>
                {activeLocations.map(l => <option key={l._id} value={l._id}>{l.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Product">
            <select value={productId} onChange={e => handleProductChange(e.target.value)} style={inputStyle}>
              <option value="">Select a product</option>
              {products.map(p => <option key={p._id} value={p._id}>{p.name} ({availableAt(p)} at {sellFromName || "the shop"})</option>)}
            </select>
            {selectedProduct && (
              <p className="text-xs mt-1" style={{ color: availableAt(selectedProduct) <= 0 ? C.red : "#8A877D" }}>
                {availableAt(selectedProduct)} at {sellFromName}
                {(selectedProduct.quantity ?? 0) - availableAt(selectedProduct) > 0 && ` · ${(selectedProduct.quantity ?? 0) - availableAt(selectedProduct)} more in other places${availableAt(selectedProduct) <= 0 ? " — move some here first (Stock on hand → Move stock)" : ""}`}
              </p>
            )}
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
