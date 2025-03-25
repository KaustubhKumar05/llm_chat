import { create } from "zustand";

const useCustomStore = create((set) => {
  // prev state can be accessed in the setters now
  const createSetter = (key) => (value) => 
    set((state) => ({ [key]: typeof value === 'function' ? value(state[key]) : value }));

  return {
    sessions: [],
    transcripts: [],
    activeSession: null,
    setSessions: createSetter('sessions'),
    setTranscripts: createSetter('transcripts'),
    setActiveSession: createSetter('activeSession'),
  };
});

export default useCustomStore;
