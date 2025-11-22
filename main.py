import os
import logging
import base64
from contextlib import asynccontextmanager
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, HTTPException, Form, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from io import BytesIO

# OpenAI Direct Client
from openai import AsyncOpenAI

# LiveKit Imports
from livekit.api import AccessToken, VideoGrants, LiveKitAPI
from livekit.protocol import room as proto_room

# LangGraph Imports
from langchain_core.messages import HumanMessage
from app.agent.graph import init_graph, pool as agent_pool 
from app.core.db import supabase

# --- 1. CONFIGURATION & LOGGING ---
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("MoviBackend")

openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# --- 2. LIFESPAN MANAGER ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Movi Backend starting up...")
    try:
        await agent_pool.open()
        logger.info("✅ Agent Memory Pool (Postgres) connected.")
        
        app.state.agent = await init_graph()
        logger.info("✅ LangGraph Agent initialized.")

        supabase.table("vehicles").select("count", count="exact").execute()
        logger.info("✅ Supabase Client connection verified.")
        
    except Exception as e:
        logger.critical(f"❌ Startup failed: {e}")
        # Don't raise e here to allow the app to start even if DB/Agent is flaky (for debugging)
        # raise e 
    
    yield
    
    logger.info("🛑 Movi Backend shutting down...")
    await agent_pool.close()

