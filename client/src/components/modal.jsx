import { X } from "lucide-react";

export const Modal = ({ content, show, setShow, title }) => {
  if (!show) {
    return null;
  }
  return (
    <div className="fixed z-50 inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 relative max-w-2xl w-full mx-4">
        <div className="flex w-full items-center justify-between mb-2">
          <h2 className="font-bold text-xl">{title}</h2>
          <button
            onClick={() => setShow(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>
        {content}
      </div>
    </div>
  );
};
