import { useEffect } from "react";
import { useConnection } from "../hooks/useConnection";
import useCustomStore from "../store";
import { MessageCirclePlus } from "lucide-react";

export const Sidebar = () => {
  const {
    sessions,
    setViewingSession,
    liveSession,
    viewingSession,
    deletedSessions,
  } = useCustomStore();
  const { getSessions, getTranscripts, startNewSession } = useConnection();

  useEffect(() => {
    getSessions();
  }, [liveSession]);

  return (
    <div className="bg-white/80 w-80 p-4 shrink-0 border-r">
      <div className="flex w-full items-center justify-between">
        <h1 className="text-2xl font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          Chats
        </h1>
        <button
          title="New chat"
          className="bg-blue-600 text-white p-2 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => startNewSession()}
          disabled={!liveSession}
        >
          <MessageCirclePlus size={18} />
        </button>
      </div>
      <div className="border-t pt-1 mt-2">
        {[liveSession, ...sessions].map(
          (session) =>
            !deletedSessions.has(session) && (
              <div
                className={`truncate my-2 p-2 rounded-2xl flex items-center hover:bg-blue-100/50 text-xs font-medium cursor-pointer ${
                  viewingSession === session
                    ? "text-blue-800 bg-blue-100"
                    : "text-black"
                }`}
                onClick={() => {
                  setViewingSession(session);
                  getTranscripts(session);
                }}
                key={session}
              >
                {session}
                {session === liveSession ? (
                  <div className="h-1 w-1 bg-blue-950 rounded-full ml-2" />
                ) : (
                  ""
                )}
              </div>
            )
        )}
      </div>
    </div>
  );
};
