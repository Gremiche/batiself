import { NavLink, Outlet } from "react-router-dom";

const links = [
  { to: "/", label: "Chantiers", icon: "🏗️" },
  { to: "/referentiel", label: "Référentiel", icon: "📦" },
  { to: "/regles", label: "Règles", icon: "⚠️" },
];

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 bg-bleu flex flex-col flex-shrink-0">
        <div className="px-4 py-5 border-b border-white/10 flex items-center justify-center">
          <img
            src="/logo-batiself-white.svg"
            alt="BatiSelf"
            className="w-44 object-contain"
          />
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {links.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-orange text-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              <span>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-white/10">
          <p className="text-white/30 text-xs">v1.0.0</p>
        </div>
      </aside>

      {/* Contenu principal */}
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <Outlet />
      </main>
    </div>
  );
}
