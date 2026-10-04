// Builds the business's printable documents as real PDFs:
//   quotation, invoice, receipt, customer statement.
// All of them share one letterhead and one table layout.
import { Pdf, PAGE } from "./pdf";

const INK = "#171A1C";
const MUTED = "#6B6960";
const ACCENT = "#E2591F";
const BAND = "#E4DFD3";
const RULE = "#C9C5BA";
const GREEN = "#2F5D2A";
const RED = "#B8430F";

const M = 40; // page margin
const W = PAGE.width - M * 2;

export const money = (n) => "₦" + Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateText = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");

// ---------- shared pieces ----------

function letterhead(doc, settings, title, accent = ACCENT) {
  const name = settings?.businessName || "MANIK";
  doc.rect(0, 0, PAGE.width, 8, { fill: accent });
  doc.text(name, M, 46, { size: 17, bold: true, color: INK });
  let y = 58;
  if (settings?.tagline) { doc.text(settings.tagline, M, y + 4, { size: 9, color: MUTED }); y += 14; }
  const lines = [];
  for (const loc of settings?.locations || []) lines.push((loc.label ? loc.label + ": " : "") + loc.address);
  const phones = [settings?.phone, settings?.phone2].filter(Boolean).join(" / ");
  if (phones) lines.push("Tel: " + phones);
  if (settings?.email) lines.push(settings.email);
  const left = W * 0.58;
  for (const line of lines) y = doc.paragraph(line, M, y, left, { size: 8, color: MUTED, leading: 11 });

  doc.text(title, PAGE.width - M, 52, { size: 22, bold: true, color: accent, align: "right" });
  return Math.max(y, 92) + 10;
}

// A small "label / value" block, right aligned values. Returns the y below it.
function metaBlock(doc, x, y, width, rows) {
  for (const [label, value, color] of rows) {
    if (value === undefined || value === null || value === "") continue;
    doc.text(label, x, y + 9, { size: 8.5, color: MUTED });
    doc.text(String(value), x + width, y + 9, { size: 9, bold: true, color: color || INK, align: "right" });
    y += 15;
  }
  return y;
}

function partyBlock(doc, x, y, width, heading, party) {
  doc.text(heading, x, y + 8, { size: 8, bold: true, color: MUTED });
  y += 14;
  if (party.name) { doc.text(party.name, x, y + 10, { size: 11, bold: true }); y += 15; }
  for (const line of [party.phone, party.location].filter(Boolean)) y = doc.paragraph(line, x, y, width, { size: 9, color: INK, leading: 12 });
  return y;
}

// Table with automatic page breaks. columns: [{ key, label, width, align }]
// rows: array of objects (values already formatted as strings).
function table(doc, y, columns, rows, { onNewPage, rowHeightMin = 20 } = {}) {
  const total = columns.reduce((n, c) => n + c.width, 0);
  const widths = columns.map((c) => (c.width / total) * W);

  const header = (yy) => {
    doc.rect(M, yy, W, 20, { fill: BAND });
    let x = M;
    columns.forEach((c, i) => {
      const tx = c.align === "right" ? x + widths[i] - 6 : x + 6;
      doc.text(c.label, tx, yy + 13.5, { size: 8.5, bold: true, color: INK, align: c.align === "right" ? "right" : "left" });
      x += widths[i];
    });
    return yy + 20;
  };

  y = header(y);
  const bottom = PAGE.height - 90;
  rows.forEach((row) => {
    // work out the height this row needs (wrapped description etc.)
    const cellLines = columns.map((c, i) => doc.wrap(String(row[c.key] ?? ""), widths[i] - 12, 9, !!row._bold));
    const h = Math.max(rowHeightMin, Math.max(...cellLines.map((l) => l.length)) * 12 + 8);
    if (y + h > bottom) {
      doc.addPage();
      y = (onNewPage ? onNewPage(doc) : 60);
      y = header(y);
    }
    let x = M;
    columns.forEach((c, i) => {
      cellLines[i].forEach((line, li) => {
        const tx = c.align === "right" ? x + widths[i] - 6 : x + 6;
        doc.text(line, tx, y + 14 + li * 12, { size: 9, bold: !!row._bold, color: row._color && c.key === row._colorKey ? row._color : INK, align: c.align === "right" ? "right" : "left" });
      });
      x += widths[i];
    });
    doc.line(M, y + h, M + W, y + h, { color: "#E2DED3", width: 0.5 });
    y += h;
  });
  return y;
}

function totalsBlock(doc, y, rows) {
  const w = 230;
  const x = PAGE.width - M - w;
  for (const r of rows) {
    if (r.rule) { doc.line(x, y + 2, x + w, y + 2, { color: RULE }); y += 8; }
    doc.text(r.label, x, y + 12, { size: r.big ? 11 : 9, bold: !!r.big, color: r.big ? INK : MUTED });
    doc.text(r.value, x + w, y + 12, { size: r.big ? 12 : 9.5, bold: !!r.big || !!r.bold, color: r.color || INK, align: "right" });
    y += r.big ? 22 : 17;
  }
  return y;
}

