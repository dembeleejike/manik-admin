import { buildWorkbook, buildCsv } from "./xlsx";

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// The browser's own timezone offset, so a sale made late in the evening lands
// on the right calendar day in the spreadsheet.
const tzOffsetMs = () => -new Date().getTimezoneOffset() * 60000;

export function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}

// Builds a File (CSV or Excel) from the rows currently on screen.
export function makeTableFile({ format, filename, sheetName, columns, rows }) {
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "csv") {
    const csv = buildCsv(columns, rows, { tzOffsetMs: tzOffsetMs() });
    return new File([csv], `${filename}-${stamp}.csv`, { type: "text/csv;charset=utf-8" });
  }
  const bytes = buildWorkbook([{ name: sheetName || filename, columns, rows }], { tzOffsetMs: tzOffsetMs() });
  return new File([bytes], `${filename}-${stamp}.xlsx`, { type: XLSX_MIME });
}

export function downloadFile(file) {
  downloadBlob(file, file.name);
}

// Can this device/browser share this kind of file? Browsers only allow sharing
// certain file types: Chrome (Android and desktop) accepts pictures, PDF, CSV and
// text but NOT Excel (.xlsx); Safari on iPhone accepts Excel too. Asking the
// browser first means we only show a Share button that will really open the
// share sheet — never one that silently just downloads.
export function canShareFile(file) {
  try {
    return typeof navigator !== "undefined" && typeof navigator.share === "function" && typeof navigator.canShare === "function" && !!navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export function shareSupport() {
  return {
    xlsx: canShareFile(new File(["x"], "test.xlsx", { type: XLSX_MIME })),
    csv: canShareFile(new File(["x"], "test.csv", { type: "text/csv" })),
    pdf: canShareFile(new File(["x"], "test.pdf", { type: "application/pdf" })),
  };
}

// Opens the phone's share sheet (WhatsApp, email, Drive...) with the file.
// Returns false when sharing didn't open, so the caller can fall back to a download.
export async function shareFile(file, title) {
  if (canShareFile(file)) {
    try {
      await navigator.share({ files: [file], title });
      return true;
    } catch (err) {
      if (err && err.name === "AbortError") return true; // they closed the share sheet — not an error
      return false;
    }
  }
  return false;
}

// "08060984868" / "+234 806 098 4868" -> "2348060984868" (what wa.me needs)
export function toWhatsAppNumber(phone) {
  let d = String(phone || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = "234" + d.slice(1);
  else if (d.length === 10) d = "234" + d;
  return d;
}

export function whatsAppLink(phone, text) {
  const n = toWhatsAppNumber(phone);
  const base = n ? `https://wa.me/${n}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
}

export const naira = (n) => "₦" + Number(n || 0).toLocaleString("en-NG");

// Wraps PDF bytes as a File so it can be downloaded or shared like any other file.
export function makePdfFile(bytes, filename) {
  return new File([bytes], filename.endsWith(".pdf") ? filename : `${filename}.pdf`, { type: "application/pdf" });
}
