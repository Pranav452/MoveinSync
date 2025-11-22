"use client";

import { useEffect, useState } from "react";
import { fetchTrips } from "@/lib/api";
import { Trip } from "@/types";
import MoviWidget from "@/components/MoviWidget";
import { Clock, MapPin, User, Bus } from "lucide-react";

export default function BusDashboard() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await fetchTrips();
      // Sort by trip ID for stability
      setTrips(data.sort((a: Trip, b: Trip) => a.trip_id.localeCompare(b.trip_id)));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Bus Dashboard</h1>
          <p className="text-[#a78bfa] mt-1">Live Operations & Trip Status</p>
        </div>
        <div className="flex gap-3">
          <button onClick={loadData} className="px-4 py-2 bg-[#2d2a3a] border border-[#3d3a4a] text-white rounded-lg text-sm font-medium hover:bg-[#3d3a4a] shadow-sm transition-colors">
            Refresh Data
          </button>
          <button className="px-4 py-2 bg-[#7c3aed] text-white rounded-lg text-sm font-medium hover:bg-[#6d28d9] shadow-md transition-colors">
            + Manual Dispatch
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "TOTAL TRIPS", value: trips.length, bgColor: "bg-[#1e293b]", textColor: "text-[#60a5fa]", valueColor: "text-[#60a5fa]" },
          { label: "IN PROGRESS", value: trips.filter(t => t.live_status === 'In Progress').length, bgColor: "bg-[#1e293b]", textColor: "text-[#fbbf24]", valueColor: "text-[#fbbf24]" },
          { label: "COMPLETED", value: trips.filter(t => t.live_status === 'Completed').length, bgColor: "bg-[#1e293b]", textColor: "text-[#34d399]", valueColor: "text-[#34d399]" },
          { label: "SCHEDULED", value: trips.filter(t => t.live_status === 'Scheduled').length, bgColor: "bg-[#1e293b]", textColor: "text-[#a78bfa]", valueColor: "text-[#a78bfa]" },
        ].map((stat) => (
          <div key={stat.label} className={`${stat.bgColor} p-4 rounded-xl border border-[#2d2a3a] shadow-sm`}>
            <p className={`text-xs font-semibold ${stat.textColor} uppercase`}>{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${stat.valueColor}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[#1a1625] rounded-xl border border-[#2d2a3a] shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#2d2a3a] border-b border-[#3d3a4a]">
            <tr>
              <th className="px-6 py-4 font-semibold text-white">Trip Name</th>
              <th className="px-6 py-4 font-semibold text-white">Route ID</th>
              <th className="px-6 py-4 font-semibold text-white">Occupancy</th>
              <th className="px-6 py-4 font-semibold text-white">Vehicle/Driver</th>
              <th className="px-6 py-4 font-semibold text-white">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2d2a3a]">
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center text-[#a78bfa]">Loading live data...</td></tr>
            ) : (
              trips.map((trip) => (
                <tr key={trip.trip_id} className="hover:bg-[#2d2a3a] transition-colors group">
                  <td className="px-6 py-4 font-medium text-white">
                    {trip.display_name}
                    <div className="text-xs text-[#a78bfa] font-normal mt-0.5">{trip.trip_id}</div>
                  </td>
                  <td className="px-6 py-4 text-[#c4b5fd]">{trip.route_id}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-[#2d2a3a] rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${trip.booking_status_percentage > 80 ? 'bg-red-500' : 'bg-[#7c3aed]'}`} 
                          style={{ width: `${trip.booking_status_percentage}%` }} 
                        />
                      </div>
                      <span className="text-xs font-medium text-[#c4b5fd]">{trip.booking_status_percentage}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {trip.deployments ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-white bg-[#2d2a3a] px-2 py-1 rounded w-fit">
                          <Bus className="w-3 h-3" /> {trip.deployments.vehicle_id}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-[#a78bfa]">
                          <User className="w-3 h-3" /> {trip.deployments.driver_id}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-red-400 font-medium bg-[#2d1f1f] px-2 py-1 rounded border border-red-900/50">
                        Unassigned
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
                      ${trip.live_status === 'Completed' ? 'bg-[#1e3a2e] text-[#34d399]' : 
                        trip.live_status === 'In Progress' ? 'bg-[#3d2f1e] text-[#fbbf24]' : 
                        'bg-[#2d2a3a] text-[#c4b5fd]'}`}>
                      {trip.live_status === 'In Progress' && <span className="w-1.5 h-1.5 bg-[#fbbf24] rounded-full animate-pulse" />}
                      {trip.live_status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MOVI WIDGET - Context Aware */}
      <MoviWidget currentPage="busDashboard" />
    </div>
  );
}