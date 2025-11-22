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