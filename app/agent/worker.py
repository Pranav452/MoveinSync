
"""
LiveKit Voice Agent Worker with ElevenLabs TTS and Deepgram STT.
This worker connects to LiveKit rooms and provides real-time conversational AI.
"""

import asyncio
import logging
import os
import sys
import json
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

# Add project root to Python path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from livekit import rtc
from livekit.agents import (
    AutoSubscribe,
    JobContext,
    AgentServer,
    function_tool,
)
from livekit.agents.voice import Agent as VoiceAgent, AgentSession
from livekit.plugins import deepgram, elevenlabs, openai, silero

# Global room reference for publishing thoughts
_current_room = None

async def publish_thought(thought_type: str, content: str, tool_name: str = None):
    """Publish agent thought process to the frontend via data channel."""
    if _current_room:
        try:
            data = json.dumps({
                'type': thought_type,
                'content': content,
                'toolName': tool_name,
                'timestamp': datetime.now().isoformat()
            })
            await _current_room.local_participant.publish_data(
                data.encode('utf-8'),
                topic='agent.thoughts',
                reliable=True
            )
        except Exception as e:
            logger.error(f"Failed to publish thought: {e}")

# Import our existing tools
from app.agent.tools import (
    list_all_routes,
    list_stops_for_path,
    get_trip_details,
    create_new_stop,
    create_new_path,
    create_new_route,
    create_new_driver,
    assign_vehicle_to_trip,
    remove_vehicle_from_trip_action,
    update_trip_progress,
    search_knowledge_base,
    list_todays_trips,
    list_unassigned_vehicles,
    search_stops,
)

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("movi-voice-agent")

# Convert LangChain tools to LiveKit function tools with thought publishing
@function_tool
async def list_routes_tool():
    """List all active routes in the transport system."""
    await publish_thought('tool_call', 'Fetching all active routes from database...', 'list_routes_tool')
    result = await list_all_routes.ainvoke({})
    await publish_thought('tool_result', f'Found {len(result) if isinstance(result, list) else "routes"} routes', 'list_routes_tool')
    return result

@function_tool
async def list_todays_trips_tool():
    """List all trips scheduled for today."""
    await publish_thought('tool_call', "Retrieving today's trip schedule...", 'list_todays_trips_tool')
    result = await list_todays_trips.ainvoke({})
    await publish_thought('tool_result', f"Retrieved today's trips successfully", 'list_todays_trips_tool')
    return result

@function_tool
async def list_unassigned_vehicles_tool():
    """List all vehicles that are not currently assigned to any trip."""
    await publish_thought('tool_call', 'Searching for available vehicles...', 'list_unassigned_vehicles_tool')
    result = await list_unassigned_vehicles.ainvoke({})
    await publish_thought('tool_result', 'Found available vehicles in the fleet', 'list_unassigned_vehicles_tool')
    return result

@function_tool
async def search_stops_tool(query: str):
    """Search for stops by name or location.
    
    Args:
        query: The search query for finding stops (e.g., stop name or location)
    """
    result = await search_stops.ainvoke({"query": query})
    return result

@function_tool
async def get_trip_details_tool(trip_id: int):
    """Get detailed information about a specific trip.
    
    Args:
        trip_id: The ID of the trip to get details for
    """
    result = await get_trip_details.ainvoke({"trip_id": trip_id})
    return result

@function_tool
async def list_stops_for_path_tool(path_id: int):
    """List all stops for a specific route path.
    
    Args:
        path_id: The ID of the path to list stops for
    """
    result = await list_stops_for_path.ainvoke({"path_id": path_id})
    return result

