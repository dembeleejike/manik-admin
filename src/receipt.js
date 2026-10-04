// Builds a clean, printable receipt for one sale and opens the browser's
// print dialog for it. No PDF library needed — this is exactly what
// window.print() is for, and it lets the customer's browser/printer
// handle paper size correctly.
// Everything printed on a receipt comes from user-entered text (customer names
// can originate from the public quote form), so it must be escaped before it
// goes into HTML. Otherwise a customer could plant a script that runs inside
// the admin's browser when the receipt window opens.
const esc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export function printReceipt(sale, settings) {
  const businessName = settings?.businessName || "MANIK";
  const tagline = settings?.tagline || "";
  const phone = settings?.phone || "";
  const phone2 = settings?.phone2 || "";
  const locations = settings?.locations?.length ? settings.locations : [];

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Receipt — ${esc(sale.productName)}</title>
<style>
  body { font-family: Arial, sans-serif; padding: 24px; color: #171A1C; max-width: 420px; margin: 0 auto; }
  h1 { font-size: 18px; margin: 0 0 2px; }
  .tagline { font-size: 12px; color: #555; margin-bottom: 10px; }
  .contact { font-size: 11px; color: #555; margin-bottom: 2px; }
  hr { border: none; border-top: 1px solid #ccc; margin: 14px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  td { padding: 4px 0; }
  .label { color: #555; }
  .right { text-align: right; }
  .total-row td { border-top: 1px solid #ccc; padding-top: 8px; font-weight: bold; }
  .footer { margin-top: 20px; font-size: 11px; color: #888; text-align: center; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <h1>${esc(businessName)}</h1>
  ${tagline ? `<div class="tagline">${esc(tagline)}</div>` : ""}
  ${locations.map(loc => `<div class="contact">${loc.label ? esc(loc.label) + ": " : ""}${esc(loc.address)}</div>`).join("")}
  ${phone ? `<div class="contact">Tel: ${esc(phone)}${phone2 ? " / " + esc(phone2) : ""}</div>` : ""}
  <hr />
  <table>
    <tr><td class="label">Date</td><td class="right">${new Date(sale.date).toLocaleDateString()}</td></tr>
    <tr><td class="label">Receipt No.</td><td class="right">${sale._id.slice(-8).toUpperCase()}</td></tr>
    ${sale.customerName ? `<tr><td class="label">Customer</td><td class="right">${esc(sale.customerName)}</td></tr>` : ""}
    ${sale.customerPhone ? `<tr><td class="label">Phone</td><td class="right">${esc(sale.customerPhone)}</td></tr>` : ""}
  </table>
  <hr />
  <table>
    <tr><td class="label">Item</td><td class="right">${esc(sale.productName)}</td></tr>
    <tr><td class="label">Quantity</td><td class="right">${esc(sale.quantity)}</td></tr>
    <tr><td class="label">Unit Price</td><td class="right">₦${Number(sale.unitPrice).toLocaleString()}</td></tr>
    <tr class="total-row"><td>Total</td><td class="right">₦${Number(sale.totalAmount).toLocaleString()}</td></tr>
    <tr><td class="label">Payment</td><td class="right">${esc(sale.paymentStatus)} (${esc(sale.paymentMethod)})</td></tr>
  </table>
  <div class="footer">Thank you for your patronage.</div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=480,height=700");
  if (!win) {
    alert("Please allow pop-ups to print a receipt.");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}
