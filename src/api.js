// Every request to the backend goes through here, so there's exactly one
// place that knows the API URL and how to attach the auth token.

// Strip any trailing slash so it doesn't matter whether VITE_API_URL was
// set with or without one — prevents "//api/..." 404s.
const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "");

function getToken() {
  return localStorage.getItem("manik_admin_token");
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };

  // Don't set Content-Type for FormData — the browser sets the correct
  // multipart boundary itself. Only set it for plain JSON bodies.
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  // Session expired or invalid — clear it and send back to login instead
  // of showing a confusing generic error on whatever page they were on.
  if (res.status === 401 && token) {
    localStorage.removeItem("manik_admin_token");
    localStorage.removeItem("manik_admin_info");
    window.location.href = "/login";
    return new Promise(() => {}); // stop here — the redirect is already happening
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  // auth
  login: (identifier, password) =>
    request("/api/auth/login", { method: "POST", body: JSON.stringify({ identifier, password }) }),
  listAdmins: () => request("/api/auth/admins"),
  createAdmin: (payload) =>
    request("/api/auth/admins", { method: "POST", body: JSON.stringify(payload) }),
  deleteAdmin: (id) => request(`/api/auth/admins/${id}`, { method: "DELETE" }),

  // sales
  listSales: () => request("/api/sales"),
  createSale: (payload) => request("/api/sales", { method: "POST", body: JSON.stringify(payload) }),
  deleteSale: (id) => request(`/api/sales/${id}`, { method: "DELETE" }),

  // purchases
  listPurchases: () => request("/api/purchases"),
  createPurchase: (payload) => request("/api/purchases", { method: "POST", body: JSON.stringify(payload) }),
  deletePurchase: (id) => request(`/api/purchases/${id}`, { method: "DELETE" }),

  // expenses
  listExpenses: () => request("/api/expenses"),
  createExpense: (payload) => request("/api/expenses", { method: "POST", body: JSON.stringify(payload) }),
  deleteExpense: (id) => request(`/api/expenses/${id}`, { method: "DELETE" }),

  // customers
  listCustomers: () => request("/api/customers"),
  getCustomer: (id) => request(`/api/customers/${id}`),
  updateCustomer: (id, payload) => request(`/api/customers/${id}`, { method: "PUT", body: JSON.stringify(payload) }),

  // reports
  getReportSummary: (period) => request(`/api/reports/summary?period=${period}`),
  getYearlyReport: (year) => request(`/api/reports/yearly?year=${year}`),

  // export — these are files, not JSON, and need the auth token attached,
  // so a plain link won't work. This fetches with the token, then triggers
  // a normal browser download of the result.
  downloadFile: async (path, filename) => {
    const token = getToken();
    const res = await fetch(`${API_URL}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Download failed");
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },

  // products
  listProducts: () => request("/api/products"),
  createProduct: (formData) => request("/api/products", { method: "POST", body: formData }),
  updateProduct: (id, formData) => request(`/api/products/${id}`, { method: "PUT", body: formData }),
  deleteProduct: (id) => request(`/api/products/${id}`, { method: "DELETE" }),

  // categories
  listCategories: () => request("/api/categories"),
  createCategory: (name) =>
    request("/api/categories", { method: "POST", body: JSON.stringify({ name }) }),
  deleteCategory: (id) => request(`/api/categories/${id}`, { method: "DELETE" }),

  // settings
  getSettings: () => request("/api/settings"),
  updateSettings: (payload) =>
    request("/api/settings", { method: "PUT", body: JSON.stringify(payload) }),
  uploadHeroImage: (file) => {
    const formData = new FormData();
    formData.append("image", file);
    return request("/api/settings/hero-image", { method: "POST", body: formData });
  },

  // quotes
  listQuotes: () => request("/api/quotes"),
  updateQuoteStatus: (id, status) =>
    request(`/api/quotes/${id}`, { method: "PUT", body: JSON.stringify({ status }) }),
  deleteQuote: (id) => request(`/api/quotes/${id}`, { method: "DELETE" }),

  // projects
  listProjects: () => request("/api/projects"),
  createProject: (formData) => request("/api/projects", { method: "POST", body: formData }),
  updateProject: (id, formData) => request(`/api/projects/${id}`, { method: "PUT", body: formData }),
  deleteProject: (id) => request(`/api/projects/${id}`, { method: "DELETE" }),
};

export { getToken };
