import { useEffect, useRef } from "react";
import useCustomStore from "../store";
import { Loader } from "./loader";

export const Messages = () => {
  const {
    transcripts: chatMessages,
    isLoading,
    isThinking,
    liveSession,
    viewingSession,
  } = useCustomStore();
  const finalRef = useRef(null);

  useEffect(() => {
    if (viewingSession === liveSession)
      finalRef.current.scrollIntoView({ behaviour: "smooth" });
  }, [chatMessages, viewingSession, liveSession]);

  return (
    <div
      style={{
        height:
          liveSession === viewingSession
            ? "calc(100vh - 78px)"
            : "calc(100vh - 54px)",
      }}
      className="max-w-3xl mx-auto pt-4 w-full overflow-y-auto"
    >
      {isLoading ? (
        <Loader />
      ) : (
        <div className="pr-2 -mr-1">
          {chatMessages.map((message, index) => (
            <div key={index} className="p-2 rounded">
              <Message content={message.query} type="query" />
              {message.response && (
                <Message content={message.response} type="response" />
              )}
            </div>
          ))}
        </div>
      )}
      {isThinking ? <Loader content="Thinking..." /> : ""}
      <div ref={finalRef} />
    </div>
  );
};

const Message = ({ content, type }) => {
  const styling =
    type === "query"
      ? "text-white bg-blue-500 ml-auto max-w-sm rounded-tr-none"
      : "text-black bg-white rounded-tl-none leading-loose font-light max-w-lg";
  return (
    <p
      className={`text-sm mb-3 w-max px-4 py-2 rounded-xl backdrop-blur-sm shadow-lg ${styling}`}
    >
      {content}
    </p>
  );
};
