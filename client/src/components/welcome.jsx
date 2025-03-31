import useCustomStore from "../store";

export const Welcome = () => {
  const { liveSession, viewingSession, transcripts, isLoading, isThinking } =
    useCustomStore();

  const showWelcomeMessage =
    !isLoading &&
    !isThinking &&
    liveSession === viewingSession &&
    transcripts.length === 0;

  if (!showWelcomeMessage) return <></>;

  return (
    <div className="flex flex-col w-full h-full items-center justify-end">
      <div className="bg-gray-100/80 px-4 py-3 rounded-xl border shadow">
        <h2 className="font-bold text-2xl text-center">Get started</h2>
        <p className="mt-2 text-center font-medium">
          <span className="text-blue-800">Push to talk </span>or use the{" "}
          <span className="text-blue-800">chat interface</span>
        </p>
        <p className="mt-1 text-center font-medium">
          to interact with the agent.
        </p>
      </div>
    </div>
  );
};
