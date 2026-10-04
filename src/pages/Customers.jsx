import React, { useEffect, useState } from "react";
import { X, Phone, MapPin } from "lucide-react";
import { api } from "../api";
import { C } from "../tokens";
import Layout from "../components/Layout";
import { PageHeader, Card, Badge, Loading, EmptyState, ErrorBanner, ExplainerBox } from "../components/ui";
import { useListView, FilterBar, ExportMenu } from "../components/Filters";
import PdfActions from "../components/PdfActions";
import { buildStatementPdf } from "../utils/documents";
import { naira } from "../utils/files";

function formatMoney(n) {
  return "₦" + Number(n || 0).toLocaleString();
}

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        setCustomers(await api.listCustomers());
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <Layout>
      <PageHeader title="Customers — Who has bought from you" />
      <ExplainerBox>
        Everyone who has ever bought something shows up here automatically — you never need to add them yourself. Tap a customer to see everything they've bought, and whether they still owe you money.
      </ExplainerBox>
      <ErrorBanner message={error} />

      {loading ? <Loading /> : <CustomerList customers={customers} onSelect={setSelected} />}

      {selected && <CustomerDetail customerId={selected._id} onClose={() => setSelected(null)} />}
    </Layout>
  );
}

const CUSTOMERS_CFG = {
  dateField: "lastPurchase", // the date range means "bought something in this period"
  search: (c) => [c.name, c.phone, c.whatsapp, c.location, c.notes].join(" "),
  filters: [
    { key: "owes", label: "Balance", get: (c) => (c.outstandingBalance > 0 ? "Owes money" : "Fully paid"), options: ["Owes money", "Fully paid"] },
    { key: "location", label: "Location", get: (c) => c.location || "" },
  ],
  sorts: [
    { key: "spent", label: "Total spent", get: (c) => c.totalSpent },
    { key: "name", label: "Name", get: (c) => c.name },
    { key: "owed", label: "Balance owed", get: (c) => c.outstandingBalance },
    { key: "count", label: "Number of purchases", get: (c) => c.purchaseCount },
    { key: "last", label: "Last purchase", get: (c) => (c.lastPurchase ? new Date(c.lastPurchase) : null) },
  ],
  defaultSort: "spent",
  defaultDir: "desc",
};

const CUSTOMERS_COLUMNS = [
  { label: "Name", get: (c) => c.name },
  { label: "Phone", get: (c) => c.phone },
  { label: "WhatsApp", get: (c) => c.whatsapp },
  { label: "Location", get: (c) => c.location },
  { label: "Purchases", get: (c) => c.purchaseCount, type: "number" },
  { label: "Total bought", get: (c) => c.totalSpent, type: "money" },
  { label: "Balance owed", get: (c) => c.outstandingBalance, type: "money" },
  { label: "Last purchase", get: (c) => c.lastPurchase, type: "date" },
  { label: "Notes", get: (c) => c.notes },
];

