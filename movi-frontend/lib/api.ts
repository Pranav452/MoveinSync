const BACKEND_URL = "http://localhost:8000/api";

export async function fetchRoutes() {
  const res = await fetch(`${BACKEND_URL}/routes`);
  if (!res.ok) throw new Error("Failed to fetch routes");
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

export async function uploadImageAnalysis(file: File, threadId: string, currentPage: string) {
  const formData = new FormData();
  formData.append("image", file);
  formData.append("thread_id", threadId);
  formData.append("current_page", currentPage);

  const res = await fetch(`${BACKEND_URL}/analyze-image`, {
    method: "POST",
    body: formData,
  });
  return res.json();
}