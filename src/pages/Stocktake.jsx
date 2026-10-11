import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { C } from "../tokens";
import Layout from "../components/Layout";
import { PageHeader, Button, Card, Field, inputStyle, Loading, EmptyState, ErrorBanner, ExplainerBox, formatMoney } from "../components/ui";
import { useListView, FilterBar, ExportMenu } from "../components/Filters";
import useLocations from "../components/useLocations";
import { useAuth } from "../AuthContext";
import { qtyAt, unassigned, defaultLocationId } from "../utils/stockPlaces";

const COUNT_CFG = {
  dateField: null,
  search: (p) => [p.name, p.ref].join(" "),
  sorts: [
    { key: "name", label: "Name", get: (p) => p.name },
    { key: "ref", label: "Reference", get: (p) => p.ref },
  ],
  defaultSort: "name",
  defaultDir: "asc",
};

const HISTORY_CFG = {
  dateField: "at",
  search: (a) => [a.productName, a.productRef, a.byName, a.note, a.reason, a.locationName, a.categoryName].join(" "),
  filters: [
    { key: "location", label: "Location", get: (a) => a.locationName || "" },
    { key: "category", label: "Category", get: (a) => a.categoryName || "" },
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
  const { activeLocations, loading: locLoading } = useLocations();
  const isOwner = admin?.isOwner;

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
        Count one <strong>place</strong> and one <strong>category</strong> at a time — for example, Glass in the Shop, then Glass in the Warehouse. Type what you really counted. The system shows every difference before you confirm, sets that place's quantity to your count, and keeps a permanent record of what was missing or extra. Other places and other categories are not touched.
      </ExplainerBox>
      <ErrorBanner message={error} />

      <div className="flex gap-2 mb-5">
        {[["count", "Count stock"], ["history", `History (${history.length})`]].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className="text-sm px-4 py-2"
            style={{ background: tab === k ? C.ink : "transparent", color: tab === k ? "white" : C.ink, border: `1px solid ${C.ink}33` }}>{l}</button>
        ))}
      </div>

      {loading || locLoading ? <Loading /> : tab === "count"
        ? <CountSheet products={products} locations={activeLocations} isOwner={isOwner} onSaved={() => { load(); setTab("history"); }} />
        : <History rows={history} isOwner={isOwner} />}
    </Layout>
  );
}

