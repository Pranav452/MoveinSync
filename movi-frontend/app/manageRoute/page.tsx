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
          <h1 className="text-2xl font-bold text-gray-900">Manage Routes</h1>
          <p className="text-gray-500 mt-1">Static Assets & Path Definitions</p>
        </div>
        <button className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 shadow-md">
          + Create New Route
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading routes...</div>
        ) : (
          routes.map((route) => (
            <div key={route.route_id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="font-bold text-lg text-gray-900">{route.route_display_name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${route.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {route.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-500 mt-1 text-sm">
                    <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 font-mono">{route.shift_time}</span>
                    <span>•</span>
                    <span>{route.direction} Direction</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400 uppercase font-medium mb-1">Route ID</div>
                  <div className="font-mono text-sm text-gray-600">{route.route_id}</div>
                </div>
              </div>

              {/* Path Visualization */}
              <div className="mt-6 flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2 text-gray-900 font-medium">
                  <div className="w-2 h-2 bg-brand-500 rounded-full" />
                  {/* We access paths via the join relation from Supabase */}
                  {/* @ts-ignore */}
                  {route.paths?.path_name || "Unknown Path"}
                </div>
                
                <div className="flex-1 h-px bg-gray-100 relative">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <ArrowRight className="w-4 h-4 text-gray-300 bg-white px-1" />
                  </div>
                </div>

                <div className="flex gap-8 text-gray-500">
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