"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchTrips, fetchRoutes, fetchVehicles, fetchStops, createTrip, assignDeployment, removeDeployment } from "@/lib/api";
import { Trip, Route, Vehicle, Stop } from "@/types";
import MoviWidget from "@/components/MoviWidget";
import dynamic from "next/dynamic";
const TripMap = dynamic(() => import("@/components/TripMap"), { ssr: false });
import { User, Bus, MapPin, Clock, AlertCircle, MoreVertical, Plus, RefreshCw } from "lucide-react";

export default function BusDashboard() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingTrip, setCreatingTrip] = useState(false);
  const [assigningTripId, setAssigningTripId] = useState<string | null>(null);
  const [assignVehicleId, setAssignVehicleId] = useState<string>("");
  const [assignDriverId, setAssignDriverId] = useState<string>("");

  const [newTripName, setNewTripName] = useState("");
  const [newTripRouteId, setNewTripRouteId] = useState("");
  const [newTripStatus, setNewTripStatus] = useState<Trip["live_status"]>("Scheduled");
  const [newTripBooking, setNewTripBooking] = useState<number>(0);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchTrips();
      const [routesData, vehiclesData, stopsData] = await Promise.all([
        fetchRoutes(),
        fetchVehicles(),
        fetchStops(),
      ]);
      setRoutes(routesData);
      setVehicles(vehiclesData);
      setStops(stopsData);
      setTrips(data.sort((a: Trip, b: Trip) => a.trip_id.localeCompare(b.trip_id)));
      if (!selectedTripId && data.length > 0) {
        setSelectedTripId(data[0].trip_id);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const selectedTrip = useMemo(
    () => trips.find((t) => t.trip_id === selectedTripId) || null,
    [trips, selectedTripId]
  );

  const selectedRoute = useMemo(() => {
    if (!selectedTrip) return null;
    return routes.find((r) => r.route_id === selectedTrip.route_id) || null;
  }, [routes, selectedTrip]);

  const selectedTripStops = useMemo(() => {
    if (!selectedRoute || !selectedRoute.paths?.ordered_list_of_stop_ids) return [];
    const ids = selectedRoute.paths.ordered_list_of_stop_ids;
    return ids
      .map((id) => stops.find((s) => s.stop_id === id))
      .filter((s): s is Stop => Boolean(s));
  }, [selectedRoute, stops]);

  const handleCreateTrip = async () => {
    if (!newTripName.trim() || !newTripRouteId) return;
    try {
      setCreatingTrip(true);
      const created = await createTrip({
        route_id: newTripRouteId,
        display_name: newTripName.trim(),
        booking_status_percentage: newTripBooking,
        live_status: newTripStatus,
      });
      setTrips(prev => [...prev, created].sort((a, b) => a.trip_id.localeCompare(b.trip_id)));
      setShowCreateModal(false);
      setNewTripName("");
      setNewTripRouteId("");
      setNewTripStatus("Scheduled");
      setNewTripBooking(0);
    } catch (e) {
      console.error(e);
      alert("Failed to create trip. Please try again.");
    } finally {
      setCreatingTrip(false);
    }
  };

  const handleAssignDeployment = async () => {
    if (!assigningTripId || !assignVehicleId.trim() || !assignDriverId.trim()) return;
    try {
      await assignDeployment({
        trip_id: assigningTripId,
        vehicle_id: assignVehicleId,
        driver_id: assignDriverId,
      });
      setTrips(prev =>
        prev.map(t =>
          t.trip_id === assigningTripId
            ? { ...t, deployments: { vehicle_id: assignVehicleId, driver_id: assignDriverId } }
            : t
        )
      );
      setAssigningTripId(null);
      setAssignVehicleId("");
      setAssignDriverId("");
    } catch (e) {
      console.error(e);
      alert("Failed to assign deployment. Please try again.");
    }
  };

  const handleRemoveDeployment = async (trip: Trip) => {
    if(!confirm("Are you sure you want to remove this vehicle?")) return;
    try {
      await removeDeployment(trip.trip_id);
      setTrips(prev =>
        prev.map(t => (t.trip_id === trip.trip_id ? { ...t, deployments: undefined } : t))
      );
    } catch (e) {
      console.error(e);
      alert("Failed to remove deployment. Please try again.");
    }
  };

  // Derived Stats
  const stats = useMemo(() => [
    { label: "Total Trips", value: trips.length, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Active", value: trips.filter(t => t.live_status === 'In Progress').length, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Completed", value: trips.filter(t => t.live_status === 'Completed').length, color: "text-green-600", bg: "bg-green-50" },
    { label: "Issues", value: 0, color: "text-red-600", bg: "bg-red-50" },
  ], [trips]);

  return (
    <div className="h-full flex flex-col gap-6">
      {/* Header & Stats */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bus Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Daily Operations Overview</p>
        </div>
        <div className="flex gap-3">
            {stats.map((stat) => (
                <div key={stat.label} className={`px-4 py-2 rounded-lg border border-gray-100 shadow-sm flex items-center gap-3 bg-white`}>
                    <div className={`w-2 h-2 rounded-full ${stat.color.replace('text-', 'bg-')}`} />
                    <div>
                        <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">{stat.label}</div>
                        <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
                    </div>
                </div>
            ))}
        </div>
        <div className="flex gap-2">
             <button onClick={loadData} className="p-2 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 shadow-sm transition-colors">
                <RefreshCw className="w-5 h-5" />
             </button>
             <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-bold hover:bg-brand-700 shadow-md transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                New Trip
              </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-12 gap-6 h-[calc(100vh-180px)]">
        
        {/* Left Column: Trip List (3/12) */}
        <div className="col-span-3 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
             <h2 className="font-bold text-gray-800 text-sm">Today's Trips</h2>
             <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{trips.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
                <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
            ) : (
                <div className="divide-y divide-gray-50">
                    {trips.map(trip => (
                        <button
                            key={trip.trip_id}
                            onClick={() => setSelectedTripId(trip.trip_id)}
                            className={`w-full text-left p-4 hover:bg-gray-50 transition-all border-l-4 ${
                                selectedTripId === trip.trip_id 
                                ? "bg-brand-50 border-brand-500" 
                                : "border-transparent"
                            }`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className="font-semibold text-gray-900 text-sm">{trip.display_name}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${
                                    trip.live_status === 'In Progress' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                    trip.live_status === 'Completed' ? 'bg-green-50 text-green-700 border-green-200' :
                                    'bg-gray-50 text-gray-600 border-gray-200'
                                }`}>
                                    {trip.live_status}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                                <Clock className="w-3 h-3" />
                                <span>{trip.trip_id.split('-').pop() || '00:00'}</span>
                                <span>•</span>
                                <span>{trip.route_id}</span>
                            </div>
                            {/* Progress Bar */}
                            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                <div 
                                    className={`h-full rounded-full ${
                                        trip.booking_status_percentage > 90 ? 'bg-red-500' : 
                                        trip.booking_status_percentage > 50 ? 'bg-brand-500' : 'bg-blue-500'
                                    }`} 
                                    style={{ width: `${trip.booking_status_percentage}%` }}
                                />
                            </div>
                        </button>
                    ))}
                </div>
            )}
          </div>
        </div>

        {/* Middle Column: Map (6/12) */}
        <div className="col-span-6 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
            {/* Map Header */}
            <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <h2 className="font-bold text-gray-800 text-sm">Live Fleet Map</h2>
                <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    <span className="text-[10px] text-gray-500 font-bold uppercase">Live Updates</span>
                </div>
            </div>

            <div className="flex-1 relative w-full min-h-0 bg-gray-50">
                {selectedTripStops.length > 0 ? (
                    <TripMap
                    key={selectedTripId || "map"}
                    stops={selectedTripStops.map((s) => ({
                        name: s.name,
                        latitude: s.latitude,
                        longitude: s.longitude,
                    }))}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                        Select a trip with valid stops to view map
                    </div>
                )}
            </div>
        </div>

        {/* Right Column: Details (3/12) */}
        <div className="col-span-3 flex flex-col gap-4">
            {selectedTrip ? (
                <>
                    {/* Trip Info Card */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <div className="w-1.5 h-4 bg-brand-500 rounded-full" />
                            Trip Details
                        </h3>
                        
                        <div className="space-y-4">
                             <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                                <div className="text-xs text-gray-500">Occupancy</div>
                                <div className="font-bold text-xl text-gray-900">{selectedTrip.booking_status_percentage}%</div>
                             </div>

                             <div>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-medium text-gray-500">Vehicle Assignment</span>
                                    {selectedTrip.deployments && (
                                         <button onClick={() => handleRemoveDeployment(selectedTrip)} className="text-[10px] text-red-500 hover:underline">Unassign</button>
                                    )}
                                </div>
                                {selectedTrip.deployments ? (
                                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-center gap-3">
                                        <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                                            <Bus className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm text-gray-900">{selectedTrip.deployments.vehicle_id}</div>
                                            <div className="text-xs text-gray-500">Assigned Driver: {selectedTrip.deployments.driver_id}</div>
                                        </div>
                                    </div>
                                ) : (
                                    <button 
                                        onClick={() => {
                                            setAssigningTripId(selectedTrip.trip_id);
                                            setAssignVehicleId(selectedTrip.deployments?.vehicle_id || "");
                                            setAssignDriverId(selectedTrip.deployments?.driver_id || "");
                                        }}
                                        className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-xs font-medium text-gray-500 hover:border-brand-500 hover:text-brand-600 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Assign Vehicle
                                    </button>
                                )}
                             </div>

                             {/* Stops Timeline */}
                             <div>
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Route Stops</h4>
                                <div className="relative border-l-2 border-gray-200 ml-2 space-y-4 pl-4 py-1">
                                    {selectedTripStops.map((stop, idx) => (
                                        <div key={stop.stop_id} className="relative">
                                            <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-white border-2 border-brand-400" />
                                            <div className="text-xs font-medium text-gray-900">{stop.name}</div>
                                            <div className="text-[10px] text-gray-400">Expected: 08:{10 + (idx * 15)} AM</div>
                                        </div>
                                    ))}
                                </div>
                             </div>
                        </div>
                    </div>
                </>
            ) : (
                <div className="h-full bg-gray-50 border border-dashed border-gray-300 rounded-xl flex items-center justify-center text-gray-400 text-sm p-8 text-center">
                    Select a trip to view details and manage deployment
                </div>
            )}
        </div>
      </div>

      {/* MOVI WIDGET */}
      <MoviWidget currentPage="busDashboard" />

      {/* Modals */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-[1050]">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-100">
                <h2 className="text-xl font-bold text-gray-900 mb-4">New Manual Dispatch</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">TRIP IDENTIFIER</label>
                        <input 
                            className="w-full p-2 border border-gray-200 rounded-lg text-sm"
                            placeholder="e.g. Bulk - 08:00"
                            value={newTripName}
                            onChange={e => setNewTripName(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">ROUTE</label>
                        <select 
                            className="w-full p-2 border border-gray-200 rounded-lg text-sm"
                            value={newTripRouteId}
                            onChange={e => setNewTripRouteId(e.target.value)}
                        >
                            <option value="">Select Route...</option>
                            {routes.map(r => <option key={r.route_id} value={r.route_id}>{r.route_display_name}</option>)}
                        </select>
                    </div>
                    <div className="flex justify-end gap-2 mt-6">
                        <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg text-sm font-medium">Cancel</button>
                        <button onClick={handleCreateTrip} className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-bold hover:bg-brand-700">Create Dispatch</button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {assigningTripId && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-[1050]">
             <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-100">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Assign Fleet</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">VEHICLE</label>
                        <select 
                            className="w-full p-2 border border-gray-200 rounded-lg text-sm"
                            value={assignVehicleId}
                            onChange={e => setAssignVehicleId(e.target.value)}
                        >
                            <option value="">Select Vehicle...</option>
                            {vehicles.map(v => <option key={v.vehicle_id} value={v.vehicle_id}>{v.license_plate} ({v.type})</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">DRIVER ID</label>
                        <input 
                            className="w-full p-2 border border-gray-200 rounded-lg text-sm"
                            placeholder="e.g. DRIVER_001"
                            value={assignDriverId}
                            onChange={e => setAssignDriverId(e.target.value)}
                        />
                    </div>
                    <div className="flex justify-end gap-2 mt-6">
                        <button onClick={() => setAssigningTripId(null)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg text-sm font-medium">Cancel</button>
                        <button onClick={handleAssignDeployment} className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-bold hover:bg-brand-700">Assign & Deploy</button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
