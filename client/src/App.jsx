import { useRef, useEffect, useState } from "react";
import { WS_ENDPOINT } from "./constants";

function App() {
  const inputRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const [ws, setWs] = useState(null);

  useEffect(() => {
    // Create audio context once
    audioContextRef.current = new (window.AudioContext ||
      window.webkitAudioContext)();

    console.log("debug> Creating ws connection");
    const socket = new WebSocket(WS_ENDPOINT);

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    socket.onclose = (event) => {
      console.log("WebSocket closed:", event.code, event.reason);
    };

    socket.onopen = () => {
      console.log("WebSocket connection established");
      setWs(socket);
    };

    socket.onmessage = async (event) => {
      if (event.data instanceof Blob) {
        // Handle PCM audio data
        console.log("debug> Receiving audio data");
        const audioData = await event.data.arrayBuffer();

        // Convert PCM data to audio buffer
        const audioContext = audioContextRef.current;
        const pcmData = new Int16Array(audioData);
        const floatData = new Float32Array(pcmData.length);

        // Convert from 16-bit integer to float in range [-1, 1]
        for (let i = 0; i < pcmData.length; i++) {
          floatData[i] = pcmData[i] / 32768.0;
        }

        // Create an audio buffer (44.1kHz mono)
        const audioBuffer = audioContext.createBuffer(
          1,
          floatData.length,
          44100
        );

        // Fill the buffer
        audioBuffer.getChannelData(0).set(floatData);

        // Add to queue and play if not already playing
        audioQueueRef.current.push(audioBuffer);
        console.log(
          `debug> Added audio to queue. Queue length: ${audioQueueRef.current.length}`
        );

        if (!isPlayingRef.current) {
          playNextInQueue();
        }
      } else {
        // Handle text/JSON messages
        console.log("debug> Receiving server message:", event.data);
        try {
          const message = JSON.parse(event.data);
          console.log({ message });
        } catch (e) {
          console.log("Non-JSON message:", e);
        }
      }
    };

    return () => {
      console.log("debug> Closing ws");
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }

      // Close audio context on cleanup
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Function to play the next audio buffer in the queue
  const playNextInQueue = () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }

    isPlayingRef.current = true;
    const audioBuffer = audioQueueRef.current.shift();
    const audioContext = audioContextRef.current;

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);

    console.log("debug> Playing audio from queue");
    source.start();

    // When this audio finishes, wait for the gap delay then play the next one
    source.onended = () => {
      console.log(`debug> Audio playback ended`);
      playNextInQueue();
    };
  };

  return (
    <div className="flex flex-col max-w-sm mx-auto pt-10 gap-4">
      <input
        className="border border-gray-500 rounded px-2 py-1"
        ref={inputRef}
        placeholder="Enter text to synthesize"
      />

      <button
        className="bg-gray-800 text-white w-max px-2 py-1 mx-auto rounded"
        onClick={() => {
          const content = inputRef.current.value.trim();
          if (content && ws && ws.readyState === 1) {
            console.log("debug> Sending ws message");
            ws.send(JSON.stringify({type: "tts", text: content}));
          }
        }}
      >
        Send
      </button>
    </div>
  );
}

export default App;