function footers(doc, settings, footerNote) {
  const total = doc.pageCount;
  for (let p = 1; p <= total; p++) {
    doc.goToPage(p);
    doc.line(M, PAGE.height - 52, PAGE.width - M, PAGE.height - 52, { color: RULE });
    if (footerNote) doc.text(footerNote, M, PAGE.height - 38, { size: 8, color: MUTED });
    doc.text(`${settings?.businessName || "MANIK"}  •  Page ${p} of ${total}`, PAGE.width - M, PAGE.height - 38, { size: 8, color: MUTED, align: "right" });
  }
}

function notesBlock(doc, y, heading, text) {
  if (!text) return y;
  if (y > PAGE.height - 160) { doc.addPage(); y = 60; }
  doc.text(heading, M, y + 8, { size: 8, bold: true, color: MUTED });
  return doc.paragraph(text, M, y + 14, W * 0.62, { size: 9, color: INK, leading: 12.5 }) + 6;
}

const lineRows = (lines) =>
  lines.map((l, i) => ({
    n: String(i + 1),
    description: l.description,
    qty: String(l.quantity),
    price: money(l.unitPrice),
    amount: money(l.quantity * l.unitPrice),
  }));

const ITEM_COLUMNS = [
  { key: "n", label: "#", width: 22 },
  { key: "description", label: "Description", width: 280 },
  { key: "qty", label: "Qty", width: 40, align: "right" },
  { key: "price", label: "Unit price", width: 90, align: "right" },
  { key: "amount", label: "Amount", width: 95, align: "right" },
];

// ---------- quotation ----------
// quotation: { number, createdAt, validUntil, customerName, customerPhone, customerLocation,
//              lines:[{description, quantity, unitPrice}], discount, notes, status }
export function buildQuotationPdf(quotation, settings) {
  const doc = new Pdf({ title: `Quotation ${quotation.number}` });
  let y = letterhead(doc, settings, "QUOTATION");

  const leftEnd = partyBlock(doc, M, y, W * 0.5, "PREPARED FOR", {
    name: quotation.customerName, phone: quotation.customerPhone, location: quotation.customerLocation,
  });
  const rightEnd = metaBlock(doc, PAGE.width - M - 200, y, 200, [
    ["Quotation no.", quotation.number],
    ["Date", dateText(quotation.createdAt)],
    ["Valid until", dateText(quotation.validUntil)],
  ]);
  y = Math.max(leftEnd, rightEnd) + 14;

  y = table(doc, y, ITEM_COLUMNS, lineRows(quotation.lines));
  const subtotal = quotation.lines.reduce((n, l) => n + l.quantity * l.unitPrice, 0);
  const discount = Number(quotation.discount) || 0;
  if (y > PAGE.height - 170) { doc.addPage(); y = 60; }
  y = totalsBlock(doc, y + 10, [
    { label: "Subtotal", value: money(subtotal) },
    ...(discount > 0 ? [{ label: "Discount", value: "-" + money(discount), color: RED }] : []),
    { label: "TOTAL", value: money(subtotal - discount), big: true, rule: true },
  ]);
  y = notesBlock(doc, y + 8, "NOTES", quotation.notes);
  y = notesBlock(doc, y, "TERMS", `Prices are valid until ${dateText(quotation.validUntil) || "the date shown"}. Stock and prices may change after that date.`);
  footers(doc, settings, "Thank you for the opportunity to quote.");
  return doc.output();
}

// ---------- invoice / receipt ----------
// sale: one sale record. kind: "invoice" | "receipt"
export function buildSalePdf(sale, settings, kind = "invoice") {
  const isReceipt = kind === "receipt";
  const number = (isReceipt ? "R-" : "INV-") + String(sale._id || "").slice(-8).toUpperCase();
  const doc = new Pdf({ title: `${isReceipt ? "Receipt" : "Invoice"} ${number}` });
  let y = letterhead(doc, settings, isReceipt ? "RECEIPT" : "INVOICE");

  const total = sale.totalAmount ?? sale.quantity * sale.unitPrice;
  const paid = sale.amountPaid || 0;
  const owed = Math.max(0, total - paid);
  const status = owed <= 0 ? "PAID" : paid > 0 ? "PART-PAID" : "UNPAID";

  const leftEnd = partyBlock(doc, M, y, W * 0.5, isReceipt ? "RECEIVED FROM" : "BILL TO", {
    name: sale.customerName || "Customer", phone: sale.customerPhone,
  });
  const rightEnd = metaBlock(doc, PAGE.width - M - 200, y, 200, [
    [isReceipt ? "Receipt no." : "Invoice no.", number],
    ["Date", dateText(sale.date)],
    ["Status", status, status === "PAID" ? GREEN : RED],
    ["Payment method", sale.paymentMethod],
  ]);
  y = Math.max(leftEnd, rightEnd) + 14;

  y = table(doc, y, ITEM_COLUMNS, lineRows([{ description: sale.productName, quantity: sale.quantity, unitPrice: sale.unitPrice }]));
  const payments = (sale.payments || []).map((p) => ({ label: `Payment ${dateText(p.date)}`, value: money(p.amount) }));
  y = totalsBlock(doc, y + 10, [
    { label: "TOTAL", value: money(total), big: true },
    { label: "Amount paid", value: money(paid), color: GREEN, bold: true, rule: true },
    ...(owed > 0 ? [{ label: "BALANCE DUE", value: money(owed), color: RED, big: true }] : []),
  ]);
  if (payments.length) {
    y = notesBlock(doc, y + 6, "PAYMENTS RECEIVED LATER", payments.map((p) => `${p.label}: ${p.value}`).join("\n"));
  }
  y = notesBlock(doc, y + 6, "NOTES", sale.notes);
  footers(doc, settings, isReceipt ? "Thank you for your payment." : "Please pay any balance due promptly. Thank you for your business.");
  return doc.output();
}

