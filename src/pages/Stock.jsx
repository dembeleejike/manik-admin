import React, { useEffect, useMemo, useState } from "react";
import { Boxes, ArrowRightLeft, Plus, Trash2, X, Warehouse, Store, Layers } from "lucide-react";
import { api } from "../api";
import { C } from "../tokens";
import Layout from "../components/Layout";
import { PageHeader, Button, Card, Badge, Field, inputStyle, Loading, EmptyState, ErrorBanner, ExplainerBox, formatMoney } from "../components/ui";
import { useListView, FilterBar, ExportMenu } from "../components/Filters";
import useLocations from "../components/useLocations";
import { useAuth } from "../AuthContext";
import { qtyAt, unassigned, defaultLocationId } from "../utils/stockPlaces";

const levelOf = (p) => ((p.quantity ?? 0) <= 0 ? "Out" : p.quantity <= (p.lowStockThreshold ?? 5) ? "Low" : "OK");
const iconFor = (loc) => (loc.kind === "warehouse" ? Warehouse : loc.kind === "shop" ? Store : Boxes);

export default function Stock() {
  const [products, setProducts] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("product");
  const [moving, setMoving] = useState(null); // null | { product? }
  const { activeLocations, loading: locLoading } = useLocations();
  const { admin } = useAuth();
  const isOwner = admin?.isOwner;

  async function load() {
    try {
      const [p, t] = await Promise.all([api.listProducts(), api.listTransfers()]);
      setProducts(p);
      setTransfers(t);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const totals = useMemo(() => {
    const perLocation = Object.fromEntries(activeLocations.map((l) => [l._id, 0]));
    let units = 0, value = 0, out = 0, low = 0, loose = 0;
    for (const p of products) {
      units += p.quantity || 0;
      value += (p.quantity || 0) * (p.costPrice || 0);
      for (const l of activeLocations) perLocation[l._id] += (p.stock || []).find((s) => String(s.location) === String(l._id))?.quantity || 0;
      loose += unassigned(p);
      const lv = levelOf(p);
      if (lv === "Out") out++; else if (lv === "Low") low++;
    }
    return { perLocation, units, value, out, low, loose };
  }, [products, activeLocations]);

  return (
    <Layout>
      <PageHeader
        title="Stock — What you have and where it is"
        action={<Button icon={ArrowRightLeft} onClick={() => setMoving({})}>Move stock</Button>}
      />
      <ExplainerBox>
        Everything on hand, product by product, showing how many are in the shop, how many in the warehouse and anywhere else. When goods arrive, record them in <strong>Purchases</strong> (they go to the warehouse by default). When some go to the shop, press <strong>Move stock</strong>. Sales take from the shop by default.
      </ExplainerBox>
      <ErrorBanner message={error} />

      {loading || locLoading ? <Loading /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Card><p className="text-2xl font-bold" style={{ color: C.ink }}>{totals.units.toLocaleString()}</p><p className="text-xs mt-1" style={{ color: "#6B6960" }}>units on hand — everywhere</p></Card>
            {activeLocations.map((l) => {
              const Icon = iconFor(l);
              return (
                <Card key={l._id}>
                  <Icon size={15} style={{ color: C.blueprint }} className="mb-1" />
                  <p className="text-2xl font-bold" style={{ color: C.ink }}>{(totals.perLocation[l._id] || 0).toLocaleString()}</p>
                  <p className="text-xs mt-1" style={{ color: "#6B6960" }}>units at {l.name}</p>
                </Card>
              );
            })}
            {isOwner && <Card><p className="text-2xl font-bold" style={{ color: C.ink }}>{formatMoney(totals.value)}</p><p className="text-xs mt-1" style={{ color: "#6B6960" }}>stock value at cost</p></Card>}
            <Card><p className="text-2xl font-bold" style={{ color: totals.out + totals.low > 0 ? C.safety : C.ink }}>{totals.out + totals.low}</p><p className="text-xs mt-1" style={{ color: "#6B6960" }}>{totals.out} out · {totals.low} running low</p></Card>
          </div>
          {totals.loose > 0 && (
            <p className="text-sm mb-4 p-3" style={{ background: C.redBg, color: C.safetyDark }}>
              {totals.loose.toLocaleString()} units haven't been given a location yet (stock from before locations existed). They are treated as being in the shop the first time they are sold or moved. Ask the developer to run the one-time upgrade (<code>npm run migrate</code>), or do a Stock count for each location.
            </p>
          )}

          <div className="flex flex-wrap gap-2 mb-5">
            {[["product", "By product"], ["category", "By category"], ["moves", `Moves (${transfers.length})`]].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setTab(k)} className="text-sm px-4 py-2"
                style={{ background: tab === k ? C.ink : "transparent", color: tab === k ? "white" : C.ink, border: `1px solid ${C.ink}33` }}>{l}</button>
            ))}
          </div>

          {tab === "product" && <ByProduct products={products} locations={activeLocations} isOwner={isOwner} onMove={(p) => setMoving({ product: p })} />}
          {tab === "category" && <ByCategory products={products} locations={activeLocations} isOwner={isOwner} />}
          {tab === "moves" && <Moves transfers={transfers} />}
        </>
      )}

      {moving && (
        <MoveModal
          products={products} locations={activeLocations} initialProduct={moving.product}
          onClose={() => setMoving(null)} onDone={() => { setMoving(null); load(); setTab("moves"); }}
        />
      )}
    </Layout>
  );
}

