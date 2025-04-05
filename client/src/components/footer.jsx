import { useRef, useState } from "react";
import { useConnection } from "../hooks/useConnection";
import {
  Trash,
  MicIcon,
  MicOffIcon,
  // Send,
  // CircleStop,
  // Volume2,
  // VolumeX,
  Info,
} from "lucide-react";
import useCustomStore from "../store";
import { Modal } from "./modal";

export const Footer = () => {
  const inputRef = useRef(null);
  const [showContextModal, setShowContextModal] = useState(false);

  const {
    viewingSession,
    liveSession,
    setViewingSession,
    setTranscripts,
    setSessions,
    setIsThinking,
    context,
  } = useCustomStore();

  const {
    sendWsMessage,
    startRecording,
    stopRecording,
    isRecording,
    deleteSession,
    isStreamingResponse,
    // stopStreamingResponse,
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
      <Modal
        title="Conversation Context"
        show={showContextModal}
        setShow={setShowContextModal}
        content={<p>{context}</p>}
      />
      <div className="relative max-w-3xl py-4 mx-auto w-full">
        {/* <button
          title="Audio response"
          style={{ top: "22px" }}
          className="bg-gray-800 text-white w-max p-2 rounded-full absolute left-2"
        >
        TTS Toggle button
          <Volume2 size={18} />
        </button> */}
        <button
          title="Context"
          disabled={!context}
          onClick={() => setShowContextModal(true)}
          style={{ top: "22px" }}
          className="bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 text-white w-max p-2 rounded-full absolute left-2"
        >
          <Info size={18} className="cursor-pointer" />
        </button>
        <input
          disabled={isStreamingResponse}
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
          } text-white w-max p-2 rounded-full absolute right-2`}
        >
          {isRecording ? (
            <MicIcon size={18} className="cursor-pointer" />
          ) : (
            <MicOffIcon size={18} className="cursor-pointer" />
          )}
        </button>

        {/* {isStreamingResponse && (
          <button
            title="Stop audio"
            disabled={!isStreamingResponse}
            onClick={stopStreamingResponse}
            style={{ bottom: "22px" }}
            className="bg-red-600 text-white w-max cursor-pointer p-2 rounded-full disabled:opacity-80 disabled:cursor-not-allowed right-12 absolute"
          >
            <CircleStop size={18} />
          </button>
        )} */}
      </div>
    </div>
  );
};