// ---------- customer statement ----------
// customer: { name, phone, location }; sales: customer's sales (any order), each with optional payments[]
export function buildStatementPdf(customer, sales, settings, { from, to } = {}) {
  const doc = new Pdf({ title: `Statement ${customer.name}` });
  let y = letterhead(doc, settings, "STATEMENT");

  // Turn sales + later payments into one chronological ledger.
  const entries = [];
  for (const s of sales) {
    const total = s.totalAmount ?? s.quantity * s.unitPrice;
    entries.push({ date: new Date(s.date), desc: `${s.quantity} × ${s.productName}`, charge: total, credit: 0, order: 0 });
    const laterTotal = (s.payments || []).reduce((n, p) => n + p.amount, 0);
    const upfront = Math.max(0, (s.amountPaid || 0) - laterTotal);
    if (upfront > 0) entries.push({ date: new Date(s.date), desc: `Payment received (${s.paymentMethod || "Cash"})`, charge: 0, credit: upfront, order: 1 });
    for (const p of s.payments || []) {
      entries.push({ date: new Date(p.date), desc: `Payment received (${p.method || "Cash"}) — ${s.productName}`, charge: 0, credit: p.amount, order: 2 });
    }
  }
  entries.sort((a, b) => a.date - b.date || a.order - b.order);

  const start = from ? new Date(from) : null;
  const end = to ? new Date(to + "T23:59:59") : null;
  let running = 0, opening = 0;
  const visible = [];
  for (const e of entries) {
    const before = start && e.date < start;
    running += e.charge - e.credit;
    if (before) { opening = running; continue; }
    if (end && e.date > end) continue;
    visible.push({ ...e, balance: running });
  }

  const totalCharged = visible.reduce((n, e) => n + e.charge, 0);
  const totalPaid = visible.reduce((n, e) => n + e.credit, 0);
  const closing = visible.length ? visible[visible.length - 1].balance : opening;

  const leftEnd = partyBlock(doc, M, y, W * 0.5, "ACCOUNT", { name: customer.name, phone: customer.phone, location: customer.location });
  const rightEnd = metaBlock(doc, PAGE.width - M - 200, y, 200, [
    ["Statement date", dateText(new Date())],
    ["Period", from || to ? `${from ? dateText(from) : "start"} – ${to ? dateText(to) : "today"}` : "All activity"],
    ["Balance due", money(closing), closing > 0 ? RED : GREEN],
  ]);
  y = Math.max(leftEnd, rightEnd) + 14;

  const rows = [];
  if (start) rows.push({ date: "", description: "Balance brought forward", charge: "", credit: "", balance: money(opening), _bold: true });
  for (const e of visible) {
    rows.push({
      date: dateText(e.date), description: e.desc,
      charge: e.charge ? money(e.charge) : "", credit: e.credit ? money(e.credit) : "", balance: money(e.balance),
    });
  }
  if (rows.length === 0) rows.push({ date: "", description: "No activity in this period.", charge: "", credit: "", balance: "" });

  y = table(doc, y, [
    { key: "date", label: "Date", width: 62 },
    { key: "description", label: "Description", width: 230 },
    { key: "charge", label: "Charges", width: 80, align: "right" },
    { key: "credit", label: "Payments", width: 80, align: "right" },
    { key: "balance", label: "Balance", width: 85, align: "right" },
  ], rows);

  if (y > PAGE.height - 170) { doc.addPage(); y = 60; }
  y = totalsBlock(doc, y + 10, [
    { label: "Total charges", value: money(totalCharged) },
    { label: "Total payments", value: money(totalPaid), color: GREEN },
    { label: closing > 0 ? "BALANCE DUE" : "BALANCE", value: money(closing), big: true, rule: true, color: closing > 0 ? RED : GREEN },
  ]);
  if (closing > 0) y = notesBlock(doc, y + 10, "PAYMENT", `Please settle the balance of ${money(closing)} at your earliest convenience.`);
  footers(doc, settings, "This statement lists all charges and payments on your account.");
  return doc.output();
}