/* ---------------- by product ---------------- */
function ByProduct({ products, locations, isOwner, onMove }) {
  const [locFilter, setLocFilter] = useState("");
  const items = useMemo(() => (locFilter ? products.filter((p) => qtyAt(p, locFilter) > 0) : products), [products, locFilter]);

  const cfg = useMemo(() => ({
    dateField: null,
    search: (p) => [p.name, p.ref, p.category?.name, p.status].join(" "),
    filters: [
      { key: "category", label: "Category", get: (p) => p.category?.name || "" },
      { key: "level", label: "Stock level", get: levelOf, options: ["OK", "Low", "Out"] },
    ],
    sorts: [
      { key: "name", label: "Name", get: (p) => p.name },
      { key: "total", label: "Total on hand", get: (p) => p.quantity ?? 0 },
      { key: "category", label: "Category", get: (p) => p.category?.name || "" },
      ...locations.map((l) => ({ key: "loc-" + l._id, label: `${l.name} quantity`, get: (p) => qtyAt(p, l._id) })),
    ],
    defaultSort: "category",
    defaultDir: "asc",
  }), [locations]);
  const view = useListView(items, cfg);

  const columns = [
    { label: "Category", get: (p) => p.category?.name || "" },
    { label: "Ref", get: (p) => p.ref },
    { label: "Product", get: (p) => p.name },
    { label: "Total on hand", get: (p) => p.quantity ?? 0, type: "number" },
    ...locations.map((l) => ({ label: l.name, get: (p) => qtyAt(p, l._id), type: "number" })),
    { label: "Not placed yet", get: (p) => unassigned(p), type: "number" },
    ...(isOwner ? [{ label: "Value (cost)", get: (p) => (p.quantity || 0) * (p.costPrice || 0), type: "money" }] : []),
  ];

  if (products.length === 0) return <EmptyState message="No products yet." />;
  return (
    <>
      <FilterBar
        view={view} cfg={cfg} items={items} placeholder="Search a product, reference or category…"
        actions={
          <div className="flex flex-wrap gap-2 items-center">
            <select value={locFilter} onChange={(e) => setLocFilter(e.target.value)} aria-label="Only products held at" style={{ border: "1px solid #C9C5BA", background: "white", fontSize: 13, padding: "6px 8px" }}>
              <option value="">Held at: anywhere</option>
              {locations.map((l) => <option key={l._id} value={l._id}>Held at: {l.name}</option>)}
            </select>
            <ExportMenu rows={view.rows} columns={columns} filename="manik-stock" sheetName="Stock" title="MANIK stock on hand" />
          </div>
        }
      />
      {view.rows.length === 0 ? <EmptyState message="No products match these filters." /> : (
        <div className="space-y-2">
          {view.rows.map((p) => {
            const level = levelOf(p);
            return (
              <Card key={p._id} className="!py-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div style={{ flex: "1 1 220px" }}>
                    <p className="font-semibold text-sm" style={{ color: C.ink }}>{p.name}</p>
                    <p className="text-xs" style={{ color: "#8A877D" }}>{p.ref}{p.category?.name ? ` · ${p.category.name}` : ""}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {locations.map((l) => {
                        const q = qtyAt(p, l._id);
                        return (
                          <span key={l._id} className="text-xs px-2 py-1" style={{ background: q > 0 ? C.concreteD : "transparent", border: `1px solid ${q > 0 ? "transparent" : "#D9D5CA"}`, color: q > 0 ? C.ink : "#A19D91" }}>
                            {l.name}: <strong>{q}</strong>
                          </span>
                        );
                      })}
                      {unassigned(p) > 0 && <span className="text-xs px-2 py-1" style={{ background: C.redBg, color: C.safetyDark }}>Not placed yet: <strong>{unassigned(p)}</strong></span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold" style={{ color: level === "OK" ? C.ink : C.safety }}>{p.quantity ?? 0}</p>
                    <p className="text-xs" style={{ color: "#8A877D" }}>in total</p>
                    {level !== "OK" && <div className="mt-1"><Badge tone="red">{level === "Out" ? "Out of stock" : "Running low"}</Badge></div>}
                  </div>
                </div>
                {locations.length > 1 && (p.quantity ?? 0) > 0 && (
                  <button onClick={() => onMove(p)} className="mt-2 text-xs flex items-center gap-1" style={{ color: C.blueprint }}><ArrowRightLeft size={12} /> Move some of this</button>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ---------------- by category ---------------- */
function ByCategory({ products, locations, isOwner }) {
  const rows = useMemo(() => {
    const map = new Map();
    for (const p of products) {
      const name = p.category?.name || "No category";
      const r = map.get(name) || { name, products: 0, units: 0, value: 0, perLoc: {}, loose: 0, low: 0 };
      r.products++;
      r.units += p.quantity || 0;
      r.value += (p.quantity || 0) * (p.costPrice || 0);
      for (const l of locations) r.perLoc[l._id] = (r.perLoc[l._id] || 0) + qtyAt(p, l._id);
      r.loose += unassigned(p);
      if (levelOf(p) !== "OK") r.low++;
      map.set(name, r);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [products, locations]);

  const columns = [
    { label: "Category", get: (r) => r.name },
    { label: "Products", get: (r) => r.products, type: "number" },
    { label: "Total units", get: (r) => r.units, type: "number" },
    ...locations.map((l) => ({ label: l.name, get: (r) => r.perLoc[l._id] || 0, type: "number" })),
    { label: "Running low / out", get: (r) => r.low, type: "number" },
    ...(isOwner ? [{ label: "Value (cost)", get: (r) => r.value, type: "money" }] : []),
  ];

  if (rows.length === 0) return <EmptyState message="No products yet." />;
  return (
    <>
      <div className="flex justify-end mb-3"><ExportMenu rows={rows} columns={columns} filename="manik-stock-by-category" sheetName="By category" title="MANIK stock by category" /></div>
      <div className="overflow-x-auto" style={{ background: "white", border: "1px solid #C9C5BA" }}>
        <table className="w-full text-sm" style={{ color: C.ink }}>
          <thead>
            <tr style={{ background: C.concreteD, textAlign: "left" }}>
              <th className="px-3 py-2">Category</th><th className="px-3 py-2 text-right">Products</th><th className="px-3 py-2 text-right">Total units</th>
              {locations.map((l) => <th key={l._id} className="px-3 py-2 text-right">{l.name}</th>)}
              <th className="px-3 py-2 text-right">Low / out</th>{isOwner && <th className="px-3 py-2 text-right">Value (cost)</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} style={{ borderTop: "1px solid #EEE9DD" }}>
                <td className="px-3 py-2 font-semibold"><Layers size={13} className="inline mr-1" style={{ color: C.blueprint }} />{r.name}</td>
                <td className="px-3 py-2 text-right">{r.products}</td>
                <td className="px-3 py-2 text-right font-semibold">{r.units.toLocaleString()}</td>
                {locations.map((l) => <td key={l._id} className="px-3 py-2 text-right">{(r.perLoc[l._id] || 0).toLocaleString()}</td>)}
                <td className="px-3 py-2 text-right" style={{ color: r.low ? C.safety : "#8A877D" }}>{r.low}</td>
                {isOwner && <td className="px-3 py-2 text-right">{formatMoney(r.value)}</td>}
              </tr>
            ))}
            <tr style={{ borderTop: "2px solid #C9C5BA", background: "#F6F3EA", fontWeight: 700 }}>
              <td className="px-3 py-2">Everything</td>
              <td className="px-3 py-2 text-right">{rows.reduce((n, r) => n + r.products, 0)}</td>
              <td className="px-3 py-2 text-right">{rows.reduce((n, r) => n + r.units, 0).toLocaleString()}</td>
              {locations.map((l) => <td key={l._id} className="px-3 py-2 text-right">{rows.reduce((n, r) => n + (r.perLoc[l._id] || 0), 0).toLocaleString()}</td>)}
              <td className="px-3 py-2 text-right">{rows.reduce((n, r) => n + r.low, 0)}</td>
              {isOwner && <td className="px-3 py-2 text-right">{formatMoney(rows.reduce((n, r) => n + r.value, 0))}</td>}
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ---------------- moves (history) ---------------- */
const MOVES_CFG = {
  dateField: "at",
  search: (t) => [t.productName, t.productRef, t.categoryName, t.fromName, t.toName, t.byName, t.note].join(" "),
  filters: [
    { key: "from", label: "From", get: (t) => t.fromName },
    { key: "to", label: "To", get: (t) => t.toName },
    { key: "category", label: "Category", get: (t) => t.categoryName || "" },
    { key: "by", label: "By", get: (t) => t.byName || "" },
  ],
  sorts: [
    { key: "date", label: "Date", get: (t) => new Date(t.at) },
    { key: "product", label: "Product", get: (t) => t.productName },
    { key: "qty", label: "Quantity", get: (t) => t.quantity },
  ],
  defaultSort: "date",
  defaultDir: "desc",
};
const MOVES_COLUMNS = [
  { label: "Date", get: (t) => t.at, type: "date" },
  { label: "Product", get: (t) => t.productName },
  { label: "Category", get: (t) => t.categoryName },
  { label: "From", get: (t) => t.fromName },
  { label: "To", get: (t) => t.toName },
  { label: "Quantity", get: (t) => t.quantity, type: "number" },
  { label: "By", get: (t) => t.byName },
  { label: "Note", get: (t) => t.note },
];

function Moves({ transfers }) {
  const view = useListView(transfers, MOVES_CFG);
  if (transfers.length === 0) return <EmptyState message="No stock has been moved between locations yet." />;
  return (
    <>
      <FilterBar view={view} cfg={MOVES_CFG} items={transfers} placeholder="Search product, place, person…"
        actions={<ExportMenu rows={view.rows} columns={MOVES_COLUMNS} filename="manik-stock-moves" sheetName="Stock moves" title="MANIK stock moves" />} />
      {view.rows.length === 0 ? <EmptyState message="Nothing matches these filters." /> : (
        <div className="space-y-2">
          {view.rows.map((t) => (
            <Card key={t._id} className="!py-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-semibold text-sm" style={{ color: C.ink }}>{t.productName} <span className="font-normal text-xs" style={{ color: "#8A877D" }}>{t.categoryName}</span></p>
                  <p className="text-sm mt-1" style={{ color: "#54524C" }}>{t.fromName} <ArrowRightLeft size={12} className="inline mx-1" /> {t.toName}{t.note ? ` — ${t.note}` : ""}</p>
                  <p className="text-xs mt-1" style={{ color: "#8A877D" }}>{new Date(t.at).toLocaleString()} · {t.byName || "unknown"}</p>
                </div>
                <p className="text-lg font-bold" style={{ color: C.ink }}>{t.quantity}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

/* ---------------- move stock (several products at once) ---------------- */
function MoveModal({ products, locations, initialProduct, onClose, onDone }) {
  const [from, setFrom] = useState(defaultLocationId(locations, "receiving"));
  const [to, setTo] = useState(() => {
    const sell = defaultLocationId(locations, "selling");
    return sell === defaultLocationId(locations, "receiving") ? (locations.find((l) => l._id !== sell) || {})._id || "" : sell;
  });
  const [lines, setLines] = useState([{ product: initialProduct?._id || "", quantity: "" }]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const movable = useMemo(() => products.filter((p) => qtyAt(p, from) > 0).sort((a, b) => a.name.localeCompare(b.name)), [products, from]);
  const setLine = (i, patch) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const fromName = locations.find((l) => l._id === from)?.name || "";
  const toName = locations.find((l) => l._id === to)?.name || "";

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!from || !to || from === to) { setError("Choose two different places."); return; }
    const items = lines.filter((l) => l.product && Number(l.quantity) > 0).map((l) => ({ product: l.product, quantity: Number(l.quantity) }));
    if (items.length === 0) { setError("Choose a product and how many to move."); return; }
    for (const it of items) {
      const p = products.find((x) => x._id === it.product);
      if (p && it.quantity > qtyAt(p, from)) { setError(`Only ${qtyAt(p, from)} of ${p.name} at ${fromName}.`); return; }
    }
    setSaving(true);
    try {
      const r = await api.createTransfer({ from, to, items, note });
      setDone(r.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center p-3 overflow-y-auto" style={{ background: "#00000088" }} onClick={done ? onDone : onClose}>
      <div className="max-w-lg w-full my-4 p-5 md:p-6" style={{ background: C.cream }} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-lg" style={{ color: C.ink }}>Move stock</h2>
          <button onClick={done ? onDone : onClose} aria-label="Close"><X size={18} color={C.ink} /></button>
        </div>

        {done ? (
          <div>
            <p className="text-sm font-semibold mb-3" style={{ color: C.green }}>✓ {done}</p>
            <Button onClick={onDone}>Done</Button>
          </div>
        ) : locations.length < 2 ? (
          <p className="text-sm" style={{ color: "#54524C" }}>You need at least two stock locations to move stock. The owner can add one in Business Settings.</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Take from">
                <select value={from} onChange={(e) => { setFrom(e.target.value); setLines((ls) => ls.map((l) => ({ ...l, product: "", quantity: "" }))); }} style={inputStyle}>
                  {locations.map((l) => <option key={l._id} value={l._id}>{l.name}</option>)}
                </select>
              </Field>
              <Field label="Move to">
                <select value={to} onChange={(e) => setTo(e.target.value)} style={inputStyle}>
                  <option value="">Choose…</option>
                  {locations.filter((l) => l._id !== from).map((l) => <option key={l._id} value={l._id}>{l.name}</option>)}
                </select>
              </Field>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide mb-2" style={{ color: "#6B6960" }}>What to move</p>
              <div className="space-y-2">
                {lines.map((l, i) => {
                  const p = products.find((x) => x._id === l.product);
                  return (
                    <div key={i} className="flex gap-2 items-center">
                      <select value={l.product} onChange={(e) => setLine(i, { product: e.target.value })} style={{ ...inputStyle, flex: 1 }} aria-label="Product">
                        <option value="">Choose a product…</option>
                        {movable.map((m) => <option key={m._id} value={m._id}>{m.name} ({qtyAt(m, from)} at {fromName})</option>)}
                      </select>
                      <input type="number" min="0" step="any" value={l.quantity} placeholder="How many" onChange={(e) => setLine(i, { quantity: e.target.value })} style={{ ...inputStyle, width: 100 }} aria-label="Quantity" />
                      {p && Number(l.quantity) > qtyAt(p, from) && <span title={`Only ${qtyAt(p, from)} available`} style={{ color: C.red }}>!</span>}
                      {lines.length > 1 && <button type="button" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))} aria-label="Remove"><Trash2 size={15} color={C.red} /></button>}
                    </div>
                  );
                })}
              </div>
              <button type="button" onClick={() => setLines((ls) => [...ls, { product: "", quantity: "" }])} className="mt-2 text-sm flex items-center gap-1" style={{ color: C.blueprint }}><Plus size={14} /> Add another product</button>
              {movable.length === 0 && <p className="text-xs mt-2" style={{ color: C.red }}>Nothing is in stock at {fromName}.</p>}
            </div>

            <Field label="Note (optional) — e.g. “Restocking the shop”"><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} style={inputStyle} /></Field>
            {error && <p className="text-sm" style={{ color: C.red }}>{error}</p>}
            <div className="flex gap-3">
              <Button type="submit" disabled={saving}>{saving ? "Moving…" : `Move to ${toName || "…"}`}</Button>
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
