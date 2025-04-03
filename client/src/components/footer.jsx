import { useRef } from "react";
import { useConnection } from "../hooks/useConnection";
import {
  Trash,
  MicIcon,
  MicOffIcon,
  Send,
  CircleStop,
  Volume2,
  VolumeX,
} from "lucide-react";
import useCustomStore from "../store";

export const Footer = () => {
  const inputRef = useRef(null);
  const {
    viewingSession,
    liveSession,
    setViewingSession,
    setTranscripts,
    setSessions,
    setIsThinking,
  } = useCustomStore();

  const {
    sendWsMessage,
    startRecording,
    stopRecording,
    isRecording,
    deleteSession,
    isStreamingResponse,
    stopStreamingResponse,
    getTranscripts,
    // setTTS,
  } = useConnection();

  const sendMessage = () => {
    const content = inputRef.current.value.trim();
    if (content) {
      sendWsMessage("text", { text: content });
      inputRef.current.value = "";
      setTranscripts((prev) => [...prev, { query: content }]);
      setIsThinking(true);
    }
  };

  if (viewingSession !== liveSession) {
    return (
      <button
        className="mx-auto rounded-full bg-white shadow border text-red-600 p-2 relative bottom-2"
        onClick={() => {
          setSessions((prev) => prev.filter((id) => id !== viewingSession));
          setTranscripts([]);
          deleteSession(viewingSession);
          setViewingSession(liveSession);
          getTranscripts(liveSession);
        }}
      >
        <Trash />
      </button>
    );
  }

  return (
    <div className="w-full relative bg-white mx-auto flex items-center shadow">
      <div
        title="Audio response"
        className="relative max-w-3xl py-4 mx-auto w-full"
      >
        <button
          style={{ top: "22px" }}
          className="bg-gray-800 text-white w-max p-2 rounded-full absolute left-2"
        >
          <Volume2 size={18} />
        </button>
        <input
          className="border rounded-3xl text-sm border-gray-300 pl-12 pr-24 py-3 w-full shadow-sm focus:shadow-md outline-none focus:border-black"
          ref={inputRef}
          autoFocus
          onKeyDown={(e) => {
            if (["Enter", "Return"].includes(e.key)) {
              sendMessage();
            }
          }}
          placeholder="How can I help you?"
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
              setIsThinking(true);
            }
          }}
          style={{ bottom: "22px" }}
          className={`${
            isRecording ? "bg-red-600" : "bg-gray-800"
          } text-white w-max p-2 rounded-full absolute right-12`}
        >
          {isRecording ? <MicIcon size={18} /> : <MicOffIcon size={18} />}
        </button>

        {!isStreamingResponse ? (
          <button
            title="Send"
            className="bg-gray-800 text-white w-max p-2 rounded-full absolute right-2"
            onClick={() => sendMessage()}
            style={{ bottom: "22px" }}
          >
            <Send size={18} />
          </button>
        ) : (
          <button
            title="Stop audio"
            disabled={!isStreamingResponse}
            onClick={stopStreamingResponse}
            style={{ bottom: "22px" }}
            className="bg-red-600 text-white w-max p-2 rounded-full disabled:opacity-80 disabled:cursor-not-allowed right-2 absolute"
          >
            <CircleStop size={18} />
          </button>
        )}
      </div>
    </div>
  );
};
