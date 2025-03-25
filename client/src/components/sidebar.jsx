import { useEffect } from "react";
import { useConnection } from "../hooks/useConnection";
import useCustomStore from "../store";

export const Sidebar = () => {
  const { sessions, setViewingSession, liveSession, viewingSession } = useCustomStore();
  const { getSessions, getTranscripts } = useConnection();

  useEffect(() => {
    getSessions();
  }, []);

  return (
    <div className="bg-blue-400 w-80 p-2">
      <p>Sessions</p>
      {[liveSession, ...sessions].map((session) => (
        <div
          className={`truncate my-3 text-xs font-medium text-white cursor-pointer ${
            viewingSession === session ? "text-green-950" : ""
          }`}
          onClick={() => {
            setViewingSession(session);
            getTranscripts(session);
          }}
          key={session}
        >
          {session}
        </div>
      ))}
    </div>
  );
};
