from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from connection import Connection

app = FastAPI()

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