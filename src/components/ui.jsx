import React from "react";
import { C } from "../tokens";

export function PageHeader({ title, action }) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
      <h1 className="text-xl font-bold" style={{ color: C.ink }}>{title}</h1>
      {action}
    </div>
  );
}

export function Button({ children, onClick, variant = "primary", type = "button", disabled, icon: Icon }) {
  const styles = {
    primary: { background: C.safety, color: "white" },
    ghost: { background: "transparent", color: C.ink, border: `1px solid ${C.ink}33` },
    danger: { background: "transparent", color: C.red, border: `1px solid ${C.red}55` },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium disabled:opacity-50"
      style={styles[variant]}
    >
      {Icon && <Icon size={14} />} {children}
    </button>
  );
}

export function Card({ children, className = "" }) {
  return (
    <div className={`p-5 ${className}`} style={{ background: C.cream, border: `1px solid ${C.ink}1A` }}>
      {children}
    </div>
  );
}

export function Badge({ children, tone = "default" }) {
  const tones = {
    default: { background: "#E4DFD3", color: "#6B6960" },
    green: { background: C.greenBg, color: C.green },
    red: { background: C.redBg, color: C.red },
  };
  return (
    <span className="text-xs px-2 py-1 uppercase tracking-wide" style={tones[tone]}>
      {children}
    </span>
  );
}

export function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wide mb-1.5" style={{ color: "#6B6960" }}>{label}</label>
      {children}
    </div>
  );
}

export const inputStyle = {
  width: "100%",
  padding: "9px 12px",
  fontSize: 14,
  border: "1px solid #C9C5BA",
  background: "white",
  color: C.ink,
};

export function EmptyState({ message }) {
  return (
    <div className="text-center py-16 text-sm" style={{ color: "#8A877D" }}>
      {message}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder || "Search..."}
      className="text-sm px-3 py-2"
      style={{ border: "1px solid #C9C5BA", background: "white", minWidth: 220 }}
    />
  );
}

const PERIODS = ["All", "This Week", "This Month", "This Year"];

export function PeriodFilter({ value, onChange }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {PERIODS.map(p => (
        <button key={p} onClick={() => onChange(p)} className="text-xs uppercase tracking-wide px-3 py-1.5"
          style={{ border: `1px solid ${value === p ? C.safety : "#C9C5BA"}`, color: value === p ? C.safety : "#6B6960" }}>
          {p}
        </button>
      ))}
    </div>
  );
}

// Filters a list of items down to a period, based on a date field on each item.
export function filterByPeriod(items, period, dateField = "date") {
  if (period === "All") return items;
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (period === "This Week") start.setDate(start.getDate() - start.getDay());
  else if (period === "This Month") start.setDate(1);
  else if (period === "This Year") start.setMonth(0, 1);
  return items.filter(item => new Date(item[dateField]) >= start);
}

export function Loading() {
  return (
    <div className="text-center py-16 text-sm" style={{ color: "#8A877D" }}>
      Loading...
    </div>
  );
}

export function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div className="text-sm px-4 py-3 mb-4" style={{ background: C.redBg, color: C.red }}>
      {message}
    </div>
  );
}

export function ExplainerBox({ children }) {
  return (
    <div className="text-sm px-4 py-3 mb-6 leading-relaxed" style={{ background: "#EFF6FF", color: "#1E3A5F", border: "1px solid #C7DAF0" }}>
      {children}
    </div>
  );
}
