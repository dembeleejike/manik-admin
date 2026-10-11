// Three ranks. "owner" is the stored name of the middle rank and is shown as "Admin".
export const roleLabel = (role) => (role === "superadmin" ? "Super admin" : role === "owner" ? "Admin" : role === "staff" ? "Staff" : role || "");
export const isOwnerLevel = (role) => role === "owner" || role === "superadmin";
export const decorateAdmin = (a) => (a ? { ...a, isOwner: isOwnerLevel(a.role), isSuper: a.role === "superadmin" } : a);
