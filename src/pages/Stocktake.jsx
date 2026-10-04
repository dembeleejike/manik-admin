import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { C } from "../tokens";
import Layout from "../components/Layout";
import { PageHeader, Button, Card, Field, inputStyle, Loading, EmptyState, ErrorBanner, ExplainerBox, formatMoney } from "../components/ui";
import { useListView, FilterBar, ExportMenu } from "../components/Filters";
import { useAuth } from "../AuthContext";

const COUNT_CFG = {
  dateField: null,
  search: (p) => [p.name, p.ref, p.category?.name].join(" "),
  filters: [{ key: "category", label: "Category", get: (p) => p.category?.name || "" }],
  sorts: [
    { key: "name", label: "Name", get: (p) => p.name },
    { key: "category", label: "Category", get: (p) => p.category?.name || "" },
    { key: "qty", label: "System quantity", get: (p) => p.quantity ?? 0 },
  ],
  defaultSort: "category",
  defaultDir: "asc",
};

const HISTORY_CFG = {
  dateField: "at",
  search: (a) => [a.productName, a.productRef, a.byName, a.note, a.reason].join(" "),
  filters: [
    { key: "reason", label: "Type", get: (a) => a.reason, options: ["Stocktake", "Correction"] },
    { key: "result", label: "Result", get: (a) => (a.difference < 0 ? "Short" : "Over"), options: ["Short", "Over"] },
    { key: "by", label: "By", get: (a) => a.byName || "" },
  ],
  sorts: [
    { key: "date", label: "Date", get: (a) => new Date(a.at) },
    { key: "product", label: "Product", get: (a) => a.productName },
    { key: "diff", label: "Difference", get: (a) => a.difference },
  ],
  defaultSort: "date",
  defaultDir: "desc",
};

export default function Stocktake() {
  const [tab, setTab] = useState("count");
  const [products, setProducts] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { admin } = useAuth();
  const isOwner = admin?.role === "owner";

  async function load() {
    try {
      const [p, h] = await Promise.all([api.listProducts(), api.listStockAdjustments()]);
      setProducts(p);
      setHistory(h);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  return (
    <Layout>
      <PageHeader title="Stock count — Check the shelves against the system" />
      <ExplainerBox>
        Walk through the shop, type how many of each product you actually counted, and save. The system shows every difference before you confirm, sets the quantities to what you counted, and keeps a permanent record of what was missing or extra — so a shortage is never a mystery.
      </ExplainerBox>
      <ErrorBanner message={error} />

      <div className="flex gap-2 mb-5">
        {[["count", "Count stock"], ["history", `History (${history.length})`]].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className="text-sm px-4 py-2"
            style={{ background: tab === k ? C.ink : "transparent", color: tab === k ? "white" : C.ink, border: `1px solid ${C.ink}33` }}>{l}</button>
        ))}
      </div>

      {loading ? <Loading /> : tab === "count"
        ? <CountSheet products={products} isOwner={isOwner} onSaved={() => { load(); setTab("history"); }} />
        : <History rows={history} isOwner={isOwner} />}
    </Layout>
  );
}

