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
    deletedSessions: new Set(),
    liveSession: null,
    viewingSession: null,
    setSessions: createSetter("sessions"),
    setTranscripts: createSetter("transcripts"),
    setLiveSession: createSetter("liveSession"),
    addDeletedSession: (id) =>
      set((state) => ({ deletedSessions: state.deletedSessions.add(id) })),
    setViewingSession: createSetter("viewingSession"),
  };
});

export default useCustomStore;
