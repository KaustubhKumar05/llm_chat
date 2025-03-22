from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from cartesia import Cartesia
# import whisper
from typing import Dict, Any
from dotenv import load_dotenv
import os
from constants import voice_embedding
load_dotenv()

app = FastAPI()

class Connection:
    """High-level class that manages Cartesia, Whisper, and frontend WebSocket connection."""
    
    def __init__(self):
        self.cartesia = Cartesia(api_key=os.getenv("CARTESIA_API_KEY", ""))
        # self.whisper = whisper.load_model("base")
        self.whisper = None
        self.cartesia.tts.websocket()
        print("debug> Connection established with Cartesia")
        self.frontend_ws = None
        self.is_connected = False
        self.tts_chunking_limit = 15
        self.voice_embedding = voice_embedding
    
    async def connect(self, websocket: WebSocket) -> None:
        """Initialize connection with frontend."""
        await websocket.accept()
        self.frontend_ws = websocket
        self.is_connected = True
        print("debug> Connection established with frontend")
        
    async def handle_message(self, message: Dict[str, Any]) -> None:
        """Handle messages from frontend and route to appropriate service."""
        if not self.is_connected:
            raise RuntimeError("No active connection with frontend")
            
        message_type = message.get("type")
        
        # Handle text-to-speech request
        if message_type == "tts":
            text = message.get("text", "")
            if text:
                await self.process_tts(text)
        
        # Handle speech-to-text request
        elif message_type == "stt":
            audio_data = message.get("audio")
            if audio_data:
                transcript = await self.process_stt(audio_data)
                await self.frontend_ws.send_json({
                    "type": "stt_response",
                    "transcript": transcript
                })
        # Unknown message type
        else:
            await self.frontend_ws.send_json({
                "type": "error",
                "message": f"Unknown message type: {message_type}"
            })
    
    async def process_tts(self, text: str) -> None:
        """Process text-to-speech conversion and stream to frontend."""
        try:
            buffer = bytearray()
            chunk_count = 0
            model_id = "sonic-2"
            
            await self.frontend_ws.send_json({
                "type": "tts_start",
                "message": "Starting TTS processing"
            })
            
            for output in self.tts_ws.send(
                model_id=model_id,
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
                    print("debug> Sending merged chunks")
                    await self.frontend_ws.send_json({
                        "type": "tts_chunk"
                    })
                    await self.frontend_ws.send_bytes(bytes(buffer))
                    buffer.clear()
                    chunk_count = 0

            # Send any remaining data in the buffer
            if buffer:
                print("debug> Sending final merged chunks")
                await self.frontend_ws.send_json({
                    "type": "tts_chunk_final"
                })
                await self.frontend_ws.send_bytes(bytes(buffer))
                
            # Let frontend know TTS is complete
            await self.frontend_ws.send_json({
                "type": "tts_complete",
                "message": "TTS processing complete"
            })
                
        except Exception as e:
            print(f"Cartesia streaming error: {e}")
            # Recreate the TTS WebSocket connection if it fails
            self.tts_ws = self.cartesia.tts.websocket()
            await self.frontend_ws.send_json({
                "type": "error",
                "message": f"TTS error: {str(e)}"
            })
            
    async def process_stt(self, audio_data: bytes) -> str:
        """Process speech-to-text conversion using Whisper."""
        try:
            # Save audio data to a temporary file
            temp_audio_path = "temp_audio.wav"
            with open(temp_audio_path, "wb") as f:
                f.write(audio_data)
            
            result = self.whisper.transcribe(temp_audio_path)
            transcript = result["text"]
            print("debug> Transcription results:", transcript)
            return transcript
            
        except Exception as e:
            print(f"Speech-to-text error: {e}")
            return ""


# Global connection instance
connection = Connection()

@app.websocket("/connect")
async def connect_endpoint(websocket: WebSocket):
    """Single WebSocket endpoint that handles all communication with frontend."""
    try:
        await connection.connect(websocket)
        
        await websocket.send_json({
            "type": "connection_established",
            "message": "Connection established"
        })
        
        while True:
            message = await websocket.receive_json()
            await connection.handle_message(message)
            
    except WebSocketDisconnect:
        connection.is_connected = False
        print("debug> Frontend disconnected")
    except Exception as e:
        connection.is_connected = False
        print(f"Connection error: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)