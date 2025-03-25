import { create } from "zustand";

const useCustomStore = create((set) => {
  // prev state can be accessed in the setters now
  const createSetter = (key) => (value) => 
    set((state) => ({ [key]: typeof value === 'function' ? value(state[key]) : value }));

  return {
    sessions: [],
    transcripts: [],
    liveSession: null,
    viewingSession: null,
    setSessions: createSetter('sessions'),
    setTranscripts: createSetter('transcripts'),
    setLiveSession: createSetter('liveSession'),
    setViewingSession: createSetter('viewingSession'),
  };
});

export default useCustomStore;