function CountSheet({ products, locations, isOwner, onSaved }) {
  const [locationId, setLocationId] = useState(defaultLocationId(locations, "selling"));
  const [categoryId, setCategoryId] = useState("");
  const [counts, setCounts] = useState({}); // productId -> string typed
  const [note, setNote] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const sellingId = defaultLocationId(locations, "selling");
  const location = locations.find((l) => l._id === locationId);

  // What the system believes is at this place. Stock from before locations existed (not placed
  // anywhere yet) counts as being in the selling location, which is where it is adopted.
  const systemQty = (p) => qtyAt(p, locationId) + (locationId === sellingId ? unassigned(p) : 0);

  const categories = useMemo(() => {
    const map = new Map();
    for (const p of products) if (p.category?._id) map.set(p.category._id, p.category.name);
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  const scoped = useMemo(() => (categoryId ? products.filter((p) => p.category?._id === categoryId) : products), [products, categoryId]);
  const view = useListView(scoped, COUNT_CFG);

  // Counts typed for a different place/category would be wrong to keep, so changing either starts fresh.
  function changeScope(setter) {
    return (e) => {
      if (Object.values(counts).some((v) => v !== "") && !confirm("Changing this will clear the quantities you've typed so far. Continue?")) return;
      setCounts({});
      setter(e.target.value);
    };
  }

  const byId = useMemo(() => new Map(products.map((p) => [p._id, p])), [products]);
  const entered = Object.entries(counts).filter(([id, v]) => v !== "" && !isNaN(Number(v)) && Number(v) >= 0 && byId.has(id));
  const changes = entered
    .map(([id, v]) => ({ product: byId.get(id), counted: Number(v) }))
    .filter((c) => c.counted !== systemQty(c.product))
    .map((c) => ({ ...c, diff: c.counted - systemQty(c.product) }));
  const short = changes.filter((c) => c.diff < 0);
  const over = changes.filter((c) => c.diff > 0);
  const shortValue = short.reduce((n, c) => n + Math.abs(c.diff) * (c.product.costPrice || 0), 0);
  const notCounted = scoped.length - scoped.filter((p) => counts[p._id] !== undefined && counts[p._id] !== "").length;

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const result = await api.saveStocktake({
        location: locationId, category: categoryId || undefined, note,
        counts: entered.map(([product, v]) => ({ product, counted: Number(v) })),
      });
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

  const field = { border: "1px solid #C9C5BA", background: "white", fontSize: 14, padding: "8px 10px" };
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <Field label="1. Which place are you counting?">
          <select value={locationId} onChange={changeScope(setLocationId)} style={field}>
            {locations.map((l) => <option key={l._id} value={l._id}>{l.name}</option>)}
          </select>
        </Field>
        <Field label="2. Which category?">
          <select value={categoryId} onChange={changeScope(setCategoryId)} style={field}>
            <option value="">All categories (a very long list)</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
      </div>

      <FilterBar view={view} cfg={COUNT_CFG} items={scoped} placeholder="Search a product in this list…" />
      {message && <p className="text-sm mb-3 font-medium" style={{ color: C.green }}>✓ {message}</p>}

      {view.rows.length === 0 ? <EmptyState message={scoped.length === 0 ? "There are no products in this category." : "No products match your search."} /> : (
        <div className="space-y-2">
          {view.rows.map((p) => {
            const typed = counts[p._id] ?? "";
            const system = systemQty(p);
            const diff = typed === "" ? null : Number(typed) - system;
            const elsewhere = (p.quantity ?? 0) - system;
            return (
              <Card key={p._id} className="!py-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div style={{ minWidth: 180, flex: "1 1 200px" }}>
                    <p className="font-semibold text-sm" style={{ color: C.ink }}>{p.name}</p>
                    <p className="text-xs" style={{ color: "#8A877D" }}>{p.ref}{elsewhere > 0 ? ` · ${elsewhere} more elsewhere` : ""}</p>
                  </div>
                  <p className="text-sm" style={{ color: "#6B6960" }}>System at {location?.name}: <strong style={{ color: C.ink }}>{system}</strong></p>
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
          {entered.length === 0 ? "Type counted quantities above." : <>{entered.length} counted · <strong style={{ color: C.red }}>{short.length} short</strong> · <strong style={{ color: C.green }}>{over.length} over</strong> · {entered.length - changes.length} match{notCounted > 0 ? ` · ${notCounted} not counted yet` : ""}</>}
        </p>
        <Button disabled={entered.length === 0} onClick={() => { setError(""); setReviewing(true); }}>Review &amp; save</Button>
      </div>

      {reviewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "#00000088" }} onClick={() => !saving && setReviewing(false)}>
          <div className="max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" style={{ background: C.cream }} onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-lg mb-1" style={{ color: C.ink }}>Confirm stock count</h2>
            <p className="text-sm mb-3" style={{ color: "#6B6960" }}>{location?.name}{categoryId ? ` · ${categories.find((c) => c.id === categoryId)?.name}` : " · all categories"}</p>
            {notCounted > 0 && <p className="text-sm mb-3 p-2" style={{ background: C.concreteD, color: "#54524C" }}>{notCounted} product{notCounted === 1 ? " in this list was" : "s in this list were"} not counted and will be left exactly as they are.</p>}
            {changes.length === 0 ? (
              <p className="text-sm mb-4" style={{ color: "#54524C" }}>Everything you counted matches the system — nothing will change. Save anyway to record that the count was done.</p>
            ) : (
              <>
                <p className="text-sm mb-3" style={{ color: "#54524C" }}>These quantities at {location?.name} will be changed to what you counted:</p>
                <div className="mb-3" style={{ border: "1px solid #C9C5BA", background: "white" }}>
                  {changes.map((c) => (
                    <div key={c.product._id} className="flex justify-between gap-3 px-3 py-2 text-sm" style={{ borderBottom: "1px solid #EEE9DD" }}>
                      <span style={{ color: C.ink }}>{c.product.name}</span>
                      <span style={{ color: c.diff < 0 ? C.red : C.green }}>{systemQty(c.product)} → {c.counted} ({c.diff > 0 ? "+" : ""}{c.diff})</span>
                    </div>
                  ))}
                </div>
                {isOwner && short.length > 0 && <p className="text-sm mb-3" style={{ color: C.red }}>Value of missing stock (at cost): <strong>{formatMoney(shortValue)}</strong></p>}
              </>
            )}
            <Field label="Note (optional) — e.g. “Monthly count”"><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} style={inputStyle} /></Field>
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
    { label: "Category", get: (a) => a.categoryName },
    { label: "Location", get: (a) => a.locationName },
    { label: "System had", get: (a) => a.before, type: "number" },
    { label: "Counted / set to", get: (a) => a.after, type: "number" },
    { label: "Difference", get: (a) => a.difference, type: "number" },
    ...(isOwner ? [{ label: "Value of difference", get: (a) => a.difference * (a.unitCost || 0), type: "money" }] : []),
    { label: "Type", get: (a) => a.reason },
    { label: "By", get: (a) => a.byName },
    { label: "Note", get: (a) => a.note },
  ];
  if (rows.length === 0) return <EmptyState message="No stock counts yet." />;
  return (
    <>
      <FilterBar view={view} cfg={HISTORY_CFG} items={rows} placeholder="Search product, place, person, note…"
        actions={<ExportMenu rows={view.rows} columns={columns} filename="manik-stock-counts" sheetName="Stock counts" title="MANIK stock counts" />} />
      {view.rows.length === 0 ? <EmptyState message="Nothing matches these filters." /> : (
        <div className="space-y-2">
          {view.rows.map((a) => (
            <Card key={a._id} className="!py-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-semibold text-sm" style={{ color: C.ink }}>{a.productName} <span className="font-normal text-xs" style={{ color: "#8A877D" }}>{a.productRef}</span></p>
                  <p className="text-xs mt-1" style={{ color: "#6B6960" }}>
                    {a.locationName ? `${a.locationName}${a.categoryName ? " · " + a.categoryName : ""} · ` : ""}{a.before} → {a.after} · {a.reason}{a.note ? ` — ${a.note}` : ""}
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
