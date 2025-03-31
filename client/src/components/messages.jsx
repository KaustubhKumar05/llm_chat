import useCustomStore from "../store";

export const Messages = () => {
  const { transcripts: chatMessages } = useCustomStore();
  return (
    <div
      style={{ height: "calc(100vh - 82px" }}
      className="max-w-2xl mx-auto pt-4 w-full overflow-y-auto"
    >
      {chatMessages.map((message, index) => (
        <div key={index} className="p-2 rounded">
          <Message content={message.query} type="query" />
          <Message content={message.response} type="response" />
        </div>
      ))}
    </div>
  );
};

const Message = ({ content, type }) => {
  const styling =
    type === "query" ? "text-white bg-blue-500 ml-auto rounded-tr-none" : "text-black bg-white rounded-tl-none";
  return (
    <p className={`text-sm mb-3 w-max px-4 py-2 rounded-xl max-w-sm backdrop-blur-sm shadow-lg ${styling}`}>
      {content}
    </p>
  );
};
