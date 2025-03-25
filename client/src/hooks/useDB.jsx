import { useEffect } from "react";
import useCustomStore from "../store";

export const useDB = () => {
  const { setSessions, setTranscripts } = useCustomStore();

  const getSessions = () => {};
  const getTranscripts = (id) => {};

  // connect to redis
  useEffect(() => {}, []);

  return { getSessions, getTranscripts };
};
