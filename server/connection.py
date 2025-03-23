from cartesia import Cartesia
import os
from typing import Dict, Any
from fastapi import WebSocket
from config import config
from dotenv import load_dotenv
from llm import GeminiLLM
import uuid
import base64
import logging

load_dotenv()


class Connection:
    """High-level class that manages Cartesia, LLMs, and frontend WebSocket connection."""

    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)
        self.frontend_ws = None
        self.is_connected = False

        self.cartesia = Cartesia(api_key=os.getenv("CARTESIA_API_KEY", ""))
        self.tts_ws = self.cartesia.tts.websocket()
        self.model_id = config["model_id"]
        self.voice_embedding = config["voice_embedding"]
        self.tts_chunking_limit = config["tts_chunking_limit"]

        self.llm = GeminiLLM()
        self.audio_buffer = bytearray()

        # ID to count map to keep track of each audio message
        self.user_identifier_map = {}

    async def connect(self, websocket: WebSocket) -> None:
        """Initialize connection with frontend."""
        await websocket.accept()
        self.frontend_ws = websocket
        self.is_connected = True
        user_identifier = str(uuid.uuid4())
        self.user_identifier_map[user_identifier] = 0
        self.logger.debug("Connection established with frontend")
        await self.frontend_ws.send_json({"type": "uuid", "uuid": user_identifier})

    async def handle_message(self, message: Dict[str, Any]) -> None:
        """Handle messages from frontend and route to appropriate service."""
        if not self.is_connected:
            raise RuntimeError("No active connection with frontend")

        self.logger.debug("Received message from frontend: %s", message)
        message_type = message.get("type")
        uuid = message.get("uuid")
        self.user_identifier_map[uuid] = +1

        if message_type == "text":
            text = message.get("text", "")
            if text:
                resp = self.llm.generate_response(text, "")
                await self.stream_as_audio_response(resp["response"])
                await self.frontend_ws.send_json(
                    {"type": "transcript_item", "transcript_item": resp}
                )

        elif message_type == "audio":
            count = self.user_identifier_map[uuid]
            file_name = f"media/{uuid}-{count}.mp3"
            audio_data = message.get("audio")
            self.logger.debug("Audio data received: %s", audio_data)
            if audio_data:
                base64_data = (
                    audio_data.split("base64,")[1]
                    if "base64," in audio_data
                    else audio_data
                )
                decoded_audio = base64.b64decode(base64_data)
                self.audio_buffer.extend(decoded_audio)
            if message.get("final", False):
                with open(file_name, "wb") as f:
                    f.write(bytes(self.audio_buffer))
                self.logger.debug("Saved audio file as %s", file_name)

                self.audio_buffer.clear()
                resp = self.llm.generate_response(
                    "",
                    file_name,
                )
                await self.stream_as_audio_response(resp["response"])
                await self.frontend_ws.send_json(
                    {"type": "transcript_item", "transcript_item": resp}
                )

        else:
            await self.frontend_ws.send_json(
                {"type": "error", "message": f"Unknown message type: {message_type}"}
            )

    async def stream_as_audio_response(self, text: str) -> None:
        """Process text-to-speech conversion and stream to frontend."""
        try:
            buffer = bytearray()
            chunk_count = 0

            await self.frontend_ws.send_json(
                {"type": "tts_start", "message": "Starting TTS processing"}
            )

            for output in self.tts_ws.send(
                model_id=self.model_id,
                transcript=text,
                voice_embedding=self.voice_embedding,
                stream=True,
                output_format={
                    "container": "raw",
                    "encoding": "pcm_s16le",
                    "sample_rate": 44100,
                },
            ):
                buffer.extend(output["audio"])
                chunk_count += 1

                # The audio and pauses sound weird without any merging
                if chunk_count >= self.tts_chunking_limit:
                    await self.frontend_ws.send_json({"type": "tts_chunk"})
                    await self.frontend_ws.send_bytes(bytes(buffer))
                    buffer.clear()
                    chunk_count = 0

            # Send any remaining data in the buffer
            if buffer:
                self.logger.debug("Sending final merged chunks")
                await self.frontend_ws.send_json({"type": "tts_chunk_final"})
                await self.frontend_ws.send_bytes(bytes(buffer))
                buffer.clear()
                chunk_count = 0

            await self.frontend_ws.send_json(
                {"type": "tts_complete", "message": "TTS processing complete"}
            )

        except Exception as e:
            self.logger.error("Cartesia streaming error: %s", str(e))
            self.tts_ws = self.cartesia.tts.websocket()
            await self.frontend_ws.send_json(
                {"type": "error", "message": f"TTS error: {str(e)}"}
            )

    async def process_stt(self, audio_data: bytes) -> str:
        """Process speech-to-text conversion."""
        pass
