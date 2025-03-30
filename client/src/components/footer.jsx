import { useRef } from "react";
import { useConnection } from "../hooks/useConnection";
import { Trash, MicIcon, MicOffIcon, Send, CircleStop } from "lucide-react";
import useCustomStore from "../store";

export const Footer = () => {
  const inputRef = useRef(null);
  const { viewingSession, liveSession, setViewingSession } = useCustomStore();
  const {
    sendWsMessage,
    startRecording,
    stopRecording,
    isRecording,
    deleteSession,
    isStreamingResponse,
    stopStreamingResponse,
    getTranscripts,
    getSessions,
  } = useConnection();

  if (viewingSession !== liveSession) {
    return (
      <button
        className="mx-auto rounded-full bg-red-400 p-2"
        onClick={() => {
          deleteSession(viewingSession);
          setViewingSession(liveSession);
          getTranscripts(liveSession);
          getSessions();
        }}
      >
        <Trash />
      </button>
    );
  }

  return (
    <div className=" w-full max-w-2xl px-4 pb-1.5 mx-auto flex items-center gap-2">
      <textarea
        className="border resize-none border-gray-500 rounded px-2 py-1 flex-1 left-0"
        ref={inputRef}
        placeholder="Chat with your agent"
      />

      <button
        className="bg-gray-800 text-white w-max p-2 rounded-full"
        onClick={() => {
          const content = inputRef.current.value.trim();
          if (content) {
            sendWsMessage("text", { text: content });
            inputRef.current.value = "";
          }
        }}
      >
        <Send size={18} />
      </button>

      <button
        className={`${
          isRecording ? "bg-red-600" : "bg-gray-800"
        } text-white w-max p-2 rounded-full`}
        onClick={() => {
          if (isRecording) {
            stopRecording();
          } else {
            startRecording();
          }
        }}
      >
        {isRecording ? <MicIcon size={18} /> : <MicOffIcon size={18} />}
      </button>
      <button
        disabled={!isStreamingResponse}
        onClick={stopStreamingResponse}
        className="bg-red-600 text-white w-max p-2 rounded-full disabled:opacity-80 disabled:cursor-not-allowed"
      >
        <CircleStop />
      </button>
    </div>
  );
};
