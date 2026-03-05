import { NavLink, Outlet } from "react-router-dom";
import { useOllamaStatus } from "../hooks/useOllamaStatus";

const navItems = [
  { path: "/", label: "Dashboard", icon: "◉" },
  { path: "/reports", label: "Reports", icon: "▤" },
  { path: "/review", label: "Review", icon: "⚑" },
  { path: "/settings", label: "Settings", icon: "⚙" },
];

export default function Layout() {
  const ollamaStatus = useOllamaStatus();

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-[#0a0a14]">
      <nav className="w-56 bg-white dark:bg-[#0e0e1a] border-r border-gray-200 dark:border-[#1e1e32] flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-[#1e1e32]">
          <h1 className="text-lg font-bold text-gray-900 dark:bg-gradient-to-r dark:from-indigo-400 dark:to-purple-400 dark:bg-clip-text dark:text-transparent">
            Chronos AI
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Time Tracker
          </p>
        </div>

        <div className="flex-1 py-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-medium border-r-2 border-indigo-600"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#22223a]/50"
                }`
              }
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="p-3 border-t border-gray-200 dark:border-[#1e1e32]">
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                ollamaStatus.connected ? "bg-green-500" : "bg-red-500"
              }`}
            />
            <span className="text-gray-500 dark:text-gray-400">
              Ollama {ollamaStatus.connected ? "Connected" : "Disconnected"}
            </span>
          </div>
          {ollamaStatus.connected && ollamaStatus.available_models.length > 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 truncate">
              {ollamaStatus.available_models.join(", ")}
            </p>
          )}
        </div>
      </nav>

      <main className="flex-1 overflow-auto dark:dot-grid-bg">
        <Outlet />
      </main>
    </div>
  );
}
