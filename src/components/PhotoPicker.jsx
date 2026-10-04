import React, { useState } from "react";
import { X, ImagePlus } from "lucide-react";
import { C } from "../tokens";
import { prepareImages } from "../utils/images";

// Photo section for the product and project forms:
//  - shows the current photos with a "remove" button on each
//  - lets you add more (shrunk automatically), and enforces the maximum
//  - the form reads `keptUrls`, `removedUrls` and `newFiles` from the callbacks
export default function PhotoPicker({ existing = [], max, onChange }) {
  const [removed, setRemoved] = useState([]);
  const [added, setAdded] = useState([]); // [{ file, preview }]
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const kept = existing.filter((u) => !removed.includes(u));
  const total = kept.length + added.length;

  function emit(nextRemoved, nextAdded) {
    onChange({ removedUrls: nextRemoved, newFiles: nextAdded.map((a) => a.file) });
  }

  async function handlePick(e) {
    const picked = e.target.files;
    e.target.value = ""; // allows picking the same photo again later
    if (!picked || picked.length === 0) return;
    setError("");
    setBusy(true);
    try {
      const files = await prepareImages(picked, { maxCount: max, alreadyHave: total });
      const next = [...added, ...files.map((file) => ({ file, preview: URL.createObjectURL(file) }))];
      setAdded(next);
      emit(removed, next);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function removeExisting(url) {
    const next = [...removed, url];
    setRemoved(next);
    emit(next, added);
  }
  function removeAdded(i) {
    const next = added.filter((_, idx) => idx !== i);
    URL.revokeObjectURL(added[i].preview);
    setAdded(next);
    emit(removed, next);
  }

  const thumb = { width: 72, height: 72, objectFit: "cover", border: "1px solid #C9C5BA" };
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {kept.map((url) => (
          <div key={url} className="relative">
            <img src={url} alt="" style={thumb} />
            <button type="button" onClick={() => removeExisting(url)} aria-label="Remove this photo" title="Remove this photo"
              className="absolute -top-2 -right-2 rounded-full flex items-center justify-center" style={{ width: 20, height: 20, background: C.red, color: "white" }}>
              <X size={12} />
            </button>
          </div>
        ))}
        {added.map((a, i) => (
          <div key={a.preview} className="relative">
            <img src={a.preview} alt="" style={{ ...thumb, outline: `2px solid ${C.safety}` }} />
            <button type="button" onClick={() => removeAdded(i)} aria-label="Don't add this photo" title="Don't add this photo"
              className="absolute -top-2 -right-2 rounded-full flex items-center justify-center" style={{ width: 20, height: 20, background: C.red, color: "white" }}>
              <X size={12} />
            </button>
          </div>
        ))}
        {total === 0 && <p className="text-xs" style={{ color: "#8A877D" }}>No photos yet.</p>}
      </div>

      {total < max ? (
        <label className="inline-flex items-center gap-2 text-sm px-3 py-2 cursor-pointer" style={{ border: `1px dashed ${C.ink}55`, color: C.ink }}>
          <ImagePlus size={15} /> {busy ? "Preparing photos…" : "Add photos"}
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handlePick} disabled={busy} style={{ display: "none" }} />
        </label>
      ) : (
        <p className="text-xs" style={{ color: "#8A877D" }}>Maximum of {max} photos reached — remove one to add another.</p>
      )}
      <p className="text-xs mt-1" style={{ color: "#8A877D" }}>{total} of {max} photos. Big phone photos are shrunk automatically before uploading.</p>
      {error && <p className="text-sm mt-1" style={{ color: C.red }}>{error}</p>}
    </div>
  );
}
