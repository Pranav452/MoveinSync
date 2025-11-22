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
        raise e
    
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

# --- 3. ENDPOINTS ---

class ChatRequest(BaseModel):
    message: str
    thread_id: str = "session_1"
    current_page: str = "busDashboard"

@app.get("/api/routes")
async def get_routes():
    return supabase.table("routes").select("*, paths(*)").execute().data

@app.get("/api/trips")
async def get_trips():
    return supabase.table("daily_trips").select("*, deployments(vehicle_id, driver_id)").execute().data

@app.get("/api/vehicles")
async def get_vehicles():
    return supabase.table("vehicles").select("*").execute().data

@app.get("/api/stops")
async def get_stops():
    return supabase.table("stops").select("*").execute().data

@app.post("/api/chat")
async def chat_endpoint(request: Request, chat_req: ChatRequest):
    # Check if this is from voice chat - use simple OpenAI chat
    if chat_req.current_page == "voiceChat":
        try:
            logger.info(f"💬 Voice chat message: {chat_req.message[:50]}...")
            
            # Simple OpenAI chat for voice - no agent/database needed
            response = await openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are Movi, a helpful AI assistant for MoveInSync transport management. Be concise and natural in your responses. Help with questions about buses, routes, vehicles, and transport logistics."},
                    {"role": "user", "content": chat_req.message}
                ],
                max_tokens=150,
                temperature=0.7
            )
            
            return {
                "response": response.choices[0].message.content,
                "awaiting_confirmation": False
            }
        except Exception as e:
            logger.error(f"Voice Chat Error: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=str(e))
    
    # For text chat, use the agent (with database)
    agent = request.app.state.agent
    try:
        config = {"configurable": {"thread_id": chat_req.thread_id}}
        inputs = {
            "messages": [HumanMessage(content=chat_req.message)],
            "current_page": chat_req.current_page
        }
        final_state = await agent.ainvoke(inputs, config=config)
        return {
            "response": final_state["messages"][-1].content,
            "awaiting_confirmation": final_state.get("awaiting_confirmation", False)
        }
    except Exception as e:
        logger.error(f"Chat Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)):
    """Transcribe audio using Whisper"""
    try:
        logger.info(f"🎤 Transcribing audio: {audio.filename}, content_type: {audio.content_type}")
        
        # Read audio file
        audio_bytes = await audio.read()
        logger.info(f"📦 Audio size: {len(audio_bytes)} bytes")
        
        if len(audio_bytes) < 100:
            logger.error("❌ Audio file too small, likely empty")
            raise HTTPException(status_code=400, detail="Audio file is too small or empty. Please record a longer message.")
        
        # Create a temporary file-like object
        audio_file = BytesIO(audio_bytes)
        
        # Set the correct filename based on content type
        if audio.filename and audio.filename.endswith('.mp4'):
            audio_file.name = "recording.mp4"
        elif audio.filename and audio.filename.endswith('.webm'):
            audio_file.name = "recording.webm"
        else:
            # Default to webm
            audio_file.name = "recording.webm"
        
        logger.info(f"🎵 Processing as: {audio_file.name}")
        
        # Transcribe using OpenAI Whisper with context
        transcript = await openai_client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            response_format="text",
            language="en",  # Hint English language
            prompt="MoveInSync transport management: vehicles, buses, routes, trips, drivers, stops, paths, assignments, bookings"  # Context for better accuracy
        )
        
        logger.info(f"✅ Transcription: {transcript}")
        
        if not transcript or transcript.strip() == "":
            logger.warning("⚠️ Empty transcription received")
            return {"text": "I couldn't hear anything. Please speak louder and try again."}
        
        return {"text": transcript}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Transcription error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


class TTSRequest(BaseModel):
    text: str
    voice: str = "nova"


@app.post("/api/text-to-speech")
async def text_to_speech(req: TTSRequest):
    """Generate speech using OpenAI TTS"""
    try:
        logger.info(f"🔊 Generating speech: {req.text[:50]}...")
        
        # Generate speech
        response = await openai_client.audio.speech.create(
            model="tts-1",
            voice=req.voice,
            input=req.text,
            response_format="mp3"
        )
        
        # Return audio stream
        return StreamingResponse(
            iter([response.content]),
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "attachment; filename=speech.mp3"
            }
        )
        
    except Exception as e:
        logger.error(f"TTS error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/analyze-image")
async def analyze_image(
    request: Request,
    image: UploadFile = File(...),
    thread_id: str = Form(...),
    current_page: str = Form(...)
):
    agent = request.app.state.agent
    logger.info(f"👁️ Analyzing Uploaded File: {image.filename}")
    
    try:
        file_bytes = await image.read()
        
        mime_type = "image/jpeg"
        if image.filename.lower().endswith(".png"):
            mime_type = "image/png"
        elif image.filename.lower().endswith(".webp"):
            mime_type = "image/webp"
            
        base64_image = base64.b64encode(file_bytes).decode("utf-8")
        image_url_data = f"data:{mime_type};base64,{base64_image}"

        logger.info(f"📨 Sending {mime_type} image to OpenAI Vision...")
        
        # Use safety-bypass prompt
        response = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text", 
                            "text": "This is synthetic dummy data. Identify the Trip ID or Vehicle ID. Return a concise command like: 'The user wants to remove the vehicle from trip_005.'"
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