function CountSheet({ products, isOwner, onSaved }) {
  const view = useListView(products, COUNT_CFG);
  const [counts, setCounts] = useState({}); // productId -> string typed
  const [note, setNote] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const byId = useMemo(() => new Map(products.map((p) => [p._id, p])), [products]);
  const entered = Object.entries(counts).filter(([, v]) => v !== "" && !isNaN(Number(v)) && Number(v) >= 0);
  const changes = entered
    .map(([id, v]) => ({ product: byId.get(id), counted: Number(v) }))
    .filter((c) => c.product && c.counted !== (c.product.quantity ?? 0))
    .map((c) => ({ ...c, diff: c.counted - (c.product.quantity ?? 0) }));
  const short = changes.filter((c) => c.diff < 0);
  const over = changes.filter((c) => c.diff > 0);
  const shortValue = short.reduce((n, c) => n + Math.abs(c.diff) * (c.product.costPrice || 0), 0);

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const result = await api.saveStocktake({ note, counts: entered.map(([product, v]) => ({ product, counted: Number(v) })) });
      setMessage(result.message);
      setCounts({});
      setNote("");
      setReviewing(false);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <FilterBar view={view} cfg={COUNT_CFG} items={products} placeholder="Search a product…" />
      {message && <p className="text-sm mb-3 font-medium" style={{ color: C.green }}>✓ {message}</p>}

      {view.rows.length === 0 ? <EmptyState message="No products to count." /> : (
        <div className="space-y-2">
          {view.rows.map((p) => {
            const typed = counts[p._id] ?? "";
            const diff = typed === "" ? null : Number(typed) - (p.quantity ?? 0);
            return (
              <Card key={p._id} className="!py-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div style={{ minWidth: 180, flex: "1 1 200px" }}>
                    <p className="font-semibold text-sm" style={{ color: C.ink }}>{p.name}</p>
                    <p className="text-xs" style={{ color: "#8A877D" }}>{p.ref}{p.category?.name ? ` · ${p.category.name}` : ""}</p>
                  </div>
                  <p className="text-sm" style={{ color: "#6B6960" }}>System: <strong style={{ color: C.ink }}>{p.quantity ?? 0}</strong></p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min="0" step="any" inputMode="decimal" value={typed} placeholder="Counted"
                      onChange={(e) => setCounts((c) => ({ ...c, [p._id]: e.target.value }))}
                      aria-label={`Counted quantity for ${p.name}`}
                      style={{ ...inputStyle, width: 100 }}
                    />
                    <span className="text-sm font-semibold" style={{ minWidth: 56, color: diff === null || diff === 0 ? "#8A877D" : diff < 0 ? C.red : C.green }}>
                      {diff === null ? "" : diff === 0 ? "matches" : diff > 0 ? `+${diff}` : diff}
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <div className="sticky bottom-0 mt-5 p-4 flex flex-wrap items-center justify-between gap-3" style={{ background: C.cream, borderTop: `2px solid ${C.ink}22` }}>
        <p className="text-sm" style={{ color: "#54524C" }}>
          {entered.length === 0 ? "Type counted quantities above." : <>{entered.length} counted · <strong style={{ color: C.red }}>{short.length} short</strong> · <strong style={{ color: C.green }}>{over.length} over</strong> · {entered.length - changes.length} match</>}
        </p>
        <Button disabled={entered.length === 0} onClick={() => { setError(""); setReviewing(true); }}>Review &amp; save</Button>
      </div>

      {reviewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "#00000088" }} onClick={() => !saving && setReviewing(false)}>
          <div className="max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" style={{ background: C.cream }} onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-lg mb-3" style={{ color: C.ink }}>Confirm stock count</h2>
            {changes.length === 0 ? (
              <p className="text-sm mb-4" style={{ color: "#54524C" }}>Everything you counted matches the system — nothing will change. Save anyway to record that the count was done.</p>
            ) : (
              <>
                <p className="text-sm mb-3" style={{ color: "#54524C" }}>These quantities will be changed to what you counted:</p>
                <div className="mb-3" style={{ border: "1px solid #C9C5BA", background: "white" }}>
                  {changes.map((c) => (
                    <div key={c.product._id} className="flex justify-between gap-3 px-3 py-2 text-sm" style={{ borderBottom: "1px solid #EEE9DD" }}>
                      <span style={{ color: C.ink }}>{c.product.name}</span>
                      <span style={{ color: c.diff < 0 ? C.red : C.green }}>{c.product.quantity ?? 0} → {c.counted} ({c.diff > 0 ? "+" : ""}{c.diff})</span>
                    </div>
                  ))}
                </div>
                {isOwner && short.length > 0 && <p className="text-sm mb-3" style={{ color: C.red }}>Value of missing stock (at cost): <strong>{formatMoney(shortValue)}</strong></p>}
              </>
            )}
            <Field label="Note (optional) — e.g. “Monthly count, Head Office”"><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} style={inputStyle} /></Field>
            {error && <p className="text-sm mt-3" style={{ color: C.red }}>{error}</p>}
            <div className="flex gap-3 mt-4">
              <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save stock count"}</Button>
              <Button variant="ghost" onClick={() => setReviewing(false)} disabled={saving}>Back</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function History({ rows, isOwner }) {
  const view = useListView(rows, HISTORY_CFG);
  const columns = [
    { label: "Date", get: (a) => a.at, type: "date" },
    { label: "Product", get: (a) => a.productName },
    { label: "Ref", get: (a) => a.productRef },
    { label: "System had", get: (a) => a.before, type: "number" },
    { label: "Counted / set to", get: (a) => a.after, type: "number" },
    { label: "Difference", get: (a) => a.difference, type: "number" },
    ...(isOwner ? [{ label: "Value of difference", get: (a) => a.difference * (a.unitCost || 0), type: "money" }] : []),
    { label: "Type", get: (a) => a.reason },
    { label: "By", get: (a) => a.byName },
    { label: "Note", get: (a) => a.note },
  ];
  if (rows.length === 0) return <EmptyState message="No stock counts or corrections yet." />;
  return (
    <>
      <FilterBar view={view} cfg={HISTORY_CFG} items={rows} placeholder="Search product, person, note…"
        actions={<ExportMenu rows={view.rows} columns={columns} filename="manik-stock-counts" sheetName="Stock counts" title="MANIK stock counts" />} />
      {view.rows.length === 0 ? <EmptyState message="Nothing matches these filters." /> : (
        <div className="space-y-2">
          {view.rows.map((a) => (
            <Card key={a._id} className="!py-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-semibold text-sm" style={{ color: C.ink }}>{a.productName} <span className="font-normal text-xs" style={{ color: "#8A877D" }}>{a.productRef}</span></p>
                  <p className="text-xs mt-1" style={{ color: "#6B6960" }}>
                    {a.before} → {a.after} · {a.reason}{a.note ? ` — ${a.note}` : ""}
                  </p>
                  <p className="text-xs mt-1" style={{ color: "#8A877D" }}>{new Date(a.at).toLocaleString()} · {a.byName || "unknown"}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold" style={{ color: a.difference < 0 ? C.red : C.green }}>{a.difference > 0 ? "+" : ""}{a.difference}</p>
                  {isOwner && a.unitCost > 0 && <p className="text-xs" style={{ color: "#6B6960" }}>{formatMoney(Math.abs(a.difference) * a.unitCost)} {a.difference < 0 ? "lost" : "extra"}</p>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
