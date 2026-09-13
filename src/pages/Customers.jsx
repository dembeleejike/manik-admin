import React, { useEffect, useState } from "react";
import { X, Phone, MapPin } from "lucide-react";
import { api } from "../api";
import { C } from "../tokens";
import Layout from "../components/Layout";
import { PageHeader, Card, Badge, Loading, EmptyState, ErrorBanner, ExplainerBox } from "../components/ui";

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

      {loading ? <Loading /> : customers.length === 0 ? (
        <EmptyState message="No customers yet — they'll appear here once you record your first sale." />
      ) : (
        <div className="space-y-2">
          {customers.map(c => (
            <Card key={c._id} className="cursor-pointer" onClick={() => setSelected(c)}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-semibold" style={{ color: C.ink }}>{c.name}</p>
                  <p className="text-sm mt-1 flex items-center gap-1.5" style={{ color: "#6B6960" }}>
                    <Phone size={12} /> {c.phone} {c.location && <><MapPin size={12} className="ml-2" /> {c.location}</>}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm" style={{ color: C.ink }}>{c.purchaseCount} purchase{c.purchaseCount !== 1 ? "s" : ""} · {formatMoney(c.totalSpent)}</p>
                  {c.outstandingBalance > 0 && (
                    <Badge tone="red">{formatMoney(c.outstandingBalance)} owed</Badge>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {selected && <CustomerDetail customerId={selected._id} onClose={() => setSelected(null)} />}
    </Layout>
  );
}

function CustomerDetail({ customerId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setData(await api.getCustomer(customerId));
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
            <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "#6B6960" }}>Purchase history</p>
            <div className="space-y-2">
              {data.sales.map(s => (
                <div key={s._id} className="p-3 text-sm" style={{ background: "white", border: "1px solid #C9C5BA" }}>
                  <div className="flex justify-between">
                    <span style={{ color: C.ink }}>{s.productName} × {s.quantity}</span>
                    <span style={{ color: C.ink }}>{formatMoney(s.totalAmount)}</span>
                  </div>
                  <p className="text-xs mt-1" style={{ color: "#8A877D" }}>{new Date(s.date).toLocaleDateString()} · {s.paymentStatus}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
