import React, { useState } from "react";
import { Plus, Store, Warehouse, Boxes } from "lucide-react";
import { api } from "../api";
import { C } from "../tokens";
import { Button, Card, inputStyle } from "./ui";
import useLocations from "./useLocations";

const KINDS = [["shop", "Shop"], ["warehouse", "Warehouse"], ["other", "Other place"]];
const iconFor = (kind) => (kind === "warehouse" ? Warehouse : kind === "shop" ? Store : Boxes);

// Owner-only: the places stock can be kept, and which one is the default for new goods and for sales.
export default function LocationsCard() {
  const { locations, reload } = useLocations();
  const [name, setName] = useState("");
  const [kind, setKind] = useState("other");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function run(key, fn) {
    setBusy(key); setError("");
    try { await fn(); await reload(); } catch (err) { setError(err.message); } finally { setBusy(""); }
  }

  const btn = { border: `1px solid ${C.ink}33`, fontSize: 12, padding: "4px 9px", background: "transparent", color: C.ink };

  return (
    <Card>
      <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#6B6960" }}>Stock locations</p>
      <p className="text-xs mb-4" style={{ color: "#8A877D" }}>
        The places you keep stock, such as the Shop and the Warehouse. New purchases go to the <strong>receiving</strong> place by default (the warehouse); sales take from the <strong>selling</strong> place by default (the shop). Staff can still choose any place on each purchase, sale or move.
      </p>
      {error && <p className="text-sm mb-3" style={{ color: C.red }}>{error}</p>}

      <div className="space-y-2 mb-4">
        {locations.map((l) => {
          const Icon = iconFor(l.kind);
          return (
            <div key={l._id} className="flex items-center justify-between gap-3 flex-wrap px-3 py-2" style={{ background: "white", border: "1px solid #C9C5BA", opacity: l.active ? 1 : 0.55 }}>
              <div className="flex items-center gap-2 text-sm" style={{ color: C.ink }}>
                <Icon size={15} style={{ color: C.blueprint }} />
                <strong>{l.name}</strong>
                {!l.active && <span className="text-xs" style={{ color: "#8A877D" }}>(switched off)</span>}
                {l.isDefaultReceiving && <span className="text-xs px-2 py-0.5" style={{ background: C.concreteD }}>receives new stock</span>}
                {l.isDefaultSelling && <span className="text-xs px-2 py-0.5" style={{ background: C.concreteD }}>sales come from here</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" style={btn} disabled={!!busy} onClick={() => {
                  const next = prompt("New name:", l.name);
                  if (next && next.trim() && next.trim() !== l.name) run("rename" + l._id, () => api.updateLocation(l._id, { name: next.trim() }));
                }}>Rename</button>
                {l.active && !l.isDefaultReceiving && <button type="button" style={btn} disabled={!!busy} onClick={() => run("rec" + l._id, () => api.updateLocation(l._id, { isDefaultReceiving: true }))}>Receive new stock here</button>}
                {l.active && !l.isDefaultSelling && <button type="button" style={btn} disabled={!!busy} onClick={() => run("sell" + l._id, () => api.updateLocation(l._id, { isDefaultSelling: true }))}>Sell from here</button>}
                {l.active
                  ? <button type="button" style={{ ...btn, color: C.red }} disabled={!!busy} onClick={() => run("off" + l._id, () => api.updateLocation(l._id, { active: false }))}>Switch off</button>
                  : <button type="button" style={btn} disabled={!!busy} onClick={() => run("on" + l._id, () => api.updateLocation(l._id, { active: true }))}>Switch on</button>}
              </div>
            </div>
          );
        })}
      </div>

      <form
        className="flex flex-wrap gap-2 items-center"
        onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; run("add", async () => { await api.createLocation({ name: name.trim(), kind }); setName(""); setKind("other"); }); }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New place, e.g. Gauraka store" maxLength={60} style={{ ...inputStyle, flex: "1 1 200px", width: "auto" }} />
        <select value={kind} onChange={(e) => setKind(e.target.value)} style={{ ...inputStyle, width: "auto" }} aria-label="Type of place">
          {KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <Button type="submit" icon={Plus} disabled={!!busy}>Add place</Button>
      </form>
      <p className="text-xs mt-3" style={{ color: "#8A877D" }}>A place can only be switched off when it holds no stock and isn't a default.</p>
    </Card>
  );
}
