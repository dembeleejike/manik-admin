import React, { useEffect, useState } from "react";
import { Phone, Trash2 } from "lucide-react";
import { api } from "../api";
import { C } from "../tokens";
import Layout from "../components/Layout";
import { PageHeader, Card, Badge, Loading, EmptyState, ErrorBanner } from "../components/ui";

const STATUS_TONE = { New: "red", Contacted: "default", Closed: "green" };

export default function Quotes() {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("All");

  async function load() {
    setLoading(true);
    try {
      const data = await api.listQuotes();
      setQuotes(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function updateStatus(id, status) {
    try {
      await api.updateQuoteStatus(id, status);
      setQuotes((prev) => prev.map((q) => (q._id === id ? { ...q, status } : q)));
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this quote request?")) return;
    try {
      await api.deleteQuote(id);
      setQuotes((prev) => prev.filter((q) => q._id !== id));
    } catch (err) {
      alert(err.message);
    }
  }

  const filtered = filter === "All" ? quotes : quotes.filter((q) => q.status === filter);

  return (
    <Layout>
      <PageHeader title="Quote requests" />
      <ErrorBanner message={error} />

      <div className="flex gap-2 mb-5">
        {["All", "New", "Contacted", "Closed"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="text-xs uppercase tracking-wide px-3 py-1.5"
            style={{
              border: `1px solid ${filter === f ? C.safety : "#C9C5BA"}`,
              color: filter === f ? C.safety : "#6B6960",
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <EmptyState message="No quote requests here yet." />
      ) : (
        <div className="space-y-3">
          {filtered.map((q) => (
            <Card key={q._id}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold" style={{ color: C.ink }}>{q.name}</p>
                    <Badge tone={STATUS_TONE[q.status]}>{q.status}</Badge>
                  </div>
                  <p className="text-sm mt-1 flex items-center gap-1.5" style={{ color: "#6B6960" }}>
                    <Phone size={12} /> {q.phone} · prefers {q.preferredContact}
                  </p>
                  <p className="text-sm mt-2" style={{ color: C.ink }}><strong>{q.product}</strong>{q.quantity ? ` — ${q.quantity}` : ""}</p>
                  {q.notes && <p className="text-sm mt-1" style={{ color: "#6B6960" }}>{q.notes}</p>}
                  <p className="text-xs mt-2" style={{ color: "#8A877D" }}>{new Date(q.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <select
                    value={q.status}
                    onChange={(e) => updateStatus(q._id, e.target.value)}
                    className="text-xs px-2 py-1.5"
                    style={{ border: "1px solid #C9C5BA", background: "white" }}
                  >
                    <option>New</option>
                    <option>Contacted</option>
                    <option>Closed</option>
                  </select>
                  <button onClick={() => handleDelete(q._id)} className="text-xs flex items-center gap-1" style={{ color: C.red }}>
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Layout>
  );
}
