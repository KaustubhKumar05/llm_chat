import { create } from "zustand";

const useCustomStore = create((set) => {
  // prev state can be accessed in the setters now
  const createSetter = (key) => (value) =>
    set((state) => ({
      [key]: typeof value === "function" ? value(state[key]) : value,
    }));

  return {
    sessions: [],
    sessionTranscriptsMap: new Map(),
    transcripts: [],
    isLoading: true,
    isThinking: false,
    liveSession: null,
    viewingSession: null,
    extendSessionTranscriptsMap: (obj) =>
      set((state) => ({
        sessionTranscriptsMap: state.sessionTranscriptsMap.set(obj["id"], obj["transcripts"]),
      })),
    setIsLoading: (val) => set({ isLoading: val }),
    setIsThinking: (val) => set({ isThinking: val }),
    setSessions: createSetter("sessions"),
    setTranscripts: createSetter("transcripts"),
    setLiveSession: createSetter("liveSession"),
    setViewingSession: createSetter("viewingSession"),
  };
});

export default useCustomStore;
