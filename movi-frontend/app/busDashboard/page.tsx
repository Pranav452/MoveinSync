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
          <h1 className="text-2xl font-bold text-gray-900">Bus Dashboard</h1>
          <p className="text-gray-500 mt-1">Live Operations & Trip Status</p>
        </div>
        <div className="flex gap-3">
          <button onClick={loadData} className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 shadow-sm">
            Refresh Data
          </button>
          <button className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 shadow-md shadow-brand-200">
            + Manual Dispatch
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Trips", value: trips.length, color: "bg-blue-50 text-blue-700" },
          { label: "In Progress", value: trips.filter(t => t.live_status === 'In Progress').length, color: "bg-amber-50 text-amber-700" },
          { label: "Completed", value: trips.filter(t => t.live_status === 'Completed').length, color: "bg-green-50 text-green-700" },
          { label: "Scheduled", value: trips.filter(t => t.live_status === 'Scheduled').length, color: "bg-purple-50 text-purple-700" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${stat.color.split(' ')[1]}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 font-semibold text-gray-900">Trip Name</th>
              <th className="px-6 py-4 font-semibold text-gray-900">Route ID</th>
              <th className="px-6 py-4 font-semibold text-gray-900">Occupancy</th>
              <th className="px-6 py-4 font-semibold text-gray-900">Vehicle/Driver</th>
              <th className="px-6 py-4 font-semibold text-gray-900">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-500">Loading live data...</td></tr>
            ) : (
              trips.map((trip) => (
                <tr key={trip.trip_id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {trip.display_name}
                    <div className="text-xs text-gray-400 font-normal mt-0.5">{trip.trip_id}</div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{trip.route_id}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${trip.booking_status_percentage > 80 ? 'bg-red-500' : 'bg-brand-500'}`} 
                          style={{ width: `${trip.booking_status_percentage}%` }} 
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-600">{trip.booking_status_percentage}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {trip.deployments ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-900 bg-gray-100 px-2 py-1 rounded w-fit">
                          <Bus className="w-3 h-3" /> {trip.deployments.vehicle_id}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <User className="w-3 h-3" /> {trip.deployments.driver_id}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-red-500 font-medium bg-red-50 px-2 py-1 rounded border border-red-100">
                        Unassigned
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
                      ${trip.live_status === 'Completed' ? 'bg-green-100 text-green-700' : 
                        trip.live_status === 'In Progress' ? 'bg-amber-100 text-amber-700' : 
                        'bg-gray-100 text-gray-700'}`}>
                      {trip.live_status === 'In Progress' && <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />}
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