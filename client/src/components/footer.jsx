import { useRef } from "react";
import { useConnection } from "../hooks/useConnection";
import { MicIcon, MicOffIcon, Send } from "lucide-react";

export const Footer = () => {
  const inputRef = useRef(null);
  const { ws, startRecording, stopRecording, isRecording } = useConnection();

  return (
    <div className="fixed bottom-0 w-full max-w-2xl px-4 pb-1.5 left-1/2 -translate-x-1/2 flex items-center gap-2">
      <textarea
        className="border resize-none border-gray-500 rounded px-2 py-1 flex-1 left-0"
        ref={inputRef}
        placeholder="Chat with your agent"
      />

      <button
        className="bg-gray-800 text-white w-max p-2 rounded-full"
        onClick={() => {
          const content = inputRef.current.value.trim();
          if (content && ws && ws.readyState === 1) {
            ws.send(JSON.stringify({ type: "text", text: content }));
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
    </div>
  );
};
