export const Loader = ({ content = "Loading..." }) => (
  <div className="bg-blue-500/50 w-full rounded-3xl px-4 py-2 text-black flex justify-center animate-pulse">
    {content}
  </div>
);