app = FastAPI(title="Movi Backend", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 3. MODELS ---

class ChatRequest(BaseModel):
    message: str
    thread_id: str = "session_1"
    current_page: str = "busDashboard"

class CreateStopRequest(BaseModel):
    name: str
    latitude: float
    longitude: float

class CreateRouteRequest(BaseModel):
    path_id: str
    route_display_name: str
    shift_time: str
    direction: str
    status: str = "active"

class CreatePathRequest(BaseModel):
    path_name: str
    ordered_list_of_stop_ids: List[str]

class CreateTripRequest(BaseModel):
    route_id: str
    display_name: str
    booking_status_percentage: float = 0.0
    live_status: str = "Scheduled"

class UpdateTripRequest(BaseModel):
    trip_id: Optional[str] = None # Optional in body if passed in URL
    display_name: Optional[str] = None
    booking_status_percentage: Optional[float] = None
    live_status: Optional[str] = None
    route_id: Optional[str] = None

class AssignDeploymentRequest(BaseModel):
    trip_id: str
    vehicle_id: str
    driver_id: str

class TTSRequest(BaseModel):
    text: str
    voice: str = "nova"

class LiveKitTokenRequest(BaseModel):
    room_name: str
    participant_name: str

# --- 4. ENDPOINTS ---

# LIVEKIT TOKEN
@app.post("/api/livekit-token")
async def generate_livekit_token(req: LiveKitTokenRequest):
    """Generate a LiveKit access token for voice chat and dispatch the agent."""
    try:
        api_key = os.getenv("LIVEKIT_API_KEY")
        api_secret = os.getenv("LIVEKIT_API_SECRET")
        livekit_url = os.getenv("LIVEKIT_URL")
        
        if not api_key or not api_secret or not livekit_url:
            raise HTTPException(status_code=500, detail="LiveKit credentials not configured")
        
        # Generate user token
        token = AccessToken(api_key, api_secret)
        token.with_identity(req.participant_name)
        token.with_name(req.participant_name)
        
        token.with_grants(
            VideoGrants(
                room_join=True,
                room=req.room_name,
                can_publish=True,
                can_subscribe=True,
                can_publish_data=True,
                room_create=True,
            )
        )
        
        jwt_token = token.to_jwt()
        
        logger.info(f"🎫 Generated LiveKit token for {req.participant_name} in room {req.room_name}")
        
        # Create room and dispatch agent (only if not already dispatched)
        try:
            lk_api = LiveKitAPI(livekit_url, api_key, api_secret)
            
            # Create the room if it doesn't exist
            await lk_api.room.create_room(
                proto_room.CreateRoomRequest(
                    name=req.room_name,
                )
            )
            logger.info(f"✅ Created/verified room: {req.room_name}")
            
            # Check if agent is already in the room by listing participants
            room_info = await lk_api.room.list_participants(
                proto_room.ListParticipantsRequest(room=req.room_name)
            )
            
            # Check if an agent participant is already in the room
            agent_exists = any(
                p.kind == proto_room.ParticipantInfo.Kind.AGENT 
                for p in room_info.participants
            )
            
            if not agent_exists:
                # Dispatch the agent to the room
                from livekit.protocol import agent_dispatch
                dispatch_response = await lk_api.agent_dispatch.create_dispatch(
                    agent_dispatch.CreateAgentDispatchRequest(
                        room=req.room_name,
                        agent_name="movi-voice-agent",
                    )
                )
                logger.info(f"🤖 Dispatched NEW agent to room: {dispatch_response}")
            else:
                logger.info(f"⏭️ Agent already exists in room, skipping dispatch")
            
        except Exception as e:
            logger.warning(f"Room/dispatch error: {e}")
        
        return {
            "token": jwt_token,
            "url": livekit_url,
            "shouldConnect": True
        }
    except Exception as e:
        logger.error(f"Error generating LiveKit token: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# ROUTES
@app.get("/api/routes")
async def get_routes():
    return supabase.table("routes").select("*, paths(*)").execute().data

@app.post("/api/routes")
async def create_route(req: CreateRouteRequest):
    try:
        data = {
            "path_id": req.path_id,
            "route_display_name": req.route_display_name,
            "shift_time": req.shift_time,
            "direction": req.direction,
            "status": req.status,
        }
        result = supabase.table("routes").insert(data).execute()
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create route")
        return result.data[0]
    except Exception as e:
        logger.error(f"Error creating route: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error creating route: {str(e)}")

# PATHS
@app.get("/api/paths")
async def get_paths():
    return supabase.table("paths").select("*").execute().data

@app.post("/api/paths")
async def create_path(req: CreatePathRequest):
    try:
        data = {
            "path_name": req.path_name,
            "ordered_list_of_stop_ids": req.ordered_list_of_stop_ids,
        }
        result = supabase.table("paths").insert(data).execute()
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create path")
        return result.data[0]
    except Exception as e:
        logger.error(f"Error creating path: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error creating path: {str(e)}")

# TRIPS
@app.get("/api/trips")
async def get_trips():
    return supabase.table("daily_trips").select("*, deployments(vehicle_id, driver_id)").execute().data

@app.post("/api/trips")
async def create_trip(req: CreateTripRequest):
    logger.info(f"Creating trip: {req.display_name}")
    try:
        data = {
            "route_id": req.route_id,
            "display_name": req.display_name,
            "booking_status_percentage": req.booking_status_percentage,
            "live_status": req.live_status,
        }
        result = supabase.table("daily_trips").insert(data).execute()
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create trip")
        return result.data[0]
    except Exception as e:
        logger.error(f"Error creating trip: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error creating trip: {str(e)}")

@app.put("/api/trips/{trip_id}")
async def update_trip(trip_id: str, req: UpdateTripRequest):
    logger.info(f"Updating trip {trip_id} with {req}")
    try:
        update_fields: Dict[str, Any] = {}
        if req.display_name is not None:
            update_fields["display_name"] = req.display_name
        if req.booking_status_percentage is not None:
            update_fields["booking_status_percentage"] = req.booking_status_percentage
        if req.live_status is not None:
            update_fields["live_status"] = req.live_status
        if req.route_id is not None:
            update_fields["route_id"] = req.route_id

        if not update_fields:
            return {"message": "No changes provided"}

        result = supabase.table("daily_trips").update(update_fields).eq("trip_id", trip_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Trip not found")
        return result.data[0]
    except Exception as e:
        logger.error(f"Error updating trip: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error updating trip: {str(e)}")

# VEHICLES & DEPLOYMENTS
@app.get("/api/vehicles")
async def get_vehicles():
    return supabase.table("vehicles").select("*").execute().data

@app.post("/api/deployments")
async def assign_deployment(req: AssignDeploymentRequest):
    import uuid
    try:
        dep_id = f"dep_{str(uuid.uuid4())[:4]}"
        data = {
            "deployment_id": dep_id,
            "trip_id": req.trip_id,
            "vehicle_id": req.vehicle_id,
            "driver_id": req.driver_id,
        }
        supabase.table("deployments").insert(data).execute()
        return {"message": "Deployment created", "deployment_id": dep_id}
    except Exception as e:
        logger.error(f"Error assigning deployment: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error assigning deployment: {str(e)}")

@app.delete("/api/deployments/{trip_id}")
async def remove_deployment(trip_id: str):
    try:
        supabase.table("deployments").delete().eq("trip_id", trip_id).execute()
        return {"message": "Deployment removed"}
    except Exception as e:
        logger.error(f"Error removing deployment: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error removing deployment: {str(e)}")

# STOPS
@app.get("/api/stops")
async def get_stops():
    return supabase.table("stops").select("*").execute().data

@app.post("/api/stops")
async def create_stop(req: CreateStopRequest):
    try:
        data = {
            "name": req.name,
            "latitude": req.latitude,
            "longitude": req.longitude,
        }
        result = supabase.table("stops").insert(data).execute()
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create stop")
        return result.data[0]
    except Exception as e:
        logger.error(f"Error creating stop: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error creating stop: {str(e)}")

# CHAT & AGENT
@app.post("/api/chat")
async def chat_endpoint(request: Request, chat_req: ChatRequest):
    agent = request.app.state.agent
    try:
        logger.info(f"💬 Chat: {chat_req.message}")
        config = {"configurable": {"thread_id": chat_req.thread_id}}
        inputs = {
            "messages": [HumanMessage(content=chat_req.message)],
            "current_page": chat_req.current_page,
        }
        final_state = await agent.ainvoke(inputs, config=config)
        return {
            "response": final_state["messages"][-1].content,
            "awaiting_confirmation": final_state.get("awaiting_confirmation", False),
        }
    except Exception as e:
        logger.error(f"Agent error: {e}", exc_info=True)
        # Fallback
        return {
            "response": f"I'm having trouble connecting to my brain right now. Error: {str(e)}",
            "awaiting_confirmation": False
        }

@app.post("/api/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)):
    try:
        audio_bytes = await audio.read()
        if len(audio_bytes) < 100:
            return {"text": "Audio too short."}
        
        audio_file = BytesIO(audio_bytes)
        audio_file.name = "audio.webm" # Simple default
        
        transcript = await openai_client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            response_format="text",
            language="en",
        )
        return {"text": transcript}
    except Exception as e:
        logger.error(f"Transcription error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/text-to-speech")
async def text_to_speech(req: TTSRequest):
    try:
        response = await openai_client.audio.speech.create(
            model="tts-1",
            voice=req.voice,
            input=req.text,
            response_format="mp3"
        )
        return StreamingResponse(iter([response.content]), media_type="audio/mpeg")
    except Exception as e:
        logger.error(f"TTS error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze-image")
async def analyze_image(
    request: Request,
    image: UploadFile = File(...),
    thread_id: str = Form(...),
    current_page: str = Form(...),
    message: Optional[str] = Form(None) # Added optional message field
):
    agent = request.app.state.agent
    logger.info(f"👁️ Analyzing Uploaded File: {image.filename}. Message: {message}")
    
    try:
        file_bytes = await image.read()
        
        mime_type = "image/jpeg"
        if image.filename.lower().endswith(".png"):
            mime_type = "image/png"
        elif image.filename.lower().endswith(".webp"):
            mime_type = "image/webp"
            
        base64_image = base64.b64encode(file_bytes).decode("utf-8")
        image_url_data = f"data:{mime_type};base64,{base64_image}"

        # Construct prompt based on user message
        user_prompt = "Describe what action this screenshot implies for a transport manager."
        if message:
            user_prompt = f"The user says: '{message}'. Based on this image and the user's message, return a single command sentence that the Movi agent can execute."
        else:
            user_prompt += " Return a single command sentence."

        logger.info(f"📨 Sending {mime_type} image to OpenAI Vision with prompt: {user_prompt}")
        
        response = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text", 
                            "text": (
                                f"{user_prompt}\n"
                                "If the user is asking for help or to identify something, describe it clearly. "
                                "If the user implies an action (create, delete, update), formulate it as a command."
                            )
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": image_url_data,
                                "detail": "high"
                            },
                        },
                    ],
                }
            ],
            max_tokens=300,
        )
        
        interpreted_intent = response.choices[0].message.content
        logger.info(f"🧠 Vision Result: {interpreted_intent}")
        
        config = {"configurable": {"thread_id": thread_id}}
        inputs = {
            "messages": [HumanMessage(content=interpreted_intent)],
            "current_page": current_page
        }
        
        final_state = await agent.ainvoke(inputs, config=config)
        return {
            "interpreted_intent": interpreted_intent,
            "response": final_state["messages"][-1].content
        }
    except Exception as e:
        logger.error(f"🔥 Vision Crash: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Vision Error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
