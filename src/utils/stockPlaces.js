// Helpers for showing where stock is. A product has one stock line per location
// ({ location, quantity }); `quantity` is the total across all of them.

// Quantity of `product` at a location.
export function qtyAt(product, locationId) {
  const line = (product.stock || []).find((s) => String(s.location) === String(locationId));
  return line ? line.quantity : 0;
}

// Quantity that exists but hasn't been given a location yet (products from before
// locations existed, until the one-time upgrade or the first stock movement).
export function unassigned(product) {
  const placed = (product.stock || []).reduce((n, s) => n + s.quantity, 0);
  return Math.max(0, (product.quantity || 0) - placed);
}

// [{ location, quantity }] for every location holding some, in the order of `locations`.
export function placesOf(product, locations) {
  const out = [];
  for (const loc of locations) {
    const q = qtyAt(product, loc._id);
    if (q > 0) out.push({ location: loc, quantity: q });
  }
  return out;
}

// "Shop: 5 · Warehouse: 120" (or "Not placed yet: 40")
export function whereText(product, locations) {
  const parts = placesOf(product, locations).map((p) => `${p.location.name}: ${p.quantity}`);
  const loose = unassigned(product);
  if (loose > 0) parts.push(`Not placed yet: ${loose}`);
  return parts.join(" · ") || "None in stock";
}

export function defaultLocationId(locations, purpose) {
  const flag = purpose === "receiving" ? "isDefaultReceiving" : "isDefaultSelling";
  const active = locations.filter((l) => l.active);
  return (active.find((l) => l[flag]) || active[0] || {})._id || "";
}
