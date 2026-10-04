// Phone photos are often 5–12 MB, which is far more than a website needs and
// more than the server accepts (5 MB each). Before uploading, each photo is
// shrunk in the browser to at most 1600 px on its longest side and re-saved as a
// JPEG. That keeps uploads fast on mobile data, saves storage, and means a
// normal phone photo never gets rejected for being "too large".

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // the server's limit per photo
const MAX_SIDE = 1600;

function loadBitmap(file) {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file, { imageOrientation: "from-image" }); // respects the phone's rotation
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("unreadable")); };
    img.src = url;
  });
}

// Returns a File ready to upload. If the photo is already small, or can't be
// processed, the original is returned (the server still validates it).
export async function prepareImage(file) {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name} isn't a picture.`);
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error(`${file.name}: only JPG, PNG or WEBP pictures are allowed.`);

  const small = file.size <= 900 * 1024;
  let bitmap;
  try {
    bitmap = await loadBitmap(file);
  } catch {
    if (file.size > MAX_UPLOAD_BYTES) throw new Error(`${file.name} is too large (max 5 MB) and couldn't be shrunk.`);
    return file;
  }
  const w = bitmap.width, h = bitmap.height;
  if (small && Math.max(w, h) <= MAX_SIDE) return file;

  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff"; // PNGs with transparency become white instead of black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  if (bitmap.close) bitmap.close();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  if (!blob) return file;
  if (blob.size >= file.size && file.size <= MAX_UPLOAD_BYTES) return file; // already smaller than our version
  if (blob.size > MAX_UPLOAD_BYTES) throw new Error(`${file.name} is still too large after shrinking.`);
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}

// Prepares a whole selection, stopping with a clear message on the first problem.
export async function prepareImages(fileList, { maxCount, alreadyHave = 0 } = {}) {
  const files = Array.from(fileList);
  if (maxCount && alreadyHave + files.length > maxCount) {
    throw new Error(`You can have at most ${maxCount} photos here (${alreadyHave} already added, ${files.length} chosen).`);
  }
  const out = [];
  for (const f of files) out.push(await prepareImage(f));
  return out;
}
