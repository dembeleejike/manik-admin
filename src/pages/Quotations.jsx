import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, X, Trash2, Pencil, ShoppingCart, Check } from "lucide-react";
import { api } from "../api";
import { C } from "../tokens";
import Layout from "../components/Layout";
import { PageHeader, Button, Card, Badge, Field, inputStyle, Loading, EmptyState, ErrorBanner, ExplainerBox, formatMoney } from "../components/ui";
import { useListView, FilterBar, ExportMenu } from "../components/Filters";
import PdfActions from "../components/PdfActions";
import { useAuth } from "../AuthContext";
import { buildQuotationPdf } from "../utils/documents";
import { naira } from "../utils/files";

const STATUS_TONE = { Draft: "default", Sent: "default", Accepted: "green", Declined: "red", Converted: "green" };

const total = (q) => q.lines.reduce((n, l) => n + l.quantity * l.unitPrice, 0) - (q.discount || 0);
const isExpired = (q) => ["Draft", "Sent"].includes(q.status) && q.validUntil && new Date(q.validUntil) < new Date(new Date().toDateString());

const CFG = {
  dateField: "createdAt",
  search: (q) => [q.number, q.customerName, q.customerPhone, q.customerLocation, q.status, q.notes, ...q.lines.map((l) => l.description)].join(" "),
  filters: [
    { key: "status", label: "Status", get: (q) => q.status, options: ["Draft", "Sent", "Accepted", "Declined", "Converted"] },
    { key: "customer", label: "Customer", get: (q) => q.customerName },
  ],
  sorts: [
    { key: "date", label: "Date", get: (q) => new Date(q.createdAt) },
    { key: "total", label: "Total", get: (q) => total(q) },
    { key: "customer", label: "Customer", get: (q) => q.customerName },
    { key: "valid", label: "Valid until", get: (q) => (q.validUntil ? new Date(q.validUntil) : null) },
  ],
  defaultSort: "date",
  defaultDir: "desc",
};

const COLUMNS = [
  { label: "Number", get: (q) => q.number },
  { label: "Date", get: (q) => q.createdAt, type: "date" },
  { label: "Customer", get: (q) => q.customerName },
  { label: "Phone", get: (q) => q.customerPhone },
  { label: "Items", get: (q) => q.lines.map((l) => `${l.quantity} × ${l.description}`).join("; ") },
  { label: "Total", get: (q) => total(q), type: "money" },
  { label: "Valid until", get: (q) => q.validUntil, type: "date" },
  { label: "Status", get: (q) => q.status },
];

function whatsappText(q, settings) {
  return [
    `Hello ${q.customerName},`,
    "",
    `Here is your quotation ${q.number} from ${settings?.businessName || "us"}.`,
    ...q.lines.map((l) => `• ${l.quantity} × ${l.description} — ${naira(l.quantity * l.unitPrice)}`),
    q.discount > 0 ? `Discount: -${naira(q.discount)}` : null,
    `*Total: ${naira(total(q))}*`,
    q.validUntil ? `Valid until ${new Date(q.validUntil).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.` : null,
    "",
    "Please reply to confirm and we will prepare your order. Thank you!",
  ].filter((l) => l !== null).join("\n");
}

