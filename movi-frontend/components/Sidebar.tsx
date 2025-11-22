"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Map, Bus, Settings, LogOut, Mic } from "lucide-react";

const navItems = [
  { name: "Bus Dashboard", href: "/busDashboard", icon: LayoutDashboard },
  { name: "Manage Routes", href: "/manageRoute", icon: Map },
  { name: "Voice Chat", href: "/voiceChat", icon: Mic },
  { name: "Fleet", href: "#", icon: Bus },
  { name: "Settings", href: "#", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="w-64 bg-[#1a1625] border-r border-[#2d2a3a] h-screen flex flex-col fixed left-0 top-0">
      {/* Logo Area */}
      <div className="p-6 border-b border-[#2d2a3a]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#7c3aed] rounded-lg flex items-center justify-center text-white font-bold text-xl">
            M
          </div>
          <span className="font-bold text-xl tracking-tight text-white">MoveInSync</span>
        </div>
        <div className="text-xs text-[#a78bfa] mt-1 font-medium px-1">SHUTTLE ADMIN</div>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all ${
                isActive
                  ? "bg-[#7c3aed] text-white shadow-sm"
                  : "text-[#c4b5fd] hover:bg-[#2d2a3a] hover:text-white"
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? "text-white" : "text-[#a78bfa]"}`} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-[#2d2a3a]">
        <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#2d2a3a] cursor-pointer transition-colors">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7c3aed] to-[#6366f1] flex items-center justify-center text-white font-bold shadow-md">
            MD
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">Manager Dave</p>
            <p className="text-xs text-[#a78bfa] truncate">admin@moveinsync.com</p>
          </div>
          <LogOut className="w-4 h-4 text-[#a78bfa]" />
        </div>
      </div>
    </div>
  );
}