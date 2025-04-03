from cartesia import Cartesia
from db_manager import DBManager
from llm import GeminiLLM
import os
from typing import Dict, Any
from fastapi import WebSocket
from config import config
from dotenv import load_dotenv
import uuid
import base64
import logging

load_dotenv()


class Connection:
    """High-level class that manages Cartesia, LLMs, Redis, and frontend WebSocket connection."""

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

        self.db = DBManager()

        self.audio_buffer = bytearray()
        # ID to count map to keep track of each audio message
        self.user_identifier_map = {}
        self.kill_streaming = {}
        self.enable_tts = {}

    async def start_new_session(self) -> None:
        user_identifier = str(uuid.uuid4())
        self.user_identifier_map[user_identifier] = 0
        await self.frontend_ws.send_json({"type": "uuid", "uuid": user_identifier})

    async def connect(self, websocket: WebSocket) -> None:
        """Initialize connection with frontend."""
        await websocket.accept()
        self.frontend_ws = websocket
        self.is_connected = True
        await self.start_new_session()

    async def handle_message(self, message: Dict[str, Any]) -> None:
        """Handle messages from frontend and route to appropriate service."""
        if not self.is_connected:
            raise RuntimeError("No active connection with frontend")

        message_type = message.get("type")
        current_uuid = message.get("uuid")

        match message_type:
            case "new_session":
                await self.start_new_session()
                return

            case "set_tts":
                value = message.get("value", True)
                self.enable_tts[current_uuid] = value
                return

            case "get_sessions":
                sessions = self.db.list_sessions()
                await self.frontend_ws.send_json(
                    {"type": "sessions", "sessions": sessions}
                )
                return

            case "get_transcripts":
                session_id = message.get("id")
                transcript = self.db.fetch_transcript(session_id)
                context = self.db.get_context(session_id)
                print(f"\nData fetched: {context=} {transcript=}")
                await self.frontend_ws.send_json(
                    {
                        "type": "transcripts",
                        "transcripts": transcript,
                        "session_id": session_id,
                    }
                )
                return

            case "kill_streaming":
                self.kill_streaming[current_uuid] = True
                return

            case "delete_session":
                session_id = message.get("id")
                if self.db.delete_session(session_id):
                    await self.frontend_ws.send_json(
                        {"type": "session_deleted", "id": session_id}
                    )
                return

            case "text" | "audio":
                self._increment_uuid_counter(current_uuid)
                text = message.get("text", "")
                file_name = ""
                if message_type == "audio":
                    count = self.user_identifier_map[current_uuid]
                    file_name = f"media/{count}-{current_uuid}.mp3"
                    audio_data = message.get("audio")

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
                    current_uuid,
                    text,
                    file_name,
                )

                if message_type == "text":
                    await self.frontend_ws.send_json(
                        {"type": "transcript_item", "response": resp["response"], "context": resp["context"]}
                    )
                else:
                    await self.frontend_ws.send_json(
                        {"type": "transcript_item", "transcript_item": resp, "context": resp["context"]}
                    )

                await self.stream_as_audio_response(current_uuid, resp["response"])

                self.db.append_transcript(
                    current_uuid, {"query": resp["query"], "response": resp["response"]}
                )

                if resp["context"]:
                    self.db.update_context(current_uuid, resp["context"])

            case _:
                await self.frontend_ws.send_json(
                    {
                        "type": "error",
                        "message": f"Unknown message type: {message_type}",
                    }
                )

    async def stream_as_audio_response(self, current_uuid: str, text: str) -> None:
        """Process text-to-speech conversion and stream to frontend."""
        try:
            buffer = bytearray()
            chunk_count = 0

            # if current_uuid not in self.enable_tts:
            #     self.enable_tts[current_uuid] = False

            # if not self.enable_tts.get(current_uuid, True):
            #     print(
            #         f"tts response disabled, returning for {current_uuid=}",
            #         self.enable_tts,
            #     )
            #     return

            await self.frontend_ws.send_json(
                {"type": "tts_start", "message": "Starting TTS processing"}
            )

            tts_stream = self.tts_ws.send(
                model_id=self.model_id,
                transcript=text,
                voice_embedding=self.voice_embedding,
                stream=True,
                _experimental_voice_controls={"emotion": ["positivity:highest"]},
                output_format={
                    "container": "raw",
                    "encoding": "pcm_s16le",
                    "sample_rate": 44100,
                },
            )

            for output in tts_stream:
                if self.kill_streaming.get(current_uuid, False):
                    buffer.clear()
                    chunk_count = 0
                    await self.frontend_ws.send_json(
                        {
                            "type": "tts_stopped",
                            "message": "TTS streaming stopped on client request",
                        }
                    )
                    self.kill_streaming[current_uuid] = False
                    break
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

    def _increment_uuid_counter(self, current_uuid: str):
        if current_uuid not in self.user_identifier_map:
            self.user_identifier_map[current_uuid] = 0
        self.user_identifier_map[current_uuid] += 1
