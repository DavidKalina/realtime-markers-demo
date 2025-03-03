// hooks/useJobStreamEnhanced.ts
import { useEffect, useRef, useState } from "react";
import EventSource from "react-native-sse";

// Extend EventSource type to support custom events
type ExtendedEventSource = EventSource & {
  addEventListener(type: string, listener: (event: any) => void): void;
};

// Define types for your job updates
interface JobUpdate {
  id: string;
  status: "pending" | "processing" | "completed" | "failed" | "not_found";
  progress?: string;
  confidence?: number;
  result?: any;
  error?: string;
  updated?: string;
  title?: string;
  categories?: string[];
  similarityScore?: number;
}

export const useJobStreamEnhanced = (jobId: string | null) => {
  // Basic job state
  const [jobState, setJobState] = useState<JobUpdate | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // isComplete is only set after the UI has animated through all steps.
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const [lastReceivedMessage, setLastReceivedMessage] = useState<string | null>(null);

  // Define your static progress labels
  const [progressSteps, setProgressSteps] = useState<string[]>([
    "Initializing job...",
    "Analyzing image...",
    "Analyzing image with Vision API...",
    "Image analyzed successfully",
    "Generating text embeddings...",
    "Extracting event details and categories...",
    "Finding similar events...",
    "Processing complete!",
    "Creating event...",
  ]);

  // Track the sequence of step indices (each index corresponds to an entry in progressSteps)
  const [seenStepSequence, setSeenStepSequence] = useState<number[]>([]);
  // Index of the step currently shown in the UI
  const [displayIndex, setDisplayIndex] = useState<number>(0);
  // Flag indicating the backend has marked the job as finished
  const [jobFinished, setJobFinished] = useState<boolean>(false);

  // Reference to the EventSource instance
  const eventSourceRef = useRef<ExtendedEventSource | null>(null);
  // Cache of all received updates for debugging
  const [allUpdates, setAllUpdates] = useState<string[]>([]);

  // Timer and timestamp for controlling UI progression
  const lastStepChangeRef = useRef<number>(Date.now());
  const MIN_STEP_DISPLAY_TIME = 1000; // milliseconds
  const timerRef = useRef<number | null>(null);

  // This effect animates the UI progress (displayIndex) to slowly catch up with received steps.
  useEffect(() => {
    if (seenStepSequence.length > 0 && displayIndex < seenStepSequence.length - 1) {
      const timeSinceLastChange = Date.now() - lastStepChangeRef.current;
      if (timeSinceLastChange >= MIN_STEP_DISPLAY_TIME) {
        setDisplayIndex((prev) => prev + 1);
        lastStepChangeRef.current = Date.now();
      } else {
        if (timerRef.current) clearTimeout(timerRef.current);
        const remainingTime = MIN_STEP_DISPLAY_TIME - timeSinceLastChange;
        timerRef.current = setTimeout(() => {
          setDisplayIndex((prev) => prev + 1);
          lastStepChangeRef.current = Date.now();
        }, remainingTime) as unknown as number;
      }
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [seenStepSequence, displayIndex]);

  // Once the backend is finished (jobFinished) and we've animated through all steps,
  // mark the hook as complete.
  useEffect(() => {
    if (
      jobFinished &&
      seenStepSequence.length > 0 &&
      displayIndex === seenStepSequence[seenStepSequence.length - 1]
    ) {
      setIsComplete(true);
    }
  }, [jobFinished, seenStepSequence, displayIndex]);

  // Current progress step to display (fallback to 0 if no steps received)
  const currentStep =
    seenStepSequence.length > 0 && displayIndex < seenStepSequence.length
      ? seenStepSequence[displayIndex]
      : 0;

  // Helper: Maps a progress string to a numeric step index
  const getStepIndex = (progress?: string): number => {
    if (!progress) return 0;
    const progressLower = progress.toLowerCase().trim();
    const progressMap: Record<string, number> = {
      "initializing job...": 0,
      "analyzing image...": 1,
      "analyzing image with vision api...": 2,
      "image analyzed successfully": 3,
      "generating text embeddings...": 4,
      "extracting event details and categories...": 5,
      "finding similar events...": 6,
      "processing complete!": 7,
      "creating event...": 8,
    };
    if (progressMap[progressLower] !== undefined) return progressMap[progressLower];
    // Fallback matching:
    if (progressLower.includes("initializing")) return 0;
    if (progressLower.includes("analyzing image with vision")) return 2;
    if (progressLower.includes("analyzing image")) return 1;
    if (progressLower.includes("image analyzed")) return 3;
    if (progressLower.includes("generating text embeddings")) return 4;
    if (progressLower.includes("extracting event details")) return 5;
    if (progressLower.includes("finding similar")) return 6;
    if (progressLower.includes("processing complete")) return 7;
    if (progressLower.includes("creating event")) return 8;
    return 0;
  };

  // Helper: Add a step index to the sequence if not already present.
  // This function also fills in any missing intermediate steps.
  const addStepToSequence = (stepIndex: number) => {
    setSeenStepSequence((prev) => {
      if (prev.includes(stepIndex)) return prev;
      const lastStep = prev.length > 0 ? prev[prev.length - 1] : -1;
      const newSteps: number[] = [];
      for (let i = lastStep + 1; i <= stepIndex; i++) {
        newSteps.push(i);
      }
      return [...prev, ...newSteps];
    });
  };

  // Helper: Update the progressSteps labels with metadata (e.g. confidence, title)
  const updateStepWithMetadata = (stepIndex: number, data: JobUpdate) => {
    setProgressSteps((prev) => {
      const updated = [...prev];
      if (data.confidence !== undefined) {
        if (stepIndex === 3) {
          updated[3] = `Image analyzed successfully (${(data.confidence * 100).toFixed(
            0
          )}% confidence)`;
        } else if (stepIndex === 7) {
          updated[7] = `Processing complete! (${(data.confidence * 100).toFixed(0)}% confidence)`;
        }
      }
      if (data.title && stepIndex === 5) {
        updated[5] = `Event details extracted: "${data.title}"`;
      }
      if (data.similarityScore !== undefined && stepIndex === 6) {
        const similarityPercent = (data.similarityScore * 100).toFixed(0);
        updated[6] = `Similar events found (${similarityPercent}% match)`;
      }
      return updated;
    });
  };

  // Core job stream logic
  useEffect(() => {
    let unmounted = false;
    if (!jobId) return;

    // Reset state for the new job
    setSeenStepSequence([]);
    setDisplayIndex(0);
    setAllUpdates([]);
    lastStepChangeRef.current = Date.now();
    setJobFinished(false);
    setIsComplete(false);

    const connectToStream = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      try {
        const url = `${process.env.EXPO_PUBLIC_API_URL!}/api/jobs/${jobId}/stream`;
        const es = new EventSource(url);
        eventSourceRef.current = es as ExtendedEventSource;

        // On connection open, only add the initial step if not already set.
        es.addEventListener("open", () => {
          if (unmounted) return;
          setIsConnected(true);
          setError(null);
          setSeenStepSequence((prev) => (prev.length === 0 ? [0] : prev));
        });

        // Handle incoming messages
        es.addEventListener("message", (event) => {
          if (unmounted) return;
          try {
            setLastReceivedMessage(event.data);
            const data: JobUpdate = JSON.parse(event.data || "");
            setJobState(data);
            const updateInfo = `${data.status}${data.progress ? ": " + data.progress : ""}`;
            setAllUpdates((prev) => [...prev, updateInfo]);

            if (data.status === "pending") {
              addStepToSequence(0);
            } else if (data.status === "processing" && data.progress) {
              const stepIndex = getStepIndex(data.progress);
              addStepToSequence(stepIndex);
              updateStepWithMetadata(stepIndex, data);
            } else if (data.status === "completed") {
              // Determine final step based on result data.
              let finalStep = 7; // default for "Processing complete!"
              if (data.result?.eventId) {
                finalStep = 8; // "Creating event..."
                setProgressSteps((prev) => {
                  const updated = [...prev];
                  updated[8] = `Event created successfully!`;
                  return updated;
                });
              } else if (data.result?.message) {
                setProgressSteps((prev) => {
                  const updated = [...prev];
                  updated[7] = data.result.message;
                  return updated;
                });
              }
              addStepToSequence(finalStep);
              updateStepWithMetadata(finalStep, data);
              // Instead of marking complete immediately, signal that the backend is finished.
              setJobFinished(true);
            } else if (data.status === "failed") {
              setError(data.error || "Unknown error");
              setIsComplete(true);
              es.close();
            } else if (data.status === "not_found") {
              setError("Job not found");
              setIsComplete(true);
              es.close();
            }
          } catch (parseError) {
            console.error("Error parsing SSE message:", parseError, event.data);
          }
        });

        // Handle errors and auto-reconnect
        es.addEventListener("error", (event) => {
          if (unmounted) return;
          console.error("SSE connection error:", event);
          setIsConnected(false);
          setError("Connection error");
          es.close();
          setTimeout(() => {
            if (!unmounted) {
              connectToStream();
            }
          }, 3000);
        });

        // Handle heartbeat events
        eventSourceRef.current.addEventListener("heartbeat", () => {
          console.log("[JobStream] Received heartbeat");
        });
      } catch (error) {
        console.error("Failed to create EventSource:", error);
        setError("Failed to connect to job stream");
      }
    };

    connectToStream();
    return () => {
      unmounted = true;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [jobId]);

  const resetStream = () => {
    setJobState(null);
    setIsConnected(false);
    setError(null);
    setJobFinished(false);
    setIsComplete(false);
    setLastReceivedMessage(null);
    setSeenStepSequence([]);
    setDisplayIndex(0);
    setAllUpdates([]);
    setProgressSteps([
      "Initializing job...",
      "Analyzing image...",
      "Analyzing image with Vision API...",
      "Image analyzed successfully",
      "Generating text embeddings...",
      "Extracting event details and categories...",
      "Finding similar events...",
      "Processing complete!",
      "Creating event...",
    ]);
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    lastStepChangeRef.current = Date.now();
  };

  return {
    jobState,
    progressSteps,
    currentStep,
    isConnected,
    error,
    isComplete,
    resetStream,
    result: jobState?.result,
    lastReceivedMessage,
    debugInfo: {
      allUpdates,
      seenStepSequence,
      displayIndex,
    },
  };
};
