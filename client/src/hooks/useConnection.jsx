import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { WS_ENDPOINT } from "../constants";
import useCustomStore from "../store";

const ConnectionContext = createContext(null);

export const ConnectionProvider = ({ children }) => {
  const {
    setTranscripts,
    setSessions,
    setLiveSession,
    setViewingSession,
    setIsLoading,
    setIsThinking,
    sessionTranscriptsMap,
    extendSessionTranscriptsMap,
  } = useCustomStore();

  const wsRef = useRef(null);
  const wsEndpointCalled = useRef(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isStreamingResponse, setIsStreamingResponse] = useState(false);

  const audioContextRef = useRef(null);
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const continueRecordingRef = useRef(true);
  const mediaRecorderRef = useRef(null);
  const uuidRef = useRef(null);

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
    source.onended = () => playNextInQueue();
  };

  useEffect(() => {
    audioContextRef.current = new (window.AudioContext ||
      window.webkitAudioContext)();
    let socket;

    if (!wsRef.current && !wsEndpointCalled.current) {
      wsEndpointCalled.current = true;
      socket = new WebSocket(WS_ENDPOINT);

      socket.onerror = (error) => console.error("WebSocket error:", error);
      socket.onclose = (event) =>
        console.log("WebSocket closed:", event.code, event.reason);

      socket.onopen = () => {
        if (wsRef.current) return;
        console.log("WebSocket connection established");
        wsRef.current = socket;
      };

      socket.onmessage = async (event) => {
        if (event.data instanceof Blob) {
          const audioData = await event.data.arrayBuffer();
          const audioContext = audioContextRef.current;
          const pcmData = new Int16Array(audioData);
          const floatData = new Float32Array(pcmData.length);
          for (let i = 0; i < pcmData.length; i++)
            floatData[i] = pcmData[i] / 32768.0;

          const audioBuffer = audioContext.createBuffer(
            1,
            floatData.length,
            44100
          );
          audioBuffer.getChannelData(0).set(floatData);

          audioQueueRef.current.push(audioBuffer);
          console.log(
            `debug> Added audio to queue. Queue length: ${audioQueueRef.current.length}`
          );

          if (!isPlayingRef.current) playNextInQueue();
        } else {
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
                setIsLoading(false);
                extendSessionTranscriptsMap({
                  id: message.session_id,
                  transcripts: message.transcripts,
                });
                break;
              case "uuid":
                setTranscripts([]);
                uuidRef.current = message.uuid || "";
                setViewingSession(message.uuid);
                setLiveSession(message.uuid);
                setIsLoading(false);
                break;
              case "transcript_item":
                setIsThinking(false);
                setTranscripts((prev) => {
                  if (message.response) {
                    const lastItem = prev[prev.length - 1];
                    lastItem["response"] = message.response;
                    return [...prev.slice(0, prev.length - 1), lastItem];
                  }
                  return [
                    ...prev,
                    {
                      query: message.transcript_item.query,
                      response: message.transcript_item.response,
                    },
                  ];
                });
                break;
              default:
                console.log("Unhandled message type:", message.type);
            }
          } catch (e) {
            console.log("Non-JSON message:", e);
          }
        }
      };
    }

    return () => {
      if (socket.readyState === WebSocket.OPEN) socket.close();
      wsRef.current = null;
      uuidRef.current = null;
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  const sendWsMessage = useCallback((type, data = {}) => {
    const attemptSend = () => {
      if (wsRef.current && wsRef.current.readyState === 1) {
        console.log("debug> sending ws message", data, type);
        wsRef.current.send(
          JSON.stringify({ type, ...data, uuid: uuidRef.current })
        );
        return;
      }
      setTimeout(() => attemptSend(), 10);
    };
    attemptSend();
  }, []);

  const startNewSession = () => sendWsMessage("new_session");
  const getSessions = () => sendWsMessage("get_sessions");
  const setTTS = (value) => sendWsMessage("set_tts", { value });

  const getTranscripts = (id) => {
    setIsLoading(true);
    if (sessionTranscriptsMap.has(id)) {
      setTranscripts(sessionTranscriptsMap.get(id) || []);
      sendWsMessage("get_transcripts", { id });
      setIsLoading(false);
      return;
    }
    sendWsMessage("get_transcripts", { id });
  };

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
          const buffer = await event.data.arrayBuffer();
          const base64Data = btoa(
            String.fromCharCode(...new Uint8Array(buffer))
          );

          if (!continueRecordingRef.current) return;

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
        JSON.stringify({ type: "audio", final: true, uuid: uuidRef.current })
      );
      // Ideally this should happen after the model responds
      setTimeout(() => {
        continueRecordingRef.current = true;
      }, 2000);
    }
  };

  const stopStreamingResponse = () => sendWsMessage("kill_streaming");

  return (
    <ConnectionContext.Provider
      value={{
        sendWsMessage,
        startRecording,
        stopRecording,
        getSessions,
        getTranscripts,
        deleteSession,
        stopStreamingResponse,
        startNewSession,
        setTTS,
        isRecording,
        isStreamingResponse,
      }}
    >
      {children}
    </ConnectionContext.Provider>
  );
};

export const useConnection = () => {
  const context = useContext(ConnectionContext);
  if (!context)
    throw new Error("useConnection must be used within a ConnectionProvider");
  return context;
};
