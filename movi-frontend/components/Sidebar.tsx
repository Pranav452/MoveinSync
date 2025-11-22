"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Map, Settings, LogOut, Mic } from "lucide-react";

const navItems = [
  { name: "Bus Dashboard", href: "/busDashboard", icon: LayoutDashboard },
  { name: "Manage Routes", href: "/manageRoute", icon: Map },
  { name: "Voice Chat", href: "/voiceChat", icon: Mic },
  { name: "Settings", href: "#", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col fixed left-0 top-0 z-50 shadow-sm">
      {/* Logo Area */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-sm">
            M
          </div>
          <div>
            <span className="font-bold text-xl tracking-tight text-gray-900">MoveInSync</span>
            <div className="text-[10px] text-brand-600 font-bold uppercase tracking-wider">Shuttle Admin</div>
          </div>
        </div>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all ${
                isActive
                  ? "bg-brand-50 text-brand-700 border border-brand-100"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? "text-brand-600" : "text-gray-400 group-hover:text-gray-600"}`} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-white hover:shadow-sm cursor-pointer transition-all border border-transparent hover:border-gray-200">
          <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm">
            MD
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">Manager Dave</p>
            <p className="text-xs text-gray-500 truncate">admin@moveinsync.com</p>
          </div>
          <LogOut className="w-4 h-4 text-gray-400 hover:text-red-500 transition-colors" />
        </div>
      </div>
    </div>
  );
}
