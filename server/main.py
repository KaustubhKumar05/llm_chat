from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from cartesia import Cartesia
import whisper
import asyncio
from dotenv import load_dotenv
import os
from constants import voice_embedding
load_dotenv()

app = FastAPI()

class Connection:
    """High-level class that manages Cartesia, Whisper, and frontend WebSocket connections."""
    
    def __init__(self):
        self.cartesia = Cartesia(api_key=os.getenv("CARTESIA_API_KEY", ""))
        self.whisper = whisper.load_model("base")
        self.cartesia.tts.websocket()
        print("debug> Connection established with Cartesia")
        self.frontend_ws = None
        self.is_connected = False
        self.tts_chunking_limit = 15
        self.voice_embedding = voice_embedding
    
    async def connect(self, websocket: WebSocket) -> None:
        """Establish connection with frontend and initialize TTS service."""
        await websocket.accept()
        self.frontend_ws = websocket
        self.is_connected = True
        print("debug> Connection established with frontend")
        
    async def text_to_speech(self, text: str, voice_embedding: list) -> None:
        """Process text-to-speech conversion and stream to frontend."""
        if not self.is_connected:
            raise RuntimeError("No active connection with frontend")
            
        try:
            buffer = bytearray()
            chunk_count = 0
            model_id = "sonic-2"
            
            for output in self.tts_ws.send(
                model_id=model_id,
                transcript=text,
                voice_embedding=voice_embedding,
                stream=True,
                output_format={
                    "container": "raw",
                    "encoding": "pcm_s16le",
                    "sample_rate": 44100,
                },
            ):
                buffer.extend(output["audio"])
                chunk_count += 1

                if chunk_count >= self.tts_chunking_limit:
                    print("debug> Sending merged chunks")
                    await self.frontend_ws.send_bytes(bytes(buffer))
                    buffer.clear()
                    chunk_count = 0

            # Send any remaining data in the buffer
            if buffer:
                print("debug> Sending final merged chunks")
                await self.frontend_ws.send_bytes(bytes(buffer))
                
        except Exception as e:
            print(f"Cartesia streaming error: {e}")
            # Recreate the TTS WebSocket connection if it fails
            self.tts_ws = self.cartesia.tts.websocket()
            
    async def speech_to_text(self, audio_data: bytes) -> str:
        """Process speech-to-text conversion using Whisper."""
        try:
            # Save audio data to a temporary file
            temp_audio_path = "temp_audio.wav"
            with open(temp_audio_path, "wb") as f:
                f.write(audio_data)
            
            # Use Whisper to transcribe the audio
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
    """Endpoint to establish connection with frontend."""
    try:
        await connection.connect(websocket)
        
        while True:
            await websocket.send_json({"status": "connected"})
            await asyncio.sleep(30)  # Heartbeat every 30 seconds
            
    except WebSocketDisconnect:
        connection.is_connected = False
        print("debug> Frontend disconnected")
    except Exception as e:
        connection.is_connected = False
        print(f"Connection error: {e}")


@app.websocket("/tts")
async def text_to_speech_endpoint(websocket: WebSocket):
    """Endpoint for text-to-speech conversion."""
    await websocket.accept()
    print("debug> TTS connection accepted")
    
    try:
        while True:
            text = await websocket.receive_text()

            # Create a temporary connection if no global connection exists
            if not connection.is_connected:
                temp_connection = Connection()
                await temp_connection.connect(websocket)
                await temp_connection.text_to_speech(text)
            else:
                # Use the existing connection
                connection.frontend_ws = websocket
                await connection.text_to_speech(text)
                
    except Exception as e:
        print(f"Error in TTS endpoint: {e}")
    finally:
        await websocket.close()


@app.websocket("/stt")
async def speech_to_text_endpoint(websocket: WebSocket):
    """Endpoint for speech-to-text conversion."""
    await websocket.accept()
    print("debug> STT connection accepted")
    
    try:
        while True:
            await websocket.send_json({"status": "ready"})
            audio_data = await websocket.receive_bytes()
            
            # Create a temporary connection if no global connection exists
            if not connection.is_connected:
                temp_connection = Connection(api_key="sk_car_Iuues1LsztkZl7bfCjghR")
                transcript = await temp_connection.speech_to_text(audio_data)
            else:
                # Use the existing connection
                transcript = await connection.speech_to_text(audio_data)
                
            await websocket.send_json({"transcript": transcript})
                
    except Exception as e:
        print(f"Error in STT endpoint: {e}")
    finally:
        await websocket.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)