import logging
import os
import asyncio
import aiohttp
from dotenv import load_dotenv

from livekit.agents import AutoSubscribe, JobContext, WorkerOptions, cli, llm
from livekit.agents.voice_assistant import VoiceAssistant
from livekit.plugins import openai, silero

load_dotenv()

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("voice-agent")

BACKEND_API_URL = "http://localhost:8000/api/chat"

class MoviBrain(llm.LLM):
    def __init__(self):
        super().__init__()

    async def chat(self, chat_ctx: llm.ChatContext, fnc_ctx: llm.FunctionContext = None,
                   temperature: float = None, n: int = 1, parallel_tool_calls: bool = True):
        
        user_text = chat_ctx.messages[-1].content
        logger.info(f"🎤 User said: {user_text}")

        payload = {
            "message": user_text,
            "thread_id": "voice_session_1",
            "current_page": "busDashboard"
        }

        ai_text = "I'm sorry, I couldn't connect to the brain."
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(BACKEND_API_URL, json=payload) as response:
                    if response.status == 200:
                        data = await response.json()
                        ai_text = data.get("response", "Empty response.")
                    else:
                        logger.error(f"Backend Error: {response.status}")
        except Exception as e:
            logger.error(f"Connection Error: {e}")

        yield llm.ChatChunk(
            choices=[
                llm.Choice(
                    delta=llm.ChoiceDelta(content=ai_text, role="assistant"),
                    index=0
                )
            ]
        )

async def entrypoint(ctx: JobContext):
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    logger.info(f"✅ Voice Agent joined room: {ctx.room.name}")

    agent = VoiceAssistant(
        vad=silero.VAD.load(),
        stt=openai.STT(),
        llm=MoviBrain(),
        tts=openai.TTS(),
    )

    agent.start(ctx.room)
    await asyncio.sleep(1)
    await agent.say("Hello! I am Movi. I am listening.", allow_interruptions=True)

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))