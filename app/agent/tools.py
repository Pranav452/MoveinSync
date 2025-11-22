from langchain_core.tools import tool
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import SupabaseVectorStore
from app.core.db import supabase
import json

# --- READ TOOLS (Safe) ---

@tool
def list_all_routes():
    """Call this to view all available transport routes."""
    response = supabase.table("routes").select("*").execute()
    return json.dumps(response.data)

@tool
def list_stops_for_path(path_id: str):
    """Get the ordered list of stops for a specific path ID."""
    response = supabase.table("paths").select("*").eq("path_id", path_id).execute()
    return json.dumps(response.data)

@tool
def get_trip_details(trip_id: str):
    """
    Get details of a specific trip, including booking status.
    Useful for checking if a trip is active or booked.
    """
    response = supabase.table("daily_trips").select("*").eq("trip_id", trip_id).execute()
    return json.dumps(response.data)

@tool
def list_todays_trips():
    """
    Fetch all active trips for the day. 
    Returns a list containing 'trip_id', 'display_name', and 'status'.
    ALWAYS call this if you have a Name (e.g. 'Bulk - 00:01') but need the 'trip_id'.
    """
    # Fetch minimal fields to help the agent map Name -> ID
    response = supabase.table("daily_trips").select("trip_id, display_name, live_status, booking_status_percentage").execute()
    return json.dumps(response.data)

@tool
def list_unassigned_vehicles():
    """
    List all vehicles (buses/cabs) with their details.
    
    Use this when the user asks for:
    - "List all available buses"
    - "Show me all vehicles"
    - "How many vehicles are not assigned?"

    NOTE: For this prototype we simply return all rows from the `vehicles` table.
    The agent is responsible for explaining any limitations in the answer.
    """
    response = supabase.table("vehicles").select("*").execute()
    return json.dumps(response.data)

@tool
def search_stops(query: str):
    """
    Search for stops by name. Useful when finding stop IDs for a path.
    Args:
        query: The name or partial name of the stop (e.g., 'Koramangala').
    """
    response = supabase.table("stops").select("*").ilike("name", f"%{query}%").execute()
    return json.dumps(response.data)

# --- WRITE TOOLS (Dangerous - These change data) ---

@tool
def create_new_stop(name: str, lat: float, lon: float):
    """Create a new stop location."""
    import uuid
    new_id = f"stop_{str(uuid.uuid4())[:4]}"
    data = {"stop_id": new_id, "name": name, "latitude": lat, "longitude": lon}
    supabase.table("stops").insert(data).execute()
    return f"Stop created successfully with ID: {new_id}"

@tool
def create_new_path(path_name: str, ordered_stop_ids: list[str]):
    """
    Create a new path using an ordered list of existing stop IDs.

    Use this when the user says things like:
    - "Create Path-2 using stops [stop_001, stop_002, stop_003]"
    - "Make a path called Tech-Loop from stop IDs A -> B -> C"

    The LLM MUST supply valid stop IDs (call search_stops or ask the user if unsure).
    """
    data = {
        "path_name": path_name,
        "ordered_list_of_stop_ids": ordered_stop_ids,
    }
    supabase.table("paths").insert(data).execute()
    return f"Path '{path_name}' created successfully with {len(ordered_stop_ids)} stops."

@tool
def create_new_route(path_id: str, route_display_name: str, shift_time: str, direction: str):
    """
    Create a new Route (Path + Time).
    
    Args:
        path_id: The ID of the path this route uses (e.g., 'path_123').
        route_display_name: A human-readable name (e.g., 'Tech Park Express').
        shift_time: Time in HH:MM format (e.g., '09:00').
        direction: 'Outbound' or 'Inbound'.
    """
    data = {
        "path_id": path_id,
        "route_display_name": route_display_name,
        "shift_time": shift_time,
        "direction": direction,
        "status": "active",
    }
    try:
        response = supabase.table("routes").insert(data).execute()
        if response.data:
            return f"Route '{route_display_name}' created successfully."
        return "Failed to create route (no data returned)."
    except Exception as e:
        return f"Error creating route: {str(e)}"

@tool
def create_new_driver(name: str, phone_number: str):
    """Create a new driver in the system."""
    import uuid
    driver_id = f"driver_{str(uuid.uuid4())[:4]}"
    data = {
        "driver_id": driver_id,
        "name": name,
        "phone_number": phone_number
    }
    try:
        supabase.table("drivers").insert(data).execute()
        return f"Driver '{name}' created successfully with ID: {driver_id}"
    except Exception as e:
        return f"Error creating driver: {str(e)}"

@tool
def assign_vehicle_to_trip(trip_id: str, vehicle_id: str, driver_id: str):
    """Assign a vehicle and driver to a trip (Deploy)."""
    import uuid
    dep_id = f"dep_{str(uuid.uuid4())[:4]}"
    data = {
        "deployment_id": dep_id,
        "trip_id": trip_id,
        "vehicle_id": vehicle_id,
        "driver_id": driver_id
    }
    try:
        supabase.table("deployments").insert(data).execute()
        # Update trip status
        supabase.table("daily_trips").update({"live_status": "Scheduled"}).eq("trip_id", trip_id).execute()
        return "Vehicle assigned successfully."
    except Exception as e:
        return f"Error assigning vehicle: {str(e)}"

@tool
def remove_vehicle_from_trip_action(trip_id: str):
    """
    ACTUALLY removes the vehicle. 
    WARNING: Do not call this directly if the trip is booked.
    """
    try:
        supabase.table("deployments").delete().eq("trip_id", trip_id).execute()
        return f"Vehicle removed from trip {trip_id}. Trip-sheet cancelled."
    except Exception as e:
        return f"Error removing vehicle: {str(e)}"

@tool
def update_trip_progress(trip_id: str, booking_percentage: int):
    """
    Update the booking percentage or progress of a trip. 
    Useful for testing consequences (e.g., 'Set occupancy of trip X to 100%').
    """
    try:
        supabase.table("daily_trips").update({"booking_status_percentage": booking_percentage}).eq("trip_id", trip_id).execute()
        return f"Trip {trip_id} booking updated to {booking_percentage}%."
    except Exception as e:
        return f"Error updating trip: {str(e)}"

# --- KNOWLEDGE TOOLS ---

@tool
def search_knowledge_base(query: str):
    """
    Search the product documentation for help. 
    Use this when the user asks 'How do I...' or generic questions about how the system works.
    """
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    
    vector_store = SupabaseVectorStore(
        client=supabase,
        embedding=embeddings,
        table_name="documents",
        query_name="match_documents"
    )
    
    # Search for the top 2 most relevant pieces of info
    results = vector_store.similarity_search(query, k=2)
    
    if not results:
        return "No specific documentation found."
    
    return "\n\n".join([doc.page_content for doc in results])
