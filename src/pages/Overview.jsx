import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Package, MessageSquare, Image, AlertCircle, AlertTriangle, Wallet, TrendingUp, FileText } from "lucide-react";
import { api } from "../api";
import { C } from "../tokens";
import Layout from "../components/Layout";
import { Card, Loading, ErrorBanner, ExplainerBox, Badge, formatMoney } from "../components/ui";
import { useAuth } from "../AuthContext";

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

export default function Overview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const { admin } = useAuth();
  const isOwner = admin?.role === "owner";

  useEffect(() => {
    async function load() {
      try {
        const [products, quotes, projects, quotations, sales] = await Promise.all([
          api.listProducts(), api.listQuotes(), api.listProjects(), api.listQuotations(), api.listSales(),
        ]);
        setData({ products, quotes, projects, quotations, sales });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const view = useMemo(() => {
    if (!data) return null;
    const { products, quotes, quotations, sales } = data;
    const newQuotes = quotes.filter((q) => q.status === "New").length;

    // Stock that needs reordering: out first, then lowest quantity.
    const lowStock = products
      .filter((p) => p.status !== "Made to order" && (p.quantity ?? 0) <= (p.lowStockThreshold ?? 5))
      .sort((a, b) => (a.quantity ?? 0) - (b.quantity ?? 0));

    const today = startOfToday();
    const soldToday = sales.filter((s) => new Date(s.date) >= today);
    const soldTodayTotal = soldToday.reduce((n, s) => n + s.totalAmount, 0);

    // Who still owes money, grouped by customer (phone if known, otherwise name).
    const owing = new Map();
    for (const s of sales) {
      const owed = s.totalAmount - s.amountPaid;
      if (owed <= 0.005) continue;
      const key = s.customerPhone || s.customerName || "Unknown customer";
      const row = owing.get(key) || { name: s.customerName || "Unknown customer", phone: s.customerPhone, owed: 0, oldest: new Date(s.date) };
      row.owed += owed;
      if (new Date(s.date) < row.oldest) row.oldest = new Date(s.date);
      owing.set(key, row);
    }
    const debtors = [...owing.values()].sort((a, b) => b.owed - a.owed);
    const totalOwed = debtors.reduce((n, d) => n + d.owed, 0);

    // Quotations sent but not answered, soonest expiry first.
    const soon = new Date(Date.now() + 3 * 864e5);
    const waitingQuotations = quotations
      .filter((q) => ["Draft", "Sent"].includes(q.status))
      .map((q) => ({ ...q, expiring: q.validUntil && new Date(q.validUntil) <= soon }))
      .sort((a, b) => new Date(a.validUntil || 8.64e15) - new Date(b.validUntil || 8.64e15));

    return { newQuotes, lowStock, soldToday, soldTodayTotal, debtors, totalOwed, waitingQuotations };
  }, [data]);

  return (
    <Layout>
      <h1 className="text-xl font-bold mb-1" style={{ color: C.ink }}>Overview</h1>
      <ExplainerBox>
        Your home page: what happened today and what needs your attention — stock that is running out, customers who still owe you, and quotations waiting for an answer.
      </ExplainerBox>

      <ErrorBanner message={error} />
      {loading ? (
        <Loading />
      ) : view && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={TrendingUp} label={`Sold today (${view.soldToday.length} sale${view.soldToday.length === 1 ? "" : "s"})`} value={formatMoney(view.soldTodayTotal)} />
            <StatCard icon={AlertTriangle} label="Products running low" value={view.lowStock.length} accent={view.lowStock.length > 0} />
            <StatCard icon={MessageSquare} label="New quote requests" value={view.newQuotes} accent={view.newQuotes > 0} />
            <StatCard icon={Package} label={`Products · ${data.projects.length} projects`} value={data.products.length} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
            <Panel
              icon={AlertTriangle} title="Running low — time to restock" linkTo="/purchases" linkLabel="Record stock in"
              empty="Nothing is running low. 👍" count={view.lowStock.length}
            >
              {view.lowStock.slice(0, 8).map((p) => (
                <Row key={p._id} left={p.name} sub={p.ref} right={
                  <Badge tone={(p.quantity ?? 0) <= 0 ? "red" : "default"}>{(p.quantity ?? 0) <= 0 ? "Out of stock" : `${p.quantity} left`}</Badge>
                } />
              ))}
              {view.lowStock.length > 8 && <More to="/products" text={`and ${view.lowStock.length - 8} more…`} />}
            </Panel>

            <Panel
              icon={Wallet} title={`Customers who owe you${view.debtors.length ? " — " + formatMoney(view.totalOwed) : ""}`}
              linkTo={isOwner ? "/customers" : "/sales"} linkLabel={isOwner ? "See customers" : "See sales"}
              empty="Nobody owes you money right now. 👍" count={view.debtors.length}
            >
              {view.debtors.slice(0, 6).map((d, i) => (
                <Row key={i} left={d.name} sub={`since ${d.oldest.toLocaleDateString()}${d.phone ? " · " + d.phone : ""}`} right={<strong style={{ color: C.red }}>{formatMoney(d.owed)}</strong>} />
              ))}
              {view.debtors.length > 6 && <More to="/sales" text={`and ${view.debtors.length - 6} more…`} />}
            </Panel>

            <Panel
              icon={FileText} title="Quotations waiting for an answer" linkTo="/quotations" linkLabel="Open quotations"
              empty="No quotations waiting." count={view.waitingQuotations.length}
            >
              {view.waitingQuotations.slice(0, 6).map((q) => (
                <Row key={q._id} left={`${q.number} — ${q.customerName}`} sub={q.validUntil ? `valid until ${new Date(q.validUntil).toLocaleDateString()}` : ""} right={
                  <span className="text-sm">{formatMoney(q.lines.reduce((n, l) => n + l.quantity * l.unitPrice, 0) - (q.discount || 0))} {q.expiring && <Badge tone="red">Expiring</Badge>}</span>
                } />
              ))}
            </Panel>

            <Panel
              icon={AlertCircle} title="Customers waiting to hear back" linkTo="/quotes" linkLabel="Quote requests"
              empty="All website enquiries have been answered." count={view.newQuotes}
            >
              {data.quotes.filter((q) => q.status === "New").slice(0, 6).map((q) => (
                <Row key={q._id} left={q.name} sub={`${q.product || q.requestType} · ${new Date(q.createdAt).toLocaleDateString()}`} right={<span className="text-xs">{q.phone}</span>} />
              ))}
            </Panel>
          </div>
        </>
      )}
    </Layout>
  );
}

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <Card>
      <Icon size={18} style={{ color: accent ? C.safety : C.blueprint }} className="mb-3" />
      <p className="text-2xl font-bold" style={{ color: C.ink }}>{value}</p>
      <p className="text-xs mt-1" style={{ color: "#6B6960" }}>{label}</p>
    </Card>
  );
}

function Panel({ icon: Icon, title, linkTo, linkLabel, empty, count, children }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-sm font-semibold flex items-center gap-2" style={{ color: C.ink }}>
          <Icon size={15} style={{ color: count > 0 ? C.safety : C.blueprint }} /> {title}
        </p>
        <Link to={linkTo} className="text-xs underline" style={{ color: C.blueprint }}>{linkLabel}</Link>
      </div>
      {count === 0 ? <p className="text-sm" style={{ color: "#6B6960" }}>{empty}</p> : <div>{children}</div>}
    </Card>
  );
}

function Row({ left, sub, right }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2" style={{ borderTop: `1px solid ${C.ink}0F` }}>
      <div>
        <p className="text-sm" style={{ color: C.ink }}>{left}</p>
        {sub && <p className="text-xs" style={{ color: "#8A877D" }}>{sub}</p>}
      </div>
      <div className="text-sm text-right">{right}</div>
    </div>
  );
}

function More({ to, text }) {
  return <Link to={to} className="block text-xs pt-2 underline" style={{ color: C.blueprint }}>{text}</Link>;
}