function CustomerList({ customers, onSelect }) {
  const view = useListView(customers, CUSTOMERS_CFG);
  if (customers.length === 0) {
    return <EmptyState message="No customers yet — they'll appear here once you record your first sale." />;
  }
  return (
    <>
      <FilterBar
        view={view} cfg={CUSTOMERS_CFG} items={customers}
        placeholder="Search name, phone, location…"
        actions={<ExportMenu rows={view.rows} columns={CUSTOMERS_COLUMNS} filename="manik-customers" sheetName="Customers" title="MANIK customers" />}
      />
      {view.rows.length === 0 ? (
        <EmptyState message="No customers match these filters." />
      ) : (
        <div className="space-y-2">
          {view.rows.map((c) => (
            <Card key={c._id} className="cursor-pointer" onClick={() => onSelect(c)}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-semibold" style={{ color: C.ink }}>{c.name}</p>
                  <p className="text-sm mt-1 flex items-center gap-1.5" style={{ color: "#6B6960" }}>
                    <Phone size={12} /> {c.phone} {c.location && <><MapPin size={12} className="ml-2" /> {c.location}</>}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm" style={{ color: C.ink }}>{c.purchaseCount} purchase{c.purchaseCount !== 1 ? "s" : ""} · {formatMoney(c.totalSpent)}</p>
                  {c.outstandingBalance > 0 && <Badge tone="red">{formatMoney(c.outstandingBalance)} owed</Badge>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function CustomerDetail({ customerId, onClose }) {
  const [data, setData] = useState(null);
  const [settings, setSettings] = useState(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [customer, st] = await Promise.all([api.getCustomer(customerId), api.getSettings().catch(() => null)]);
        setSettings(st);
        setData(customer);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [customerId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "#00000088" }} onClick={onClose}>
      <div className="max-w-lg w-full max-h-[85vh] overflow-y-auto p-6" style={{ background: C.cream }} onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h2 className="font-bold text-lg" style={{ color: C.ink }}>Customer history</h2>
          <button onClick={onClose}><X size={18} color={C.ink} /></button>
        </div>
        {loading ? <Loading /> : error ? <ErrorBanner message={error} /> : data && (
          <>
            <p className="font-semibold" style={{ color: C.ink }}>{data.name}</p>
            <p className="text-sm mb-4" style={{ color: "#6B6960" }}>{data.phone} {data.location && `· ${data.location}`}</p>
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="p-3" style={{ background: C.concreteD }}>
                <p className="text-xs" style={{ color: "#6B6960" }}>Total spent</p>
                <p className="font-bold" style={{ color: C.ink }}>{formatMoney(data.totalSpent)}</p>
              </div>
              <div className="p-3" style={{ background: C.concreteD }}>
                <p className="text-xs" style={{ color: "#6B6960" }}>Purchases</p>
                <p className="font-bold" style={{ color: C.ink }}>{data.purchaseCount}</p>
              </div>
              <div className="p-3" style={{ background: data.outstandingBalance > 0 ? C.redBg : C.concreteD }}>
                <p className="text-xs" style={{ color: "#6B6960" }}>Still owes you</p>
                <p className="font-bold" style={{ color: data.outstandingBalance > 0 ? C.red : C.ink }}>{formatMoney(data.outstandingBalance)}</p>
              </div>
            </div>
            <div className="p-4 mb-6" style={{ background: "white", border: "1px solid #C9C5BA" }}>
              <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "#6B6960" }}>Account statement</p>
              <div className="flex flex-wrap gap-2 items-center mb-3">
                <span className="text-xs" style={{ color: "#6B6960" }}>From</span>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="text-sm px-2 py-1" style={{ border: "1px solid #C9C5BA" }} aria-label="From date" />
                <span className="text-xs" style={{ color: "#6B6960" }}>to</span>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="text-sm px-2 py-1" style={{ border: "1px solid #C9C5BA" }} aria-label="To date" />
                <span className="text-xs" style={{ color: "#8A877D" }}>(empty = everything)</span>
              </div>
              <PdfActions
                title={`Statement — ${data.name}`}
                filename={`Statement-${data.name.replace(/[^A-Za-z0-9]+/g, "-")}`}
                build={() => buildStatementPdf(data, data.sales, settings, { from, to })}
                whatsapp={{
                  phone: data.phone,
                  text: data.outstandingBalance > 0
                    ? `Hello ${data.name}, this is a friendly reminder from ${settings?.businessName || "us"}. Your account has an outstanding balance of ${naira(data.outstandingBalance)}. Please let us know when you can settle it. Thank you!`
                    : `Hello ${data.name}, thank you for your business with ${settings?.businessName || "us"}. Your account is fully paid.`,
                }}
              />
              {data.outstandingBalance > 0 && <p className="text-xs mt-2" style={{ color: "#8A877D" }}>The WhatsApp button sends a polite payment reminder.</p>}
            </div>
            <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "#6B6960" }}>Purchase history</p>
            <div className="space-y-2">
              {data.sales.map(s => (
                <div key={s._id} className="p-3 text-sm" style={{ background: "white", border: "1px solid #C9C5BA" }}>
                  <div className="flex justify-between">
                    <span style={{ color: C.ink }}>{s.productName} × {s.quantity}</span>
                    <span style={{ color: C.ink }}>{formatMoney(s.totalAmount)}</span>
                  </div>
                  <p className="text-xs mt-1" style={{ color: "#8A877D" }}>{new Date(s.date).toLocaleDateString()} · {s.paymentStatus}{s.totalAmount - s.amountPaid > 0.005 ? ` · owes ${formatMoney(s.totalAmount - s.amountPaid)}` : ""}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
