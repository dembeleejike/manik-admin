import React, { useEffect, useState } from "react";
import { api } from "../api";
import { C } from "../tokens";
import Layout from "../components/Layout";
import { PageHeader, Card, Loading, EmptyState, ErrorBanner, ExplainerBox } from "../components/ui";
import { useListView, FilterBar, ExportMenu } from "../components/Filters";

const AREA = {
  sale: "Sales", purchase: "Purchases", expense: "Expenses", product: "Products", quote: "Quote requests",
  category: "Categories", project: "Projects", settings: "Settings", admin: "Admin logins", password: "Passwords",
  login: "Sign-ins", export: "Exports", restore: "Restore", backup: "Backups",
};
const areaOf = (log) => AREA[log.action.split(".")[0]] || "Other";
const isRisky = (log) => /delete|restore|failed|admin\./.test(log.action);

const CFG = {
  dateField: "at",
  search: (l) => [l.summary, l.adminName, areaOf(l), l.action].join(" "),
  filters: [
    { key: "area", label: "Area", get: areaOf },
    { key: "who", label: "Who", get: (l) => l.adminName || "" },
    { key: "kind", label: "Type", get: (l) => (isRisky(l) ? "Deletes & sensitive" : "Normal"), options: ["Deletes & sensitive", "Normal"] },
  ],
  sorts: [
    { key: "time", label: "Time", get: (l) => new Date(l.at) },
    { key: "who", label: "Who", get: (l) => l.adminName || "" },
    { key: "area", label: "Area", get: areaOf },
  ],
  defaultSort: "time",
  defaultDir: "desc",
};

const COLUMNS = [
  { label: "When", get: (l) => l.at, type: "date" },
  { label: "Who", get: (l) => l.adminName },
  { label: "Role", get: (l) => l.role },
  { label: "Area", get: areaOf },
  { label: "What happened", get: (l) => l.summary },
];

export default function Activity() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listAudit(1000).then(setLogs).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <PageHeader title="Activity log — Who did what" />
      <ExplainerBox>
        A permanent record of important actions: sales and purchases recorded or deleted, products changed, logins added, backups and restores. If something goes missing or looks wrong, check here to see who did it and when. Only the owner can see this page.
      </ExplainerBox>
      <ErrorBanner message={error} />
      {loading ? <Loading /> : logs.length === 0 ? <EmptyState message="Nothing recorded yet." /> : <ActivityList logs={logs} />}
    </Layout>
  );
}

function ActivityList({ logs }) {
  const view = useListView(logs, CFG);
  return (
    <>
      <FilterBar
        view={view} cfg={CFG} items={logs}
        placeholder="Search anything — a name, product, 'deleted'…"
        actions={<ExportMenu rows={view.rows} columns={COLUMNS} filename="manik-activity" sheetName="Activity" title="MANIK activity log" />}
      />
      {view.rows.length === 0 ? (
        <EmptyState message="Nothing matches these filters." />
      ) : (
        <div className="space-y-2">
          {view.rows.map((l) => (
            <Card key={l._id}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm" style={{ color: C.ink }}>{l.summary}</p>
                  <p className="text-xs mt-1" style={{ color: "#8A877D" }}>
                    {l.adminName || "Unknown"}{l.role && l.role !== "system" ? ` (${l.role})` : ""} · {areaOf(l)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs" style={{ color: "#6B6960" }}>{new Date(l.at).toLocaleString()}</p>
                  {isRisky(l) && <p className="text-xs mt-1" style={{ color: C.red }}>Sensitive</p>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
