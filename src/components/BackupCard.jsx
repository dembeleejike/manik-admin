import React, { useState } from "react";
import { Download, Mail, Upload, Share2, FileSpreadsheet, ShieldCheck } from "lucide-react";
import { api } from "../api";
import { C } from "../tokens";
import { Button, Card, inputStyle } from "./ui";
import { downloadBlob, shareFile } from "../utils/files";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const DATASETS = [
  ["all", "Everything (one Excel file, a sheet for each)", false],
  ["sales", "Sales", true],
  ["purchases", "Purchases", true],
  ["expenses", "Expenses", true],
  ["customers", "Customers", false],
  ["products", "Products & stock", false],
  ["quotes", "Quote requests", true],
];

const stamp = () => new Date().toISOString().slice(0, 10);

function Section({ icon: Icon, title, children }) {
  return (
    <div className="pt-5 mt-5" style={{ borderTop: `1px solid ${C.ink}1A` }}>
      <p className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: C.ink }}>
        <Icon size={15} style={{ color: C.safety }} /> {title}
      </p>
      {children}
    </div>
  );
}

export default function BackupCard() {
  // ----- backup -----
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function run(name, fn) {
    setBusy(name); setError(""); setMessage("");
    try { await fn(); } catch (err) { setError(err.message); } finally { setBusy(""); }
  }

  // ----- spreadsheets -----
  const [dataset, setDataset] = useState("all");
  const [format, setFormat] = useState("xlsx");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const dated = DATASETS.find(([k]) => k === dataset)?.[2];
  const effectiveFormat = dataset === "all" ? "xlsx" : format;

  const sheetPath = () => {
    const q = dated && (from || to) ? `?${[from && `from=${from}`, to && `to=${to}`].filter(Boolean).join("&")}` : "";
    return `/api/export/${dataset}.${effectiveFormat}${q}`;
  };
  const sheetName = () => `manik-${dataset === "all" ? "records" : dataset}-${stamp()}.${effectiveFormat}`;

  // ----- restore -----
  const [restoreFile, setRestoreFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [plan, setPlan] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [restoreResult, setRestoreResult] = useState(null);

  function resetRestore() { setRestoreFile(null); setParsed(null); setPlan(null); setConfirmed(false); setRestoreResult(null); }

  async function handlePickFile(e) {
    const file = e.target.files[0];
    resetRestore(); setError(""); setMessage("");
    if (!file) return;
    if (file.size > 35 * 1024 * 1024) { setError("That file is too large to be a MANIK backup."); return; }
    await run("check", async () => {
      let backup;
      try {
        backup = JSON.parse(await file.text());
      } catch {
        throw new Error("That file isn't a MANIK backup. Choose a .json file from \"Download full backup\" or from the backup emails.");
      }
      const checked = await api.restoreBackup(backup, true); // preview only — nothing changes yet
      setRestoreFile(file); setParsed(backup); setPlan(checked);
    });
  }

  async function handleRestore() {
    await run("restore", async () => {
      const result = await api.restoreBackup(parsed, false);
      setRestoreResult(result); setPlan(null); setParsed(null); setConfirmed(false);
    });
  }

  const totalAdd = plan ? plan.plan.reduce((n, t) => n + t.willAdd, 0) : 0;
  const totalUpdate = plan ? plan.plan.reduce((n, t) => n + t.willUpdate, 0) : 0;

  return (
    <Card>
      <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#6B6960" }}>Backup, restore &amp; spreadsheets</p>
      <p className="text-xs mb-3" style={{ color: "#8A877D" }}>
        A full backup runs automatically every night and is emailed to the owner. Use this section to take one yourself, open your records in Excel, or put a backup back.
      </p>
      {error && <p className="text-sm mb-3" style={{ color: C.red }}>{error}</p>}
      {message && <p className="text-sm mb-3 font-medium" style={{ color: C.green }}>✓ {message}</p>}

      <Section icon={ShieldCheck} title="Back up now">
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="ghost" icon={Download} disabled={!!busy}
            onClick={() => run("dl", async () => { await api.downloadFile("/api/export/backup", `manik-backup-${stamp()}.json`); setMessage("Backup downloaded. Keep it somewhere safe."); })}>
            {busy === "dl" ? "Preparing…" : "Download full backup"}
          </Button>
          <Button type="button" variant="ghost" icon={Mail} disabled={!!busy}
            onClick={() => run("mail", async () => { const r = await api.emailBackup(); setMessage(r.message); })}>
            {busy === "mail" ? "Sending…" : "Email me a backup now"}
          </Button>
        </div>
        <p className="text-xs mt-2" style={{ color: "#8A877D" }}>
          The email has two files: the backup (.json, used to restore) and an Excel copy you can read. Backups contain private customer and money records — don't forward them.
        </p>
      </Section>

      <Section icon={FileSpreadsheet} title="Spreadsheets (Excel / CSV)">
        <div className="flex flex-wrap gap-2 items-center">
          <select value={dataset} onChange={(e) => setDataset(e.target.value)} style={{ ...inputStyle, width: "auto" }} aria-label="What to export">
            {DATASETS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          {dataset !== "all" && (
            <select value={format} onChange={(e) => setFormat(e.target.value)} style={{ ...inputStyle, width: "auto" }} aria-label="File type">
              <option value="xlsx">Excel (.xlsx)</option>
              <option value="csv">CSV</option>
            </select>
          )}
        </div>
        {dated && (
          <div className="flex flex-wrap gap-2 items-center mt-2">
            <span className="text-xs" style={{ color: "#6B6960" }}>Only from</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ ...inputStyle, width: "auto" }} aria-label="From date" />
            <span className="text-xs" style={{ color: "#6B6960" }}>to</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ ...inputStyle, width: "auto" }} aria-label="To date" />
            <span className="text-xs" style={{ color: "#8A877D" }}>(leave empty for everything)</span>
          </div>
        )}
        <div className="flex flex-wrap gap-3 mt-3">
          <Button type="button" variant="ghost" icon={Download} disabled={!!busy}
            onClick={() => run("sheet", async () => { await api.downloadFile(sheetPath(), sheetName()); setMessage("Spreadsheet downloaded."); })}>
            {busy === "sheet" ? "Preparing…" : "Download"}
          </Button>
          {typeof navigator !== "undefined" && navigator.share && (
            <Button type="button" variant="ghost" icon={Share2} disabled={!!busy}
              onClick={() => run("share", async () => {
                const blob = await api.fetchBlob(sheetPath());
                const file = new File([blob], sheetName(), { type: effectiveFormat === "xlsx" ? XLSX_MIME : "text/csv" });
                if (!(await shareFile(file, "MANIK records"))) { downloadBlob(blob, sheetName()); setMessage("Sharing isn't available here, so it was downloaded instead."); }
              })}>
              {busy === "share" ? "Preparing…" : "Share…"}
            </Button>
          )}
        </div>
        <p className="text-xs mt-2" style={{ color: "#8A877D" }}>
          On every list page (Sales, Purchases, Expenses, Customers…) you can also export exactly what you've searched or filtered.
        </p>
      </Section>

      <Section icon={Upload} title="Restore from a backup">
        <p className="text-xs mb-3" style={{ color: "#8A877D" }}>
          Choose a backup file (.json). You'll see exactly what would change <strong>before</strong> anything happens. Restoring puts every record in the file back — it never deletes anything you added after the backup was made. A safety copy of your current data is emailed to you first.
        </p>
        <input type="file" accept=".json,application/json" onChange={handlePickFile} disabled={!!busy} className="text-sm" />
        {busy === "check" && <p className="text-sm mt-2" style={{ color: "#6B6960" }}>Checking the file…</p>}

        {plan && (
          <div className="mt-4 p-4" style={{ background: C.concreteD }}>
            <p className="text-sm font-semibold mb-1" style={{ color: C.ink }}>
              Backup from {plan.exportedAt ? new Date(plan.exportedAt).toLocaleString() : "an unknown date"} — {restoreFile?.name}
            </p>
            <div className="overflow-x-auto">
              <table className="text-xs w-full mt-2" style={{ color: C.ink }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "#6B6960" }}>
                    <th className="py-1 pr-3">Records</th><th className="pr-3">In file</th><th className="pr-3">Will be updated</th><th className="pr-3">Will be re-added</th><th>Skipped (damaged)</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.plan.map((t) => (
                    <tr key={t.table} style={{ borderTop: "1px solid #C9C5BA" }}>
                      <td className="py-1 pr-3">{t.table}</td><td className="pr-3">{t.inFile}</td><td className="pr-3">{t.willUpdate}</td><td className="pr-3">{t.willAdd}</td><td>{t.skipped}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs mt-3" style={{ color: "#54524C" }}>
              In plain words: {totalUpdate} records will be set back to how they were in the backup, and {totalAdd} that are missing now will be brought back.
            </p>
            <label className="flex items-start gap-2 text-sm mt-3" style={{ color: C.ink }}>
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1" />
              I understand this will overwrite the matching records with the versions in this file.
            </label>
            <div className="flex gap-3 mt-3">
              <Button type="button" disabled={!confirmed || busy === "restore"} onClick={handleRestore}>
                {busy === "restore" ? "Restoring…" : "Restore now"}
              </Button>
              <Button type="button" variant="ghost" onClick={resetRestore}>Cancel</Button>
            </div>
          </div>
        )}

        {restoreResult && (
          <div className="mt-4 p-4" style={{ background: C.greenBg }}>
            <p className="text-sm font-semibold" style={{ color: C.green }}>✓ {restoreResult.message}</p>
            <p className="text-xs mt-1" style={{ color: "#54524C" }}>
              {restoreResult.safetyCopyEmailed ? "A safety copy of your previous data was emailed to you." : "No safety copy was emailed (email isn't set up) — the restore still went through."}
            </p>
            <Button type="button" variant="ghost" onClick={resetRestore}>Done</Button>
          </div>
        )}
      </Section>
    </Card>
  );
}
