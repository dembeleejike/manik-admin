import React, { useMemo, useState } from "react";
import { Download, Share2, MessageCircle } from "lucide-react";
import { C } from "../tokens";
import { downloadFile, shareFile, makePdfFile, whatsAppLink, shareSupport } from "../utils/files";

// Buttons for any PDF document: download, share (phones), and a WhatsApp message.
//   build():   returns the PDF bytes (called only when a button is pressed)
//   filename:  e.g. "Quotation-Q-2026-0007"
//   whatsapp:  { phone, text } — optional; opens WhatsApp with the text ready to send
export default function PdfActions({ build, filename, title, whatsapp, size = "normal" }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const canShare = useMemo(() => shareSupport().pdf, []);

  const btn = {
    border: `1px solid ${C.ink}33`, background: "transparent", color: C.ink,
    fontSize: size === "small" ? 12 : 13, padding: size === "small" ? "5px 9px" : "8px 12px",
    display: "inline-flex", alignItems: "center", gap: 5,
  };

  function make() {
    return makePdfFile(build(), filename);
  }

  async function handleShare() {
    setBusy(true);
    setNote("");
    try {
      const file = make();
      if (!(await shareFile(file, title || filename))) {
        downloadFile(file);
        setNote("Sharing isn't available on this device, so the PDF was downloaded.");
      }
    } catch (err) {
      setNote(err.message || "Couldn't create the PDF.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button type="button" style={btn} disabled={busy} onClick={() => { try { downloadFile(make()); } catch (e) { setNote(e.message); } }}>
          <Download size={13} /> PDF
        </button>
        {canShare && (
          <button type="button" style={btn} disabled={busy} onClick={handleShare}><Share2 size={13} /> Share PDF</button>
        )}
        {whatsapp && (
          <a href={whatsAppLink(whatsapp.phone, whatsapp.text)} target="_blank" rel="noreferrer" style={{ ...btn, color: "#1E8E4F", textDecoration: "none" }}>
            <MessageCircle size={13} /> WhatsApp
          </a>
        )}
      </div>
      {note && <p className="text-xs mt-1" style={{ color: "#6B6960" }}>{note}</p>}
    </div>
  );
}
