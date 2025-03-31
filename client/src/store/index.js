import { create } from "zustand";

const useCustomStore = create((set) => {
  // prev state can be accessed in the setters now
  const createSetter = (key) => (value) =>
    set((state) => ({
      [key]: typeof value === "function" ? value(state[key]) : value,
    }));

  return {
    sessions: [],
    transcripts: [],
    isLoading: true,
    isThinking: false,
    deletedSessions: new Set(),
    liveSession: null,
    viewingSession: null,
    setIsLoading: (val) => set({ isLoading: val }),
    setIsThinking: (val) => set({ isThinking: val }),
    addDeletedSession: (id) =>
      set((state) => ({ deletedSessions: state.deletedSessions.add(id) })),
    setSessions: createSetter("sessions"),
    setTranscripts: createSetter("transcripts"),
    setLiveSession: createSetter("liveSession"),
    setViewingSession: createSetter("viewingSession"),
  };
});

export default useCustomStore;
