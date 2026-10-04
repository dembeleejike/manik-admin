import React, { useMemo, useState } from "react";
import { Download, Share2, X, ArrowUp, ArrowDown, FileSpreadsheet } from "lucide-react";
import { C } from "../tokens";
import { makeTableFile, downloadFile, shareFile, shareSupport } from "../utils/files";

/* ---------------------------------------------------------------
   Shared search / filter / sort / export tools for every list.

   const cfg = {
     dateField: "date",                       // which field the date range uses
     search: (item) => "text to search",      // every word typed must appear
     filters: [{ key, label, get: (item) => "value", options?: [...] }],
     sorts:   [{ key, label, get: (item) => value }],
     defaultSort: "date", defaultDir: "desc",
   };
   const view = useListView(items, cfg);
   <FilterBar view={view} cfg={cfg} placeholder="..." />
   view.rows  ->  the items to show

   Everything combines: words + date range + every dropdown + sort.
------------------------------------------------------------------ */

const RANGES = [
  ["all", "All time"],
  ["today", "Today"],
  ["week", "This week"],
  ["month", "This month"],
  ["year", "This year"],
  ["30d", "Last 30 days"],
  ["pick-month", "Pick a month…"],
  ["custom", "Custom dates…"],
];

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const endOfDay = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };

function rangeBounds(range, from, to, month, now = new Date()) {
  const today = startOfDay(now);
  if (range === "today") return [today, endOfDay(now)];
  if (range === "week") { const s = new Date(today); s.setDate(s.getDate() - s.getDay()); return [s, null]; }
  if (range === "month") return [new Date(today.getFullYear(), today.getMonth(), 1), null];
  if (range === "year") return [new Date(today.getFullYear(), 0, 1), null];
  if (range === "30d") { const s = new Date(today); s.setDate(s.getDate() - 29); return [s, null]; }
  if (range === "pick-month" && month) {
    const [y, m] = month.split("-").map(Number);
    return [new Date(y, m - 1, 1), endOfDay(new Date(y, m, 0))];
  }
  if (range === "custom") {
    return [from ? startOfDay(from) : null, to ? endOfDay(to) : null];
  }
  return [null, null];
}

// Words people might type to find a date: "october", "oct 2026", "2026-10-02", "friday"
function dateWords(value) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return [
    d.toISOString().slice(0, 10),
    d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", weekday: "long" }),
    d.toLocaleDateString("en-GB", { month: "short" }),
  ].join(" ");
}

function compare(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (a instanceof Date || b instanceof Date) return new Date(a).getTime() - new Date(b).getTime();
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { sensitivity: "base", numeric: true });
}

// The whole search + date + dropdown + sort pipeline as one plain function
// (no React), so it can be tested on its own. `state` is what the controls hold.
export function applyView(items, cfg, state, now = new Date()) {
  const { q, range, from, to, month, filterValues, sortKey, sortDir } = state;
  const dateField = cfg.dateField === undefined ? "date" : cfg.dateField;
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const [start, end] = dateField ? rangeBounds(range, from, to, month, now) : [null, null];
  const sort = (cfg.sorts || []).find((s) => s.key === sortKey);

  let out = items.filter((item) => {
    if (dateField && (start || end)) {
      const t = new Date(item[dateField]).getTime();
      if (isNaN(t) || (start && t < start.getTime()) || (end && t > end.getTime())) return false;
    }
    for (const f of cfg.filters || []) {
      const want = filterValues[f.key];
      if (want && String(f.get(item)) !== want) return false;
    }
    if (terms.length) {
      const hay = (cfg.search(item) + " " + (dateField ? dateWords(item[dateField]) : "")).toLowerCase();
      if (!terms.every((t) => hay.includes(t))) return false;
    }
    return true;
  });

  if (sort) {
    out = [...out].sort((a, b) => compare(sort.get(a), sort.get(b)) * (sortDir === "asc" ? 1 : -1));
  }
  return out;
}

export function useListView(items, cfg) {
  const [q, setQ] = useState("");
  const [range, setRange] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [month, setMonth] = useState("");
  const [filterValues, setFilterValues] = useState({});
  const [sortKey, setSortKey] = useState(cfg.defaultSort || (cfg.sorts && cfg.sorts[0]?.key) || "");
  const [sortDir, setSortDir] = useState(cfg.defaultDir || "desc");

  const rows = useMemo(
    () => applyView(items, cfg, { q, range, from, to, month, filterValues, sortKey, sortDir }),
    // cfg holds functions that are recreated each render; they don't change meaning.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, q, range, from, to, month, filterValues, sortKey, sortDir]
  );

  const activeCount =
    (q.trim() ? 1 : 0) + (range !== "all" ? 1 : 0) + Object.values(filterValues).filter(Boolean).length;

  const clear = () => {
    setQ(""); setRange("all"); setFrom(""); setTo(""); setMonth(""); setFilterValues({});
  };

  return {
    rows, total: items.length, activeCount, clear,
    q, setQ, range, setRange, from, setFrom, to, setTo, month, setMonth,
    filterValues, setFilter: (key, value) => setFilterValues((v) => ({ ...v, [key]: value })),
    sortKey, setSortKey, sortDir, setSortDir,
  };
}

