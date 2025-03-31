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
        className="mx-auto rounded-full bg-white shadow border text-red-600 p-2 relative top-2"
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
    <div className="w-full relative bg-white mx-auto flex items-center shadow">
      <div className="relative max-w-3xl py-4 mx-auto w-full">
        <input
          className="border rounded-3xl border-gray-300 pl-4 pr-24 py-3 w-full shadow-sm focus:shadow-md outline-none focus:border-black"
          ref={inputRef}
          autoFocus
          placeholder="Chat with your agent"
        />

        <button
          title="Hold to record audio"
          onMouseDown={() => {
            if (!isRecording) {
              startRecording();
            }
          }}
          onMouseUp={() => {
            if (isRecording) {
              stopRecording();
            }
          }}
          className={`${
            isRecording ? "bg-red-600" : "bg-gray-800"
          } text-white w-max p-2 rounded-full absolute right-12 bottom-6`}
        >
          {isRecording ? <MicIcon size={18} /> : <MicOffIcon size={18} />}
        </button>

        {!isStreamingResponse ? (
          <button
            title="Send"
            className="bg-gray-800 text-white w-max p-2 rounded-full absolute right-2 bottom-6"
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
        ) : (
          <button
            title="Stop audio"
            disabled={!isStreamingResponse}
            onClick={stopStreamingResponse}
            className="bg-red-600 text-white w-max p-2 rounded-full disabled:opacity-80 disabled:cursor-not-allowed right-2 absolute bottom-6"
          >
            <CircleStop size={18} />
          </button>
        )}
      </div>
    </div>
  );
};
