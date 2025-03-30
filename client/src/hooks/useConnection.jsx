import { useCallback, useEffect, useRef, useState } from "react";
import { WS_ENDPOINT } from "../constants";
import useCustomStore from "../store";

export const useConnection = () => {
  const { setTranscripts, setSessions, setLiveSession, setViewingSession } =
    useCustomStore();

  const wsRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isStreamingResponse, setIsStreamingResponse] = useState(false);

  const audioContextRef = useRef(null);
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const continueRecordingRef = useRef(true);
  const mediaRecorderRef = useRef(null);

  // This is sent to the BE with each request for identification
  const uuidRef = useRef(null);

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

    source.onended = () => {
      playNextInQueue();
    };
  };

  useEffect(() => {
    audioContextRef.current = new (window.AudioContext ||
      window.webkitAudioContext)();
    let socket;
    if (!wsRef.current) {
      socket = new WebSocket(WS_ENDPOINT);

      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      socket.onclose = (event) => {
        console.log("WebSocket closed:", event.code, event.reason);
      };

      socket.onopen = () => {
        console.log("WebSocket connection established");
        wsRef.current = socket;
      };

      socket.onmessage = async (event) => {
        if (event.data instanceof Blob) {
          // Handle PCM audio data
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
          console.log("debug> Receiving server message:", event.data);
          try {
            const message = JSON.parse(event.data);
            switch (message.type) {
              case "sessions":
                setSessions(message.sessions);
                break;
              case "tts_start":
                setIsStreamingResponse(true);
                break;
              case "tts_stopped":
              case "tts_complete":
                setIsStreamingResponse(false);
                break;
              case "transcripts":
                setTranscripts(message.transcripts);
                break;
              case "uuid":
                uuidRef.current = message.uuid || "";
                setViewingSession(message.uuid);
                setLiveSession(message.uuid);
                break;
              case "transcript_item":
                setTranscripts((prev) => [
                  ...prev,
                  {
                    query: message.transcript_item.query,
                    response: message.transcript_item.response,
                  },
                ]);
                break;
              default:
                console.log("Unhandled message type:", message.type);
            }
            console.log({ message });
          } catch (e) {
            console.log("Non-JSON message:", e);
          }
        }
      };
    }

    return () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
      wsRef.current = null;
      // Close audio context on cleanup
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const sendWsMessage = useCallback((type, data = {}) => {
    const attemptSend = () => {
      if (wsRef.current && wsRef.current.readyState === 1) {
        wsRef.current.send(
          JSON.stringify({ type, ...data, uuid: uuidRef.current })
        );
        return;
      }

      setTimeout(() => attemptSend(), 10);
    };

    attemptSend();
  }, []);

  const getSessions = () => sendWsMessage("get_sessions");
  const getTranscripts = (id) => sendWsMessage("get_transcripts", { id });
  const deleteSession = (id) => sendWsMessage("delete_session", { id });

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = async (event) => {
        if (
          event.data.size > 0 &&
          wsRef.current.readyState === WebSocket.OPEN
        ) {
          // Convert blob to base64
          const buffer = await event.data.arrayBuffer();
          const base64Data = btoa(
            String.fromCharCode(...new Uint8Array(buffer))
          );
          // Needed to prevent a race condition where the final message is sent before the final audio chunk
          if (!continueRecordingRef.current) {
            return;
          }

          wsRef.current.send(
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

      continueRecordingRef.current = false;

      wsRef.current.send(
        JSON.stringify({
          type: "audio",
          final: true,
          uuid: uuidRef.current,
        })
      );
      // Ideally this should happen after the model responds
      setTimeout(() => {
        continueRecordingRef.current = true;
      }, 2000);
    }
  };

  const stopStreamingResponse = () => sendWsMessage("kill_streaming");

  return {
    ws: wsRef.current,
    sendWsMessage,
    startRecording,
    deleteSession,
    stopRecording,
    getSessions,
    getTranscripts,
    stopStreamingResponse,
    isStreamingResponse,
    isRecording,
  };
};