export default function Quotations() {
  const [quotations, setQuotations] = useState([]);
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState(null); // null | { quotation?, prefill? }
  const [converting, setConverting] = useState(null);
  const [params, setParams] = useSearchParams();
  const { admin } = useAuth();

  async function load() {
    try {
      const [qs, ps, st] = await Promise.all([api.listQuotations(), api.listProducts(), api.getSettings().catch(() => null)]);
      setQuotations(qs); setProducts(ps); setSettings(st);
      return { ps };
    } catch (err) {
      setError(err.message);
      return {};
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().then(async ({ ps }) => {
      // Arrived from a website enquiry ("Create quotation" on the Quote requests page)
      const fromQuote = params.get("fromQuote");
      if (!fromQuote || !ps) return;
      try {
        const enquiries = await api.listQuotes();
        const enquiry = enquiries.find((q) => q._id === fromQuote);
        if (enquiry) setEditor({ prefill: prefillFromEnquiry(enquiry, ps) });
      } catch { /* the editor just opens empty */ }
      setParams({}, { replace: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function setStatus(q, status) {
    try { await api.setQuotationStatus(q._id, status); load(); } catch (err) { alert(err.message); }
  }
  async function handleDelete(q) {
    if (!confirm(`Delete quotation ${q.number}? This can't be undone.`)) return;
    try { await api.deleteQuotation(q._id); load(); } catch (err) { alert(err.message); }
  }

  return (
    <Layout>
      <PageHeader title="Quotations — Prices you send to customers" action={<Button icon={Plus} onClick={() => setEditor({})}>New quotation</Button>} />
      <ExplainerBox>
        Build a priced quotation for a customer, then download it as a PDF or send it on WhatsApp. When they accept, press <strong>Convert to sales</strong> — the stock items become real sales (stock goes down automatically) and any deposit is recorded.
      </ExplainerBox>
      <ErrorBanner message={error} />

      {loading ? <Loading /> : (
        <QuotationList
          quotations={quotations} settings={settings} isOwner={admin?.role === "owner"}
          onEdit={(q) => setEditor({ quotation: q })} onStatus={setStatus} onConvert={setConverting} onDelete={handleDelete}
        />
      )}

      {editor && (
        <QuotationEditor
          quotation={editor.quotation} prefill={editor.prefill} products={products}
          onClose={() => setEditor(null)} onSaved={() => { setEditor(null); load(); }}
        />
      )}
      {converting && (
        <ConvertModal quotation={converting} onClose={() => setConverting(null)} onDone={() => { setConverting(null); load(); }} />
      )}
    </Layout>
  );
}

function prefillFromEnquiry(enquiry, products) {
  const needle = (enquiry.product || "").toLowerCase().trim();
  const match = needle ? products.find((p) => p.name.toLowerCase() === needle) || products.find((p) => p.name.toLowerCase().includes(needle) || needle.includes(p.name.toLowerCase())) : null;
  const qty = parseFloat(String(enquiry.quantity || "").replace(/[^0-9.]/g, "")) || 1;
  return {
    customerName: enquiry.name, customerPhone: enquiry.phone, customerLocation: enquiry.location || "",
    notes: enquiry.notes ? `Customer's request: ${enquiry.notes}` : "", fromQuote: enquiry._id,
    lines: [{
      description: match ? match.name : enquiry.product || "", product: match ? match._id : "", quantity: qty, unitPrice: match ? match.sellingPrice || 0 : 0,
    }],
  };
}

function QuotationList({ quotations, settings, isOwner, onEdit, onStatus, onConvert, onDelete }) {
  const view = useListView(quotations, CFG);
  if (quotations.length === 0) return <EmptyState message="No quotations yet. Press “New quotation” to make your first one." />;
  return (
    <>
      <FilterBar
        view={view} cfg={CFG} items={quotations}
        placeholder="Search customer, number, item…"
        actions={<ExportMenu rows={view.rows} columns={COLUMNS} filename="manik-quotations" sheetName="Quotations" title="MANIK quotations" />}
      />
      {view.rows.length === 0 ? <EmptyState message="No quotations match these filters." /> : (
        <div className="space-y-3">
          {view.rows.map((q) => (
            <Card key={q._id}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold" style={{ color: C.ink }}>{q.number} — {q.customerName}</p>
                    <Badge tone={STATUS_TONE[q.status]}>{q.status}</Badge>
                    {isExpired(q) && <Badge tone="red">Expired</Badge>}
                  </div>
                  <p className="text-sm mt-1" style={{ color: "#6B6960" }}>
                    {q.lines.length} item{q.lines.length === 1 ? "" : "s"} · <strong style={{ color: C.ink }}>{formatMoney(total(q))}</strong>
                    {q.customerPhone && ` · ${q.customerPhone}`}
                  </p>
                  <p className="text-xs mt-1" style={{ color: "#8A877D" }}>
                    Created {new Date(q.createdAt).toLocaleDateString()}{q.validUntil && ` · valid until ${new Date(q.validUntil).toLocaleDateString()}`}
                  </p>
                </div>
                <PdfActions
                  size="small" title={`Quotation ${q.number}`} filename={`Quotation-${q.number}`}
                  build={() => buildQuotationPdf(q, settings)}
                  whatsapp={q.customerPhone ? { phone: q.customerPhone, text: whatsappText(q, settings) } : undefined}
                />
              </div>

              <div className="flex flex-wrap gap-2 mt-4 pt-3" style={{ borderTop: `1px solid ${C.ink}14` }}>
                {["Draft", "Sent", "Accepted"].includes(q.status) && (
                  <>
                    {q.status === "Draft" && <MiniButton onClick={() => onStatus(q, "Sent")}>Mark as sent</MiniButton>}
                    {q.status !== "Accepted" && <MiniButton onClick={() => onStatus(q, "Accepted")} icon={Check}>Customer accepted</MiniButton>}
                    <MiniButton onClick={() => onStatus(q, "Declined")}>Customer declined</MiniButton>
                    <MiniButton onClick={() => onEdit(q)} icon={Pencil}>Edit</MiniButton>
                    <MiniButton onClick={() => onConvert(q)} icon={ShoppingCart} strong>Convert to sales</MiniButton>
                  </>
                )}
                {q.status === "Declined" && <MiniButton onClick={() => onStatus(q, "Draft")}>Reopen as draft</MiniButton>}
                {isOwner && <MiniButton onClick={() => onDelete(q)} icon={Trash2} danger>Delete</MiniButton>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function MiniButton({ children, onClick, icon: Icon, strong, danger }) {
  return (
    <button
      type="button" onClick={onClick}
      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5"
      style={{
        border: `1px solid ${danger ? C.red + "55" : strong ? C.safety : C.ink + "33"}`,
        color: danger ? C.red : strong ? "white" : C.ink, background: strong ? C.safety : "transparent",
      }}
    >
      {Icon && <Icon size={12} />} {children}
    </button>
  );
}

const blankLine = () => ({ description: "", product: "", quantity: 1, unitPrice: 0 });

function QuotationEditor({ quotation, prefill, products, onClose, onSaved }) {
  const initial = quotation || prefill || {};
  const [customerName, setCustomerName] = useState(initial.customerName || "");
  const [customerPhone, setCustomerPhone] = useState(initial.customerPhone || "");
  const [customerLocation, setCustomerLocation] = useState(initial.customerLocation || "");
  const [lines, setLines] = useState(
    initial.lines && initial.lines.length
      ? initial.lines.map((l) => ({ description: l.description, product: l.product || "", quantity: l.quantity, unitPrice: l.unitPrice }))
      : [blankLine()]
  );
  const [discount, setDiscount] = useState(initial.discount ? String(initial.discount) : "");
  const [validUntil, setValidUntil] = useState(initial.validUntil ? new Date(initial.validUntil).toISOString().slice(0, 10) : new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10));
  const [notes, setNotes] = useState(initial.notes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const subtotal = useMemo(() => lines.reduce((n, l) => n + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0), [lines]);
  const grand = subtotal - (Number(discount) || 0);

  const setLine = (i, patch) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  function pickProduct(i, productId) {
    const p = products.find((x) => x._id === productId);
    if (!p) { setLine(i, { product: "" }); return; }
    setLine(i, { product: p._id, description: p.name, unitPrice: p.sellingPrice || 0 });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!customerName.trim()) { setError("Enter the customer's name."); return; }
    const clean = lines.filter((l) => l.description.trim());
    if (clean.length === 0) { setError("Add at least one item."); return; }
    if (clean.some((l) => !(Number(l.quantity) > 0))) { setError("Every item needs a quantity above zero."); return; }
    if ((Number(discount) || 0) > subtotal) { setError("The discount can't be more than the subtotal."); return; }

    const payload = {
      customerName, customerPhone, customerLocation, notes, validUntil, discount: Number(discount) || 0,
      lines: clean.map((l) => ({ description: l.description.trim(), product: l.product || undefined, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) || 0 })),
      ...(initial.fromQuote && !quotation ? { fromQuote: initial.fromQuote } : {}),
    };
    setSaving(true);
    try {
      if (quotation) await api.updateQuotation(quotation._id, payload);
      else await api.createQuotation(payload);
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center p-3 overflow-y-auto" style={{ background: "#00000088" }} onClick={onClose}>
      <div className="max-w-2xl w-full my-4 p-5 md:p-6" style={{ background: C.cream }} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-lg" style={{ color: C.ink }}>{quotation ? `Edit ${quotation.number}` : "New quotation"}</h2>
          <button onClick={onClose} aria-label="Close"><X size={18} color={C.ink} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Customer name *"><input value={customerName} onChange={(e) => setCustomerName(e.target.value)} style={inputStyle} maxLength={100} /></Field>
            <Field label="Phone (for WhatsApp)"><input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} style={inputStyle} maxLength={30} /></Field>
          </div>
          <Field label="Customer address / location"><input value={customerLocation} onChange={(e) => setCustomerLocation(e.target.value)} style={inputStyle} maxLength={300} /></Field>

          <div>
            <p className="text-xs uppercase tracking-wide mb-2" style={{ color: "#6B6960" }}>Items</p>
            <div className="space-y-3">
              {lines.map((l, i) => (
                <div key={i} className="p-3" style={{ background: "white", border: "1px solid #C9C5BA" }}>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                    <select value={l.product} onChange={(e) => pickProduct(i, e.target.value)} style={inputStyle} aria-label="Pick a product from stock" className="md:col-span-1">
                      <option value="">Service / other (not from stock)</option>
                      {products.map((p) => <option key={p._id} value={p._id}>{p.name} ({p.quantity ?? 0} in stock)</option>)}
                    </select>
                    <input value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} placeholder="Description shown to the customer" style={inputStyle} maxLength={300} className="md:col-span-2" />
                  </div>
                  <div className="flex gap-2 items-end">
                    <div style={{ width: 90 }}>
                      <label className="block text-xs mb-1" style={{ color: "#6B6960" }}>Qty</label>
                      <input type="number" min="0" step="any" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} style={inputStyle} />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs mb-1" style={{ color: "#6B6960" }}>Price each (₦)</label>
                      <input type="number" min="0" step="any" value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: e.target.value })} style={inputStyle} />
                    </div>
                    <p className="text-sm font-semibold pb-2 text-right" style={{ color: C.ink, minWidth: 100 }}>{formatMoney((Number(l.quantity) || 0) * (Number(l.unitPrice) || 0))}</p>
                    {lines.length > 1 && (
                      <button type="button" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))} className="pb-2" aria-label="Remove item"><Trash2 size={15} color={C.red} /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setLines((ls) => [...ls, blankLine()])} className="mt-2 text-sm flex items-center gap-1" style={{ color: C.blueprint }}>
              <Plus size={14} /> Add another item
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Discount (₦, optional)"><input type="number" min="0" step="any" value={discount} onChange={(e) => setDiscount(e.target.value)} style={inputStyle} /></Field>
            <Field label="Valid until"><input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} style={inputStyle} /></Field>
          </div>
          <Field label="Notes shown on the quotation (delivery, deposit terms…)">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={2000} style={inputStyle} />
          </Field>

          <div className="p-3 text-sm" style={{ background: C.concreteD }}>
            <div className="flex justify-between"><span style={{ color: "#6B6960" }}>Subtotal</span><span>{formatMoney(subtotal)}</span></div>
            {Number(discount) > 0 && <div className="flex justify-between"><span style={{ color: "#6B6960" }}>Discount</span><span style={{ color: C.red }}>-{formatMoney(Number(discount))}</span></div>}
            <div className="flex justify-between font-bold mt-1" style={{ color: C.ink }}><span>Total</span><span>{formatMoney(grand)}</span></div>
          </div>

          {error && <p className="text-sm" style={{ color: C.red }}>{error}</p>}
          <div className="flex gap-3">
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : quotation ? "Save changes" : "Create quotation"}</Button>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConvertModal({ quotation, onClose, onDone }) {
  const [deposit, setDeposit] = useState("");
  const [method, setMethod] = useState("Cash");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const stock = quotation.lines.filter((l) => l.product);
  const other = quotation.lines.filter((l) => !l.product);

  async function handleConvert() {
    setError("");
    setWorking(true);
    try {
      setResult(await api.convertQuotation(quotation._id, { paymentMethod: method, deposit: deposit === "" ? 0 : Number(deposit) }));
    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "#00000088" }} onClick={result ? onDone : onClose}>
      <div className="max-w-md w-full p-6 max-h-[90vh] overflow-y-auto" style={{ background: C.cream }} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-lg" style={{ color: C.ink }}>Convert {quotation.number} to sales</h2>
          <button onClick={result ? onDone : onClose} aria-label="Close"><X size={18} color={C.ink} /></button>
        </div>

        {result ? (
          <div>
            <p className="text-sm font-semibold mb-2" style={{ color: C.green }}>✓ {result.message}</p>
            <p className="text-sm mb-3" style={{ color: "#54524C" }}>Stock has been reduced and the sales are on the Sales page. Any balance can be paid off there with “Record payment”.</p>
            {result.skipped?.length > 0 && (
              <div className="p-3 text-sm mb-3" style={{ background: C.redBg, color: C.safetyDark }}>
                Not recorded as sales (not stock items): {result.skipped.join(", ")}. Bill these to the customer separately.
              </div>
            )}
            <Button onClick={onDone}>Done</Button>
          </div>
        ) : (
          <>
            <p className="text-sm mb-3" style={{ color: "#54524C" }}>This will create <strong>{stock.length}</strong> sale{stock.length === 1 ? "" : "s"} for {quotation.customerName} and take the items out of stock.</p>
            {other.length > 0 && (
              <p className="text-xs mb-3 p-2" style={{ background: C.concreteD, color: "#54524C" }}>
                {other.length} item{other.length === 1 ? " isn't" : "s aren't"} linked to a product in stock ({other.map((l) => l.description).join(", ")}) so {other.length === 1 ? "it" : "they"} won't become sales.
              </p>
            )}
            {stock.length === 0 && <p className="text-sm mb-3" style={{ color: C.red }}>None of the items are linked to stock products. Edit the quotation and pick products from the list.</p>}
            <div className="space-y-3">
              <Field label="Deposit received now (₦, leave empty if none)"><input type="number" min="0" step="any" value={deposit} onChange={(e) => setDeposit(e.target.value)} style={inputStyle} /></Field>
              <Field label="How the deposit was paid">
                <select value={method} onChange={(e) => setMethod(e.target.value)} style={inputStyle}>
                  {["Cash", "Bank Transfer", "POS", "Other"].map((m) => <option key={m}>{m}</option>)}
                </select>
              </Field>
              {error && <p className="text-sm" style={{ color: C.red }}>{error}</p>}
              <div className="flex gap-3">
                <Button onClick={handleConvert} disabled={working || stock.length === 0}>{working ? "Converting…" : "Convert to sales"}</Button>
                <Button variant="ghost" onClick={onClose}>Cancel</Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
