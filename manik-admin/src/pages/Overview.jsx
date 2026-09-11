import React, { useEffect, useState } from "react";
import { Package, MessageSquare, Image, AlertCircle } from "lucide-react";
import { api } from "../api";
import { C } from "../tokens";
import Layout from "../components/Layout";
import { Card, Loading, ErrorBanner } from "../components/ui";

export default function Overview() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [products, quotes, projects] = await Promise.all([
          api.listProducts(),
          api.listQuotes(),
          api.listProjects(),
        ]);
        const newQuotes = quotes.filter((q) => q.status === "New").length;
        setStats({
          products: products.length,
          quotes: quotes.length,
          newQuotes,
          projects: projects.length,
        });
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
      <h1 className="text-xl font-bold mb-1" style={{ color: C.ink }}>Overview</h1>
      <p className="text-sm mb-6" style={{ color: "#6B6960" }}>Quick snapshot of what's happening on the site.</p>

      <ErrorBanner message={error} />
      {loading ? (
        <Loading />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Package} label="Products" value={stats.products} />
          <StatCard icon={MessageSquare} label="Quote requests" value={stats.quotes} highlight={stats.newQuotes > 0} />
          <StatCard icon={AlertCircle} label="New / unread" value={stats.newQuotes} accent={stats.newQuotes > 0} />
          <StatCard icon={Image} label="Projects" value={stats.projects} />
        </div>
      )}

      {!loading && stats?.newQuotes > 0 && (
        <div className="mt-6 p-4 text-sm" style={{ background: C.redBg, color: C.safetyDark }}>
          You have {stats.newQuotes} new quote request{stats.newQuotes > 1 ? "s" : ""} waiting — check the Quote requests page.
        </div>
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