const field = { border: "1px solid #C9C5BA", background: "white", color: C.ink, fontSize: 13, padding: "8px 10px" };

export function FilterBar({ view, cfg, items, placeholder, actions }) {
  const filterOptions = useMemo(() => {
    const out = {};
    for (const f of cfg.filters || []) {
      out[f.key] = f.options || [...new Set((items || []).map((i) => f.get(i)).filter((v) => v !== "" && v != null).map(String))].sort((a, b) => a.localeCompare(b));
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  return (
    <div className="mb-5">
      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={view.q}
          onChange={(e) => view.setQ(e.target.value)}
          placeholder={placeholder || "Search…"}
          style={{ ...field, flex: "1 1 220px", minWidth: 180 }}
        />
        {cfg.dateField !== null && (
          <select value={view.range} onChange={(e) => view.setRange(e.target.value)} style={field} aria-label="Date range">
            {RANGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        )}
        {view.range === "pick-month" && (
          <input type="month" value={view.month} onChange={(e) => view.setMonth(e.target.value)} style={field} aria-label="Month" />
        )}
        {view.range === "custom" && (
          <>
            <input type="date" value={view.from} onChange={(e) => view.setFrom(e.target.value)} style={field} aria-label="From date" />
            <span className="text-xs" style={{ color: "#6B6960" }}>to</span>
            <input type="date" value={view.to} onChange={(e) => view.setTo(e.target.value)} style={field} aria-label="To date" />
          </>
        )}
      </div>

      {((cfg.filters || []).length > 0 || (cfg.sorts || []).length > 0) && (
        <div className="flex flex-wrap gap-2 items-center mt-2">
          {(cfg.filters || []).map((f) => (
            <select key={f.key} value={view.filterValues[f.key] || ""} onChange={(e) => view.setFilter(f.key, e.target.value)} style={field} aria-label={f.label}>
              <option value="">{f.label}: all</option>
              {filterOptions[f.key].map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ))}
          {(cfg.sorts || []).length > 0 && (
            <>
              <select value={view.sortKey} onChange={(e) => view.setSortKey(e.target.value)} style={field} aria-label="Sort by">
                {cfg.sorts.map((s) => <option key={s.key} value={s.key}>Sort: {s.label}</option>)}
              </select>
              <button
                type="button"
                onClick={() => view.setSortDir(view.sortDir === "asc" ? "desc" : "asc")}
                style={{ ...field, display: "inline-flex", alignItems: "center", gap: 4 }}
                aria-label={view.sortDir === "asc" ? "Sorted low to high" : "Sorted high to low"}
                title={view.sortDir === "asc" ? "Low → high" : "High → low"}
              >
                {view.sortDir === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
                {view.sortDir === "asc" ? "Low → high" : "High → low"}
              </button>
            </>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center justify-between mt-3">
        <p className="text-xs" style={{ color: "#6B6960" }}>
          Showing <strong style={{ color: C.ink }}>{view.rows.length}</strong> of {view.total}
          {view.activeCount > 0 && (
            <button type="button" onClick={view.clear} className="ml-3 inline-flex items-center gap-1 underline" style={{ color: C.safety }}>
              <X size={12} /> Clear filters
            </button>
          )}
        </p>
        {actions}
      </div>
    </div>
  );
}

// Export (and share) exactly the rows that are currently showing.
export function ExportMenu({ rows, columns, filename, sheetName, title }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  // Share only appears when this device can really share a file; Excel files can't be
  // shared by Chrome, so there it shares the CSV (which opens in Excel / Sheets).
  const support = useMemo(() => shareSupport(), []);
  const shareFormat = support.xlsx ? "xlsx" : support.csv ? "csv" : null;
  const disabled = rows.length === 0;

  const build = (format) => makeTableFile({ format, filename, sheetName: sheetName || title, columns, rows });

  async function handleShare() {
    setBusy(true);
    setNote("");
    try {
      const file = build(shareFormat);
      const shared = await shareFile(file, title || filename);
      if (!shared) { downloadFile(file); setNote("Sharing isn't available here, so the file was downloaded instead."); }
    } finally {
      setBusy(false);
    }
  }

  const btn = {
    border: "1px solid #C9C5BA", background: "transparent", color: C.ink, fontSize: 12,
    padding: "6px 10px", display: "inline-flex", alignItems: "center", gap: 5, opacity: disabled ? 0.45 : 1,
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={disabled} onClick={() => downloadFile(build("xlsx"))} style={btn}><FileSpreadsheet size={13} /> Excel</button>
      <button type="button" disabled={disabled} onClick={() => downloadFile(build("csv"))} style={btn}><Download size={13} /> CSV</button>
      {shareFormat && <button type="button" disabled={disabled || busy} onClick={handleShare} style={btn}><Share2 size={13} /> Share{shareFormat === "csv" ? " (CSV)" : ""}</button>}
      {note && <span className="text-xs" style={{ color: "#6B6960" }}>{note}</span>}
    </div>
  );
}
