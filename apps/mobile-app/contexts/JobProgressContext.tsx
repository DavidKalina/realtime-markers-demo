import React, { createContext, useContext } from "react";
import {
  useJobProgress,
  type UseJobProgressReturn,
} from "@/hooks/useJobProgress";

const JobProgressContext = createContext<UseJobProgressReturn | null>(null);

export function JobProgressProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const jobProgress = useJobProgress();
  return (
    <JobProgressContext.Provider value={jobProgress}>
      {children}
    </JobProgressContext.Provider>
  );
}

export function useJobProgressContext(): UseJobProgressReturn {
  const ctx = useContext(JobProgressContext);
  if (!ctx) {
    throw new Error(
      "useJobProgressContext must be used within a JobProgressProvider",
    );
  }
  return ctx;
}
