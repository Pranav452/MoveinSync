from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, ToolMessage, AIMessage, HumanMessage
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.prebuilt import ToolNode
from psycopg_pool import AsyncConnectionPool
import os

# FIX: Import the new tool
from app.agent.tools import (
    list_all_routes,
    list_stops_for_path,
    get_trip_details,
    create_new_stop,
    assign_vehicle_to_trip,
    remove_vehicle_from_trip_action,
    search_knowledge_base,
    list_todays_trips,
    list_unassigned_vehicles,
)

from app.agent.state import AgentState

# --- 1. SETUP & PROMPT ---
SYSTEM_PROMPT = """You are 'Movi', an expert transport manager AI.

CRITICAL RULES:
1. **ID LOOKUP:** If the user gives you a Trip Name (e.g., "Bulk - 00:01"), you MUST first call `list_todays_trips` to find its `trip_id`. 
   - NEVER guess the ID.
   - NEVER use the Name as the ID.

2. **SAFETY CHECK:** 
   - Once you have the `trip_id`, call `remove_vehicle_from_trip_action`.
   - Do NOT check bookings yourself. The system will intercept and check safety.

3. **VEHICLE LISTING:**
   - When the user asks for "all available buses", "all vehicles", or similar, you MUST call `list_unassigned_vehicles`.
   - Then, summarise the vehicles clearly: ID, license plate, type, capacity.
"""

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

tools = [
    list_all_routes,
    list_stops_for_path,
    get_trip_details,
    create_new_stop,
    assign_vehicle_to_trip,
    remove_vehicle_from_trip_action,
    search_knowledge_base,
    list_todays_trips,
    list_unassigned_vehicles,
]

llm_with_tools = llm.bind_tools(tools)

# --- 2. DATABASE CONNECTION POOL ---
DB_URI = os.getenv("DB_URI")
connection_kwargs = {
    "autocommit": True,
    "prepare_threshold": None, 
}
pool = AsyncConnectionPool(conninfo=DB_URI, kwargs=connection_kwargs, open=False)

# --- 3. NODES ---

async def agent_node(state: AgentState):
    messages = state["messages"]
    
    if state.get("awaiting_confirmation"):
        last_user_msg = messages[-1].content.lower()
        if "yes" in last_user_msg or "proceed" in last_user_msg:
            trip_id = state.get("target_trip_id")
            recovery_msg = HumanMessage(content=f"User confirmed safety check. Execute the removal of vehicle from trip {trip_id} now.")
            response = await llm_with_tools.ainvoke(messages + [recovery_msg])
            return {
                "messages": [recovery_msg, response],
                "awaiting_confirmation": False, 
                "consequence_risk": None
            }
        else:
            return {
                "messages": [AIMessage(content="Okay, operation cancelled.")],
                "awaiting_confirmation": False,
                "target_trip_id": None
            }

    if len(messages) == 0 or not isinstance(messages[0], SystemMessage):
        messages = [SystemMessage(content=SYSTEM_PROMPT)] + messages
        
    response = await llm_with_tools.ainvoke(messages)
    return {"messages": [response]}

async def check_consequences_node(state: AgentState):
    last_message = state["messages"][-1]
    trip_id = None
    tool_call_id = None
    
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        for tool in last_message.tool_calls:
            if tool["name"] == "remove_vehicle_from_trip_action":
                trip_id = tool["args"].get("trip_id")
                tool_call_id = tool["id"]
                break
    
    state_update = {"target_trip_id": trip_id}
    
    if not trip_id:
        return {**state_update, "consequence_risk": "LOW"}

    print(f"🕵️ Checking consequences for Trip: {trip_id}")
    from app.core.db import supabase
    response = supabase.table("daily_trips").select("booking_status_percentage").eq("trip_id", trip_id).execute()
    
    risk = "LOW"
    msg = None
    messages_to_add = []
    
    if response.data:
        booking_pct = response.data[0]['booking_status_percentage']
        if booking_pct > 0:
            risk = "HIGH"
            msg = f"⚠️ **WAIT!** This trip is **{booking_pct}% booked**. Removing the vehicle will cancel these bookings.\n\nDo you want to proceed?"
            
            if tool_call_id:
                fake_tool_output = ToolMessage(
                    tool_call_id=tool_call_id,
                    content=f"SAFETY INTERLOCK: Trip is {booking_pct}% booked. Action paused pending user confirmation."
                )
                messages_to_add.append(fake_tool_output)

    return {
        **state_update,
        "consequence_risk": risk,
        "consequence_message": msg,
        "messages": messages_to_add
    }

# --- 4. EDGES ---

def route_logic(state: AgentState):
    last_message = state["messages"][-1]
    if not last_message.tool_calls:
        return END
    
    for tool_call in last_message.tool_calls:
        if tool_call["name"] == "remove_vehicle_from_trip_action":
            messages = state["messages"]
            if len(messages) >= 2:
                previous_msg = messages[-2]
                if isinstance(previous_msg, HumanMessage) and "User confirmed" in previous_msg.content:
                    return "tools"
            return "check_consequences"
            
    return "tools"

def decision_logic(state: AgentState):
    if state.get("consequence_risk") == "HIGH":
        return "ask_confirmation"
    return "tools"

# --- 5. GRAPH DEFINITION ---

workflow = StateGraph(AgentState)
workflow.add_node("agent", agent_node)
workflow.add_node("check_consequences", check_consequences_node)
workflow.add_node("tools", ToolNode(tools))
workflow.add_node("ask_confirmation", lambda x: {
    "messages": [AIMessage(content=x["consequence_message"])], 
    "awaiting_confirmation": True
})

workflow.set_entry_point("agent")
workflow.add_conditional_edges("agent", route_logic, ["check_consequences", "tools", END])
workflow.add_conditional_edges("check_consequences", decision_logic, ["ask_confirmation", "tools"])
workflow.add_edge("tools", "agent")
workflow.add_edge("ask_confirmation", END)

# --- 6. INITIALIZER ---
async def init_graph():
    checkpointer = AsyncPostgresSaver(pool)
    await checkpointer.setup() 
    app = workflow.compile(checkpointer=checkpointer)
    return app
