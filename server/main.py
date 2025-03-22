from fastapi import FastAPI, WebSocket
from cartesia import Cartesia
import os

app = FastAPI()

client = Cartesia(
    api_key=os.getenv("CARTESIA_API_KEY"),
)
voice_id = "a0e99841-438c-4a64-b679-ae501e7d6091"
model_id = "sonic-2"

@app.websocket("/tts")
async def text_to_speech_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    try:
        while True:
            ws = client.tts.websocket()
            text = await websocket.receive_text()
            
            # Stream audio chunks
            for output in ws.send(
                model_id=model_id,
                transcript=text,
                voice={"id": voice_id},
                stream=True,
                output_format={
                    "container": "raw",
                    "encoding": "pcm_f32le", 
                    "sample_rate": 22050
                },
            ):
                await websocket.send_bytes(output.audio)
                
            ws.close()
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await websocket.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)