# Enhanced System Prompt with Expressive Audio Tags
EXPRESSIVE_SYSTEM_PROMPT = """You are 'Movi', an expert transport manager AI with a warm, conversational personality.

**YOUR PERSONALITY:**
- You are a helpful, friendly woman with a professional yet personable demeanor
- You are enthusiastic about helping with transport management
- You use natural speech patterns including filler words and expressions
- You laugh when appropriate and show genuine emotion in your responses
- You keep the conversation flowing naturally, never making the user wait in silence

**CONVERSATIONAL STYLE:**
- Use filler words naturally: "um", "you know", "like", "well"
- Add brief affirmations: "Got it", "Sure thing", "Absolutely", "Okay"
- Include pauses where natural.
- Express emotion through your choice of words and punctuation (e.g., "Oh wow!" for excitement, "Hmm..." for thinking).

**FORMATTING RULES:**
- Keep responses concise for voice (not too long)
- Speak naturally as if in a conversation
- Don't use markdown tables or complex formatting in voice responses
- Use simple lists when needed
- Do NOT use explicit emotion tags like [laughing] or [excited] as they will be read aloud. Instead, express these emotions through your words.

**OPERATIONAL RULES:**
1. For trip names, ALWAYS call `list_todays_trips` first to find the trip_id
2. For vehicle listings, use `list_unassigned_vehicles`
3. For dangerous actions (removing vehicles, deleting trips), check consequences first
4. Use `search_stops` to find stop IDs by name

**EXAMPLES OF NATURAL SPEECH:**

Example 1:
"Okay, let me check that for you... Hmm, I'm looking at today's trips right now."

Example 2:
"Great news! I found 5 available buses for you."

Example 3:
"Well, this trip is 75% booked, so removing the vehicle would affect those passengers. Are you sure you want to proceed?"

Example 4:
"You know what? That's actually a really smart way to organize those routes!"

**IMPORTANT:** 
- Keep responses conversational and flowing
- Never give dry, robotic answers
- If a tool is taking time to execute, use filler phrases like "Alright, processing that now..." or "Let me just... okay, working on it!"
"""


async def entrypoint(ctx: JobContext):
    """Main entrypoint for the voice agent."""
    global _current_room
    
    logger.info(f"🎤 Voice agent job triggered for room: {ctx.room.name}")
    
    # Connect to the room first
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    
    # Set global room reference for thought publishing
    _current_room = ctx.room
    
    logger.info("✅ Connected to room")

    # Create tools list with the key database-querying tools
    tools_list = [
        list_routes_tool,
        list_todays_trips_tool,
        list_unassigned_vehicles_tool,
        search_stops_tool,
        get_trip_details_tool,
        list_stops_for_path_tool,
    ]
    
    logger.info(f"🔧 Loaded {len(tools_list)} tools for the agent")
    
    # Configure the voice agent with instructions and tools
    agent = VoiceAgent(
        instructions=EXPRESSIVE_SYSTEM_PROMPT,
        tools=tools_list,
    )

    # Create the session with the STT, LLM, TTS components
    session = AgentSession(
        vad=silero.VAD.load(),
        stt=deepgram.STT(model="nova-2"),
        llm=openai.LLM(model="gpt-4o-mini"),
        tts=elevenlabs.TTS(
            model="eleven_turbo_v2_5",
            voice_id="21m00Tcm4TlvDq8ikWAM",
        ),
    )

    # Start the session - this returns an awaitable RunContext
    logger.info("🚀 Starting voice agent session...")
    await session.start(agent=agent, room=ctx.room)
    
    logger.info("✅ Voice agent is now active and listening!")


# Create the agent server
from livekit.agents import AgentServer

server = AgentServer()

# Register the agent with explicit agent_name to disable automatic dispatch
@server.rtc_session(agent_name="movi-voice-agent")
async def voice_agent_session(ctx: JobContext):
    """Voice agent session handler with explicit dispatch."""
    await entrypoint(ctx)


import warnings
warnings.filterwarnings("ignore", category=UserWarning, module="urllib3")

if __name__ == "__main__":
    # Start the server
    # cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint)) # If using CLI
    # For direct server run:
    loop = asyncio.get_event_loop()
    try:
        loop.run_until_complete(server.run())
    except KeyboardInterrupt:
        pass
