"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchRoutes, fetchPaths, fetchStops, createRoute, createStop, createPath } from "@/lib/api";
import { Route, Path, Stop } from "@/types";
import MoviWidget from "@/components/MoviWidget";
import dynamic from "next/dynamic";
const TripMap = dynamic(() => import("@/components/TripMap"), { ssr: false });
import { MapPin, ArrowRight, Clock, Compass, Plus, Map as MapIcon, ListTree, Route as RouteIcon, Navigation } from "lucide-react";

export default function ManageRoute() {
  const [activeTab, setActiveTab] = useState<"routes" | "paths" | "stops">("routes");
  
  const [routes, setRoutes] = useState<Route[]>([]);
  const [paths, setPaths] = useState<Path[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Route State
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [newRouteName, setNewRouteName] = useState("");
  const [newRoutePathId, setNewRoutePathId] = useState("");
  const [newRouteShiftTime, setNewRouteShiftTime] = useState("08:00");
  const [newRouteDirection, setNewRouteDirection] = useState("Outbound");

  // Path State
  const [newPathName, setNewPathName] = useState("");
  const [newPathStops, setNewPathStops] = useState("");

  // Stop State
  const [newStopName, setNewStopName] = useState("");
  const [newStopLat, setNewStopLat] = useState("");
  const [newStopLng, setNewStopLng] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [routesData, pathsData, stopsData] = await Promise.all([
        fetchRoutes(),
        fetchPaths(),
        fetchStops(),
      ]);
      setRoutes(routesData);
      setPaths(pathsData);
      setStops(stopsData);
      if (routesData.length > 0 && !selectedRouteId) {
           setSelectedRouteId(routesData[0].route_id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Derived Data for Routes Tab
  const selectedRoute = useMemo(
    () => routes.find((r) => r.route_id === selectedRouteId) || null,
    [routes, selectedRouteId]
  );

  const selectedRouteStops = useMemo(() => {
    if (!selectedRoute || !selectedRoute.paths?.ordered_list_of_stop_ids) return [];
    const ids = selectedRoute.paths.ordered_list_of_stop_ids;
    return ids
      .map((id) => stops.find((s) => s.stop_id === id))
      .filter((s): s is Stop => Boolean(s));
  }, [selectedRoute, stops]);

  // Actions
  const handleCreateRoute = async () => {
    if (!newRouteName.trim() || !newRoutePathId) return;
    try {
      setCreating(true);
      const created = await createRoute({
        path_id: newRoutePathId,
        route_display_name: newRouteName.trim(),
        shift_time: newRouteShiftTime,
        direction: newRouteDirection,
        status: "active",
      });
      setRoutes((prev) => [...prev, created]);
      setShowCreateModal(false);
      setNewRouteName("");
      setNewRoutePathId("");
      setNewRouteShiftTime("08:00");
      setNewRouteDirection("Outbound");
    } catch (e) {
      console.error(e);
      alert("Failed to create route.");
    } finally {
      setCreating(false);
    }
  };

  const handleCreateStop = async () => {
    if (!newStopName.trim() || !newStopLat || !newStopLng) return;
    try {
      setCreating(true);
      const created = await createStop({
        name: newStopName.trim(),
        latitude: parseFloat(newStopLat),
        longitude: parseFloat(newStopLng),
      });
      setStops((prev) => [...prev, created]);
      setNewStopName("");
      setNewStopLat("");
      setNewStopLng("");
      setShowCreateModal(false);
    } catch (e) {
      console.error(e);
      alert("Failed to create stop.");
    } finally {
      setCreating(false);
    }
  };

  const handleCreatePath = async () => {
    if (!newPathName.trim() || !newPathStops.trim()) return;
    const ids = newPathStops.split(",").map(s => s.trim()).filter(Boolean);
    if (ids.length === 0) return;
    try {
      setCreating(true);
      const created = await createPath({
        path_name: newPathName.trim(),
        ordered_list_of_stop_ids: ids,
      });
      setPaths((prev) => [...prev, created]);
      setNewPathName("");
      setNewPathStops("");
      setShowCreateModal(false);
    } catch (e) {
      console.error(e);
      alert("Failed to create path.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="h-full flex flex-col gap-6">
      {/* Header Area */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage Routes & Assets</h1>
          <p className="text-sm text-gray-500 mt-1">Static configuration for transport network</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-bold hover:bg-brand-700 shadow-md transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create New {activeTab === 'routes' ? 'Route' : activeTab === 'paths' ? 'Path' : 'Stop'}
        </button>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab("routes")}
          className={`px-6 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "routes" 
              ? "border-brand-600 text-brand-600" 
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <RouteIcon className="w-4 h-4" />
          Active Routes
        </button>
        <button
          onClick={() => setActiveTab("paths")}
          className={`px-6 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "paths" 
              ? "border-brand-600 text-brand-600" 
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <ListTree className="w-4 h-4" />
          Path Definitions
        </button>
        <button
          onClick={() => setActiveTab("stops")}
          className={`px-6 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "stops" 
              ? "border-brand-600 text-brand-600" 
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <MapPin className="w-4 h-4" />
          Stop Locations
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 h-[calc(100vh-220px)]">
        
        {/* ROUTES TAB */}
        {activeTab === "routes" && (
          <div className="grid grid-cols-12 gap-6 h-full">
            {/* Route List */}
            <div className="col-span-4 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
               <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                 <h2 className="font-bold text-gray-800 text-sm">Select Route</h2>
               </div>
               <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
                {loading ? (
                  <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>
                ) : (
                  routes.map((route) => (
                    <button
                      key={route.route_id}
                      onClick={() => setSelectedRouteId(route.route_id)}
                      className={`w-full text-left p-4 hover:bg-gray-50 transition-all border-l-4 ${
                        selectedRouteId === route.route_id ? "bg-brand-50 border-brand-500" : "border-transparent"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-sm text-gray-900">{route.route_display_name}</h3>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${
                                route.status === "active" ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"
                            }`}>
                              {route.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {route.shift_time}</span>
                            <span className="flex items-center gap-1"><Compass className="w-3 h-3" /> {route.direction}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
               </div>
            </div>

            {/* Route Details & Map */}
            <div className="col-span-8 flex flex-col gap-6">
                {selectedRoute ? (
                    <>
                        {/* MAP CARD */}
                        <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden min-h-[300px]">
                             <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
                                <MapIcon className="w-4 h-4 text-brand-600" />
                                <h2 className="font-bold text-gray-800 text-sm">Route Map Preview</h2>
                             </div>
                            <div className="flex-1 relative w-full min-h-0 bg-gray-50">
                                {selectedRouteStops.length === 0 ? (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">Map preview unavailable.</div>
                                ) : (
                                    <TripMap
                                    key={selectedRouteId || "no-route"}
                                    stops={selectedRouteStops.map((s) => ({ name: s.name, latitude: s.latitude, longitude: s.longitude }))}
                                    />
                                )}
                            </div>
                        </div>

                        <div className="h-1/3 bg-white rounded-xl border border-gray-200 shadow-sm p-5 overflow-hidden flex flex-col">
                            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                                <div className="w-1.5 h-4 bg-brand-500 rounded-full" />
                                Stops Sequence
                            </h3>
                            <div className="flex-1 overflow-y-auto">
                                {selectedRouteStops.length === 0 ? (
                                    <p className="text-xs text-gray-500">No stop information available.</p>
                                ) : (
                                    <div className="flex items-center gap-4 overflow-x-auto pb-2">
                                    {selectedRouteStops.map((stop, idx) => (
                                        <div key={stop.stop_id} className="flex items-center flex-shrink-0">
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center border border-brand-200">{idx + 1}</div>
                                                <div className="text-center">
                                                    <div className="font-bold text-xs text-gray-900">{stop.name}</div>
                                                    <div className="text-[10px] text-gray-400">{stop.latitude.toFixed(3)}, {stop.longitude.toFixed(3)}</div>
                                                </div>
                                            </div>
                                            {idx < selectedRouteStops.length - 1 && <div className="w-8 h-0.5 bg-gray-200 mx-2" />}
                                        </div>
                                    ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="h-full flex items-center justify-center bg-gray-50 border border-dashed border-gray-300 rounded-xl text-gray-400 text-sm">Select a route to view details</div>
                )}
            </div>
          </div>
        )}

        {/* PATHS TAB */}
        {activeTab === "paths" && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col h-full overflow-hidden">
             <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <div className="flex items-center gap-2">
                   <h2 className="font-bold text-gray-900 text-sm">All Defined Paths</h2>
                   <span className="text-xs font-bold bg-gray-200 text-gray-600 px-2 py-1 rounded-full">{paths.length}</span>
                </div>
             </div>
             <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paths.map((path) => (
                    <div key={path.path_id} className="p-4 bg-white border border-gray-200 rounded-xl hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><Navigation className="w-4 h-4" /></div>
                                <div>
                                    <div className="font-bold text-sm text-gray-900">{path.path_name}</div>
                                    <div className="text-[10px] text-gray-400 font-mono">{path.path_id}</div>
                                </div>
                            </div>
                        </div>
                        <div className="mt-3 bg-gray-50 rounded-lg p-2 text-xs text-gray-600 border border-gray-100">
                            <div className="font-bold text-[10px] text-gray-400 uppercase mb-1">Stops Sequence</div>
                            <div className="flex flex-wrap gap-1">
                                {path.ordered_list_of_stop_ids?.map((sid, i) => (
                                    <span key={i} className="flex items-center">
                                        <span className="font-mono bg-white border border-gray-200 px-1 rounded">{sid}</span>
                                        {i < (path.ordered_list_of_stop_ids?.length || 0) - 1 && <span className="mx-1 text-gray-400">→</span>}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
             </div>
          </div>
        )}

        {/* STOPS TAB */}
        {activeTab === "stops" && (
             <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col h-full overflow-hidden">
             <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <div className="flex items-center gap-2">
                   <h2 className="font-bold text-gray-900 text-sm">Stops Database</h2>
                   <span className="text-xs font-bold bg-gray-200 text-gray-600 px-2 py-1 rounded-full">{stops.length}</span>
                </div>
             </div>
             <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {stops.map((stop) => (
                        <div key={stop.stop_id} className="p-3 border border-gray-200 rounded-lg hover:border-brand-300 transition-colors flex items-center gap-3 bg-white">
                            <div className="w-10 h-10 rounded-full bg-gray-50 text-gray-400 flex items-center justify-center flex-shrink-0">
                                <MapPin className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                                <div className="font-bold text-sm text-gray-900 truncate">{stop.name}</div>
                                <div className="text-[10px] text-gray-500 font-mono">{stop.latitude.toFixed(4)}, {stop.longitude.toFixed(4)}</div>
                                <div className="text-[9px] text-gray-300 font-mono mt-1 truncate">{stop.stop_id}</div>
                            </div>
                        </div>
                    ))}
                </div>
             </div>
          </div>
        )}
      </div>

      {/* Create Modal (Dynamic based on active tab) */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-[1050]">
          <div className="bg-white border border-gray-200 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
                {activeTab === 'routes' ? 'Create New Route' : activeTab === 'paths' ? 'Create New Path' : 'Create New Stop'}
            </h2>
            
            <div className="space-y-4">
              {activeTab === 'routes' && (
                <>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">ROUTE NAME</label>
                        <input type="text" value={newRouteName} onChange={(e) => setNewRouteName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" placeholder="Electronic City - HSR Layout (8:00 AM)" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">PATH</label>
                        <select value={newRoutePathId} onChange={(e) => setNewRoutePathId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm">
                            <option value="">Select a path</option>
                            {paths.map((p) => <option key={p.path_id} value={p.path_id}>{p.path_name}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div><label className="block text-xs font-bold text-gray-500 mb-1">SHIFT TIME</label><input type="time" value={newRouteShiftTime} onChange={(e) => setNewRouteShiftTime(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" /></div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">DIRECTION</label>
                            <select value={newRouteDirection} onChange={(e) => setNewRouteDirection(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm">
                                <option value="Outbound">Outbound</option>
                                <option value="Inbound">Inbound</option>
                            </select>
                        </div>
                    </div>
                </>
              )}

              {activeTab === 'paths' && (
                  <>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">PATH NAME</label>
                        <input type="text" value={newPathName} onChange={(e) => setNewPathName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" placeholder="Route A (North)" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">STOP IDs (Comma Separated)</label>
                        <input type="text" value={newPathStops} onChange={(e) => setNewPathStops(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono" placeholder="stop_001, stop_002..." />
                    </div>
                  </>
              )}

              {activeTab === 'stops' && (
                  <>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">STOP NAME</label>
                        <input type="text" value={newStopName} onChange={(e) => setNewStopName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" placeholder="Central Station" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div><label className="block text-xs font-bold text-gray-500 mb-1">LATITUDE</label><input type="text" value={newStopLat} onChange={(e) => setNewStopLat(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" placeholder="12.9716" /></div>
                        <div><label className="block text-xs font-bold text-gray-500 mb-1">LONGITUDE</label><input type="text" value={newStopLng} onChange={(e) => setNewStopLng(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" placeholder="77.5946" /></div>
                    </div>
                  </>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm rounded-lg text-gray-500 hover:bg-gray-50 font-medium" disabled={creating}>Cancel</button>
              <button 
                onClick={activeTab === 'routes' ? handleCreateRoute : activeTab === 'paths' ? handleCreatePath : handleCreateStop}
                disabled={creating}
                className="px-4 py-2 text-sm rounded-lg bg-brand-600 text-white font-bold hover:bg-brand-700 disabled:opacity-60 shadow-md"
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MOVI WIDGET - Context Aware */}
      <MoviWidget currentPage="manageRoute" />
    </div>
  );
}
