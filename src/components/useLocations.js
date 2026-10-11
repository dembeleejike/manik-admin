import { useEffect, useState } from "react";
import { api } from "../api";

// Loads the stock locations (Shop, Warehouse…) once and shares them between screens.
let cache = null;
let inflight = null;

export function refreshLocations() {
  inflight = api.listLocations().then((l) => { cache = l; return l; }).finally(() => { inflight = null; });
  return inflight;
}

export default function useLocations() {
  const [locations, setLocations] = useState(cache || []);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    let live = true;
    (cache ? Promise.resolve(cache) : inflight || refreshLocations())
      .then((l) => { if (live) { setLocations(l); setLoading(false); } })
      .catch(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  return { locations, activeLocations: locations.filter((l) => l.active), loading, reload: async () => { const l = await refreshLocations(); setLocations(l); return l; } };
}
