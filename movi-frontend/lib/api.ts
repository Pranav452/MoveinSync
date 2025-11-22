const BACKEND_URL = "http://localhost:8000/api";

export async function fetchRoutes() {
  const res = await fetch(`${BACKEND_URL}/routes`);
  if (!res.ok) throw new Error("Failed to fetch routes");
  return res.json();
}

export async function fetchPaths() {
  const res = await fetch(`${BACKEND_URL}/paths`);
  if (!res.ok) throw new Error("Failed to fetch paths");
  return res.json();
}

export async function fetchTrips() {
  const res = await fetch(`${BACKEND_URL}/trips`);
  if (!res.ok) throw new Error("Failed to fetch trips");
  return res.json();
}

export async function fetchVehicles() {
  const res = await fetch(`${BACKEND_URL}/vehicles`);
  if (!res.ok) throw new Error("Failed to fetch vehicles");
  return res.json();
}

export async function fetchStops() {
  const res = await fetch(`${BACKEND_URL}/stops`);
  if (!res.ok) throw new Error("Failed to fetch stops");
  return res.json();
}

export async function createStop(payload: {
  name: string;
  latitude: number;
  longitude: number;
}) {
  const res = await fetch(`${BACKEND_URL}/stops`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create stop: ${text}`);
  }
  return res.json();
}

export async function createRoute(payload: {
  path_id: string;
  route_display_name: string;
  shift_time: string;
  direction: string;
  status?: string;
}) {
  const res = await fetch(`${BACKEND_URL}/routes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create route: ${text}`);
  }
  return res.json();
}

export async function createPath(payload: {
  path_name: string;
  ordered_list_of_stop_ids: string[];
}) {
  const res = await fetch(`${BACKEND_URL}/paths`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create path: ${text}`);
  }
  return res.json();
}

export async function createTrip(payload: {
  route_id: string;
  display_name: string;
  booking_status_percentage?: number;
  live_status?: string;
}) {
  const res = await fetch(`${BACKEND_URL}/trips`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create trip: ${text}`);
  }
  return res.json();
}

export async function updateTrip(
  trip_id: string,
  payload: {
    display_name?: string;
    booking_status_percentage?: number;
    live_status?: string;
    route_id?: string;
  }
) {
  const res = await fetch(`${BACKEND_URL}/trips/${trip_id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update trip: ${text}`);
  }
  return res.json();
}

export async function assignDeployment(payload: {
  trip_id: string;
  vehicle_id: string;
  driver_id: string;
}) {
  const res = await fetch(`${BACKEND_URL}/deployments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to assign deployment: ${text}`);
  }
  return res.json();
}

export async function removeDeployment(trip_id: string) {
  const res = await fetch(`${BACKEND_URL}/deployments/${trip_id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to remove deployment: ${text}`);
  }
  return res.json();
}

export async function sendChatMessage(message: string, threadId: string, currentPage: string) {
  const res = await fetch(`${BACKEND_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      message, 
      thread_id: threadId, 
      current_page: currentPage 
    }),
  });
  return res.json();
}

export async function uploadImageAnalysis(file: File, threadId: string, currentPage: string, message?: string) {
  const formData = new FormData();
  formData.append("image", file);
  formData.append("thread_id", threadId);
  formData.append("current_page", currentPage);
  
  if (message) {
    formData.append("message", message);
  }

  const res = await fetch(`${BACKEND_URL}/analyze-image`, {
    method: "POST",
    body: formData,
  });
  return res.json();
}
