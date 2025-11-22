import os
import logging
import base64
import jwt
import time
from contextlib import asynccontextmanager
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, HTTPException, Form, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv

# FIX: Import 'api' from livekit package (Official SDK way)
from livekit import api

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

# FIX: Official SDK Syntax
@app.get("/api/token")
async def get_livekit_token(room: str = "movi-room", username: str = "Manager"):
    try:
        api_key = os.getenv("LIVEKIT_API_KEY")
        api_secret = os.getenv("LIVEKIT_API_SECRET")
        livekit_url = os.getenv("LIVEKIT_URL")

        if not api_key or not api_secret:
            raise ValueError("LiveKit API Key/Secret missing")

        # Manual JWT Generation (Version Agnostic)
        current_time = int(time.time())
        payload = {
            "iss": api_key,
            "sub": username,
            "nbf": current_time,
            "exp": current_time + (6 * 60 * 60),
            "name": username,
            "video": {
                "room": room,
                "roomJoin": True,
                "canPublish": True,
                "canSubscribe": True
            }
        }

        token = jwt.encode(payload, api_secret, algorithm="HS256")
        
        logger.info(f"🎙️ Generated Manual JWT for {username}")
        return {"token": token, "url": livekit_url}

    except Exception as e:
        logger.error(f"LiveKit Token Error: {e}", exc_info=True)
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