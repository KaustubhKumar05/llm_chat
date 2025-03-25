import useCustomStore from "../store";

export const Messages = () => {
  const { transcripts: chatMessages } = useCustomStore();
  return (
    <div
      style={{ height: "calc(100vh - 64px" }}
      className="max-w-2xl mx-auto w-full overflow-y-auto"
    >
      {chatMessages.map((message, index) => (
        <div key={index} className="p-2 rounded">
          <p className="text-sm text-white bg-blue-400 mb-2 w-max px-2 ml-auto py-1 rounded max-w-sm">
            {message.query}
          </p>

          <p className="text-sm text-white bg-blue-500 mb-2 w-max px-2 py-1 rounded max-w-sm">
            {message.response}
          </p>
        </div>
      ))}
    </div>
  );
};
