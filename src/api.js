// Every request to the backend goes through here, so there's exactly one
// place that knows the API address and how requests are sent securely.

// Where the API lives. Normally EMPTY, meaning "the same website address": the
// hosting config forwards /api/* to the backend (see vercel.json), so the browser
// treats the API as part of this site and the secure session cookie works on
// every device, including iPhones. Set VITE_API_URL only if the API is on a
// sibling subdomain of the same site (e.g. admin.shop.com + api.shop.com).
const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

// The sign-in token is kept in an httpOnly cookie that scripts can't read, so
// there is nothing to store here. Every request just asks the browser to
// include the cookie, and adds a header that forged cross-site requests can't.
const COMMON = { "X-Manik-CSRF": "1" };

function redirectToLogin() {
  if (window.location.pathname !== "/login") window.location.href = "/login";
  return new Promise(() => {}); // stop here — the redirect is already happening
}

async function request(path, options = {}) {
  const headers = { ...COMMON, ...(options.headers || {}) };

  // Don't set Content-Type for FormData — the browser sets the correct
  // multipart boundary itself. Only set it for plain JSON bodies.
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers, credentials: "include" });

  // Session expired — send back to login instead of showing a confusing generic
  // error on whatever page they were on. (Not for login/me themselves.)
  if (res.status === 401 && !path.startsWith("/api/auth/login") && !path.startsWith("/api/auth/me")) {
    return redirectToLogin();
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
  me: () => request("/api/auth/me"),
  logout: () => request("/api/auth/logout", { method: "POST", body: "{}" }),
  listAdmins: () => request("/api/auth/admins"),
  createAdmin: (payload) =>
    request("/api/auth/admins", { method: "POST", body: JSON.stringify(payload) }),
  deleteAdmin: (id) => request(`/api/auth/admins/${id}`, { method: "DELETE" }),
  changePassword: (currentPassword, newPassword) =>
    request("/api/auth/password", { method: "PUT", body: JSON.stringify({ currentPassword, newPassword }) }),

  // sales
  listSales: () => request("/api/sales"),
  createSale: (payload) => request("/api/sales", { method: "POST", body: JSON.stringify(payload) }),
  deleteSale: (id) => request(`/api/sales/${id}`, { method: "DELETE" }),
  addPayment: (saleId, payload) => request(`/api/sales/${saleId}/payments`, { method: "POST", body: JSON.stringify(payload) }),
  deletePayment: (saleId, paymentId) => request(`/api/sales/${saleId}/payments/${paymentId}`, { method: "DELETE" }),

  // quotations
  listQuotations: () => request("/api/quotations"),
  createQuotation: (payload) => request("/api/quotations", { method: "POST", body: JSON.stringify(payload) }),
  updateQuotation: (id, payload) => request(`/api/quotations/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  setQuotationStatus: (id, status) => request(`/api/quotations/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }),
  deleteQuotation: (id) => request(`/api/quotations/${id}`, { method: "DELETE" }),
  convertQuotation: (id, payload) => request(`/api/quotations/${id}/convert`, { method: "POST", body: JSON.stringify(payload) }),

  // stock counts
  listStockAdjustments: () => request("/api/stocktake?limit=1000"),
  saveStocktake: (payload) => request("/api/stocktake", { method: "POST", body: JSON.stringify(payload) }),

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
  getReportSummary: (period, from, to) =>
    request(`/api/reports/summary?period=${period}${period === "custom" ? `&from=${from}&to=${to}` : ""}`),
  getYearlyReport: (year) => request(`/api/reports/yearly?year=${year}`),

  // export — these are files, not JSON, so a plain link would not carry the
  // secure session. This fetches with it, then triggers
  // a normal browser download of the result.
  downloadFile: async (path, filename) => {
    const res = await fetch(`${API_URL}${path}`, { headers: COMMON, credentials: "include" });
    if (res.status === 401) return redirectToLogin();
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

  // backup & restore & activity log (owner only)
  emailBackup: (email, password) => request("/api/export/email-backup", { method: "POST", body: JSON.stringify({ email, password }) }),
  restoreBackup: (backup, dryRun) =>
    request("/api/restore", { method: "POST", body: JSON.stringify({ backup, dryRun: !!dryRun }) }),
  listAudit: (limit = 500) => request(`/api/audit?limit=${limit}`),

  // Same as downloadFile but hands back the file instead of saving it, so it can be shared.
  fetchBlob: async (path) => {
    const res = await fetch(`${API_URL}${path}`, { headers: COMMON, credentials: "include" });
    if (res.status === 401) return redirectToLogin();
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Download failed");
    }
    return res.blob();
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

