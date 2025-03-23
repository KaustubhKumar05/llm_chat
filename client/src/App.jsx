import { useRef, useEffect, useState } from "react";
import { WS_ENDPOINT } from "./constants";

function App() {
  const inputRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const [ws, setWs] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const uuidRef = useRef(null);

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
      } else if (JSON.parse(event.data)?.type === "uuid") {
        uuidRef.current = JSON.parse(event.data)?.uuid || "";
        return;
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

    source.start();

    // When this audio finishes, wait for the gap delay then play the next one
    source.onended = () => {
      playNextInQueue();
    };
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && ws?.readyState === WebSocket.OPEN) {
          // Convert blob to base64
          const buffer = await event.data.arrayBuffer();
          const base64Data = btoa(
            String.fromCharCode(...new Uint8Array(buffer))
          );

          ws.send(
            JSON.stringify({
              type: "audio",
              audio: `data:audio/mp3;base64,${base64Data}`,
              uuid: uuidRef.current,
            })
          );
        }
      };

      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream
        .getTracks()
        .forEach((track) => track.stop());
      setIsRecording(false);
      ws.send(
        JSON.stringify({
          type: "audio",
          final: true,
          audio: {},
          uuid: uuidRef.current,
        })
      );
    }
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
            ws.send(JSON.stringify({ type: "text", text: content }));
          }
        }}
      >
        Send
      </button>

      <button
        className={`${
          isRecording ? "bg-red-600" : "bg-gray-800"
        } text-white w-max px-2 py-1 rounded mx-auto`}
        onClick={() => {
          if (isRecording) {
            stopRecording();
          } else {
            startRecording();
          }
        }}
      >
        {isRecording ? "Stop Recording" : "Start Recording"}
      </button>
    </div>
  );
}

export default App;
