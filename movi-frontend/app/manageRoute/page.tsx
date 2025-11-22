"use client";

import { useEffect, useState } from "react";
import { fetchRoutes } from "@/lib/api";
import { Route } from "@/types";
import MoviWidget from "@/components/MoviWidget";
import { MapPin, ArrowRight } from "lucide-react";

export default function ManageRoute() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchRoutes();
        setRoutes(data);
      } catch (e) { console.error(e); } 
      finally { setLoading(false); }
    };
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Manage Routes</h1>
          <p className="text-[#a78bfa] mt-1">Static Assets & Path Definitions</p>
        </div>
        <button className="px-4 py-2 bg-[#7c3aed] text-white rounded-lg text-sm font-medium hover:bg-[#6d28d9] shadow-md transition-colors">
          + Create New Route
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="text-center py-12 text-[#a78bfa]">Loading routes...</div>
        ) : (
          routes.map((route) => (
            <div key={route.route_id} className="bg-[#1a1625] p-5 rounded-xl border border-[#2d2a3a] shadow-sm hover:shadow-md hover:border-[#3d3a4a] transition-all">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="font-bold text-lg text-white">{route.route_display_name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${route.status === 'active' ? 'bg-[#1e3a2e] text-[#34d399]' : 'bg-[#2d2a3a] text-[#a78bfa]'}`}>
                      {route.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[#c4b5fd] mt-1 text-sm">
                    <span className="bg-[#2d2a3a] px-2 py-0.5 rounded text-[#a78bfa] font-mono">{route.shift_time}</span>
                    <span className="text-[#6b7280]">•</span>
                    <span>{route.direction} Direction</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-[#a78bfa] uppercase font-medium mb-1">Route ID</div>
                  <div className="font-mono text-sm text-[#c4b5fd]">{route.route_id}</div>
                </div>
              </div>

              {/* Path Visualization */}
              <div className="mt-6 flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2 text-white font-medium">
                  <div className="w-2 h-2 bg-[#7c3aed] rounded-full" />
                  {/* We access paths via the join relation from Supabase */}
                  {/* @ts-ignore */}
                  {route.paths?.path_name || "Unknown Path"}
                </div>
                
                <div className="flex-1 h-px bg-[#2d2a3a] relative">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <ArrowRight className="w-4 h-4 text-[#6b7280] bg-[#1a1625] px-1" />
                  </div>
                </div>

                <div className="flex gap-8 text-[#c4b5fd]">
                   {/* @ts-ignore */}
                  {route.paths?.ordered_list_of_stop_ids?.length || 0} Stops Defined
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* MOVI WIDGET - Context Aware */}
      <MoviWidget currentPage="manageRoute" />
    </div>
  );
}