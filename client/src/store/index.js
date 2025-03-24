import { create } from "zustand";

const useCustomStore = create((set) => ({
  sessions: [],
  setSessions: (sessionList) => set({ sessions: sessionList }),
  transcripts: [],
  setTranscripts: (transcriptList) => set({ transcripts: transcriptList }),
  activeSession: null,
  setActiveSession: (session) => set({ activeSession: session }),
}));

export default useCustomStore;
