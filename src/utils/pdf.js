// A small, dependency-free PDF writer (A4, the two standard Helvetica fonts).
// It draws text, lines and rectangles, wraps text to a width, and builds
// multi-page documents. It exists so quotations, invoices and statements can be
// created, downloaded and shared straight from the dashboard, even offline.
//
// Coordinates: points (1/72 inch), origin at the TOP-left, y grows downward.
import { HELVETICA, HELVETICA_BOLD } from "./pdfFonts";

export const PAGE = { width: 595.28, height: 841.89 };

// Windows-1252 bytes for characters outside Latin-1
const CP1252 = {
  "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85, "†": 0x86, "‡": 0x87, "ˆ": 0x88, "‰": 0x89, "Š": 0x8a,
  "‹": 0x8b, "Œ": 0x8c, "Ž": 0x8e, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97,
  "˜": 0x98, "™": 0x99, "š": 0x9a, "›": 0x9b, "œ": 0x9c, "ž": 0x9e, "Ÿ": 0x9f,
};

// Turns any text into bytes the standard fonts can show. Letters with marks the
// font doesn't have (Yoruba ọ ẹ ṣ, Igbo ị ụ…) fall back to the plain letter;
// anything else unprintable becomes "?".
export function toWinAnsi(input) {
  let out = "";
  for (const ch of String(input ?? "").normalize("NFC")) {
    const code = ch.codePointAt(0);
    if (code === 9 || code === 10 || code === 13) { out += " "; continue; }
    if (code >= 0x300 && code <= 0x36f) continue; // stray accent marks the font can't draw
    if (ch === "\u20A6") { out += "N"; continue; } // naira: N here, with its two bars added in text()
    if (code >= 32 && code <= 126) { out += ch; continue; }
    if (code >= 160 && code <= 255) { out += ch; continue; }
    if (CP1252[ch] !== undefined) { out += String.fromCharCode(CP1252[ch]); continue; }
    const base = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (base !== ch && base.length === 1 && base.charCodeAt(0) < 256 && base.charCodeAt(0) >= 32) { out += base; continue; }
    out += "?";
  }
  return out;
}

const hexToRgb = (hex) => {
  const h = String(hex || "#000000").replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map((v) => +v.toFixed(3));
};

const num = (n) => (Math.round(n * 100) / 100).toString();
const escapePdf = (s) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

export class Pdf {
  constructor({ title = "Document" } = {}) {
    this.title = title;
    this.pages = [];
    this.ops = null;
    this.addPage();
  }

  addPage() {
    this.ops = [];
    this.pages.push(this.ops);
    return this.pages.length;
  }

  get pageCount() { return this.pages.length; }
  goToPage(n) { this.ops = this.pages[n - 1]; }

  textWidth(str, size, bold = false) {
    const table = bold ? HELVETICA_BOLD : HELVETICA;
    let w = 0;
    for (const ch of toWinAnsi(str)) {
      const code = ch.charCodeAt(0);
      w += table[code - 32] ?? 556;
    }
    return (w * size) / 1000;
  }

  // Splits text into lines no wider than maxWidth (breaking on spaces; very long
  // words are cut). Respects explicit newlines.
  wrap(str, maxWidth, size, bold = false) {
    const lines = [];
    for (const para of String(str ?? "").split(/\r?\n/)) {
      let line = "";
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const test = line ? line + " " + word : word;
        if (this.textWidth(test, size, bold) <= maxWidth) { line = test; continue; }
        if (line) lines.push(line);
        let rest = word;
        while (this.textWidth(rest, size, bold) > maxWidth && rest.length > 1) {
          let cut = rest.length - 1;
          while (cut > 1 && this.textWidth(rest.slice(0, cut), size, bold) > maxWidth) cut--;
          lines.push(rest.slice(0, cut));
          rest = rest.slice(cut);
        }
        line = rest;
      }
      lines.push(line);
    }
    return lines;
  }

  // Draws one line of text. `y` is the baseline measured from the top.
  // The naira sign (₦) isn't in the standard fonts, so it is drawn as an "N"
  // with two short bars across it.
  text(str, x, y, { size = 10, bold = false, color = "#1f1f1f", align = "left" } = {}) {
    const s = toWinAnsi(str);
    if (!s) return;
    const w = this.textWidth(str, size, bold);
    const px = align === "right" ? x - w : align === "center" ? x - w / 2 : x;
    const [r, g, b] = hexToRgb(color);
    this.ops.push(`BT /${bold ? "F2" : "F1"} ${num(size)} Tf ${r} ${g} ${b} rg ${num(px)} ${num(PAGE.height - y)} Td (${escapePdf(s)}) Tj ET`);

    if (String(str).includes("\u20A6")) {
      let prefix = "";
      const nWidth = ((bold ? HELVETICA_BOLD : HELVETICA)["N".charCodeAt(0) - 32] * size) / 1000;
      for (const ch of String(str).normalize("NFC")) {
        if (ch === "\u20A6") {
          const bx = px + this.textWidth(prefix, size, bold);
          for (const f of [0.3, 0.46]) {
            this.line(bx - size * 0.05, y - size * f, bx + nWidth + size * 0.05, y - size * f, { color, width: Math.max(0.5, size * (bold ? 0.075 : 0.06)) });
          }
        }
        prefix += toWinAnsi(ch);
      }
    }
  }

  // Draws wrapped text; returns the y just below the last line.
  paragraph(str, x, y, width, { size = 10, bold = false, color, leading } = {}) {
    const lh = leading || size * 1.35;
    for (const line of this.wrap(str, width, size, bold)) {
      this.text(line, x, y + size, { size, bold, color });
      y += lh;
    }
    return y;
  }

  rect(x, y, w, h, { fill, stroke, lineWidth = 0.7 } = {}) {
    const parts = [];
    if (fill) parts.push(`${hexToRgb(fill).join(" ")} rg`);
    if (stroke) parts.push(`${hexToRgb(stroke).join(" ")} RG ${num(lineWidth)} w`);
    parts.push(`${num(x)} ${num(PAGE.height - y - h)} ${num(w)} ${num(h)} re`);
    parts.push(fill && stroke ? "B" : fill ? "f" : "S");
    this.ops.push(parts.join(" "));
  }

  line(x1, y1, x2, y2, { color = "#999999", width = 0.7 } = {}) {
    this.ops.push(`${hexToRgb(color).join(" ")} RG ${num(width)} w ${num(x1)} ${num(PAGE.height - y1)} m ${num(x2)} ${num(PAGE.height - y2)} l S`);
  }

  // Assembles the file. Everything is written as single-byte characters so the
  // byte offsets in the cross-reference table are exact.
  output() {
    const objects = []; // index = object number - 1
    const add = (body) => { objects.push(body); return objects.length; };

    const catalog = add("");               // 1
    const pagesObj = add("");              // 2
    const f1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    const f2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    const info = add(`<< /Title (${escapePdf(toWinAnsi(this.title))}) /Producer (MANIK) >>`);

    const pageIds = [];
    for (const ops of this.pages) {
      const stream = ops.join("\n");
      const content = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
      const page = add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${content} 0 R >>`);
      pageIds.push(page);
    }
    objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
    objects[pagesObj - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

    let out = "%PDF-1.4\n";
    const offsets = [];
    objects.forEach((body, i) => {
      offsets.push(out.length);
      out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xref = out.length;
    out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const off of offsets) out += String(off).padStart(10, "0") + " 00000 n \n";
    out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF`;

    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
    return bytes;
  }
}
