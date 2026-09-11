import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { LayoutGrid, Package, MessageSquare, Image, Users, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "../AuthContext";
import { C } from "../tokens";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutGrid, end: true },
  { to: "/products", label: "Products", icon: Package },
  { to: "/quotes", label: "Quote requests", icon: MessageSquare },
  { to: "/projects", label: "Projects", icon: Image },
  { to: "/admins", label: "Admins", icon: Users },
];

export default function Layout({ children }) {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const navItems = (
    <nav className="flex-1 py-4">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={() => setMobileOpen(false)}
          className={({ isActive }) =>
            "flex items-center gap-3 px-5 py-3 text-sm transition-colors " +
            (isActive ? "font-medium" : "")
          }
          style={({ isActive }) => ({
            color: isActive ? C.safety : "#B8BCC0",
            borderLeft: isActive ? `2px solid ${C.safety}` : "2px solid transparent",
          })}
        >
          <Icon size={16} /> {label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen flex" style={{ background: C.concrete }}>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 shrink-0" style={{ background: C.steel }}>
        <div className="flex items-center gap-2 px-5 py-5" style={{ borderBottom: `1px solid ${C.steelLine}` }}>
          <span style={{ width: 10, height: 10, background: C.safety }} />
          <span className="font-bold" style={{ color: C.cream }}>MANIK</span>
        </div>
        {navItems}
        <div className="px-5 py-4" style={{ borderTop: `1px solid ${C.steelLine}` }}>
          <p className="text-xs mb-2 truncate" style={{ color: "#8A8F94" }}>{admin?.email}</p>
          <button onClick={handleLogout} className="flex items-center gap-2 text-xs" style={{ color: "#B8BCC0" }}>
            <LogOut size={13} /> Log out
          </button>
        </div>
      </aside>

      {/* Mobile top bar + slide-out menu */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-14" style={{ background: C.steel }}>
        <div className="flex items-center gap-2">
          <span style={{ width: 8, height: 8, background: C.safety }} />
          <span className="font-bold text-sm" style={{ color: C.cream }}>MANIK</span>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} style={{ color: C.cream }} aria-label="Menu">
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-30 pt-14" style={{ background: C.steel }}>
          {navItems}
          <div className="px-5 py-4" style={{ borderTop: `1px solid ${C.steelLine}` }}>
            <p className="text-xs mb-2 truncate" style={{ color: "#8A8F94" }}>{admin?.email}</p>
            <button onClick={handleLogout} className="flex items-center gap-2 text-xs" style={{ color: "#B8BCC0" }}>
              <LogOut size={13} /> Log out
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 min-w-0 pt-14 md:pt-0">
        <div className="p-5 md:p-8 max-w-5xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
