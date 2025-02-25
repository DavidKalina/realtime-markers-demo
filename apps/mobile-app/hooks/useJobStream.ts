// hooks/useJobStream.ts
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
}

// Custom hook for job streaming
export const useJobStream = (jobId: string | null) => {
  const [jobState, setJobState] = useState<JobUpdate | null>(null);
  const [progressSteps, setProgressSteps] = useState<string[]>([
    "Initializing job...",
    "Analyzing image...",
    "Processing data...",
    "Creating event...",
  ]);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const [lastReceivedMessage, setLastReceivedMessage] = useState<string | null>(null);

  // Use ref to track EventSource instance with extended type
  const eventSourceRef = useRef<ExtendedEventSource | null>(null);

  // Use ref to track which steps have been seen
  const seenStepsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let unmounted = false;

    // Don't do anything if there's no jobId
    if (!jobId) return;

    console.log(`[JobStream] Starting job stream for job ${jobId}`);

    // Reset the seen steps whenever we start with a new job
    seenStepsRef.current = new Set();

    const connectToStream = () => {
      // Close existing connection if any
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      try {
        // Create a new EventSource connection
        const url = `https://f49e-69-162-231-94.ngrok-free.app/api/jobs/${jobId}/stream`;
        console.log(`[JobStream] Connecting to SSE stream: ${url}`);

        const es = new EventSource(url);

        // Cast to our extended type that supports custom events
        eventSourceRef.current = es as ExtendedEventSource;

        // Handle connection open
        es.addEventListener("open", () => {
          if (unmounted) return;
          console.log("[JobStream] SSE connection established");
          setIsConnected(true);
          setError(null);
        });

        // Handle messages
        es.addEventListener("message", (event) => {
          if (unmounted) return;

          try {
            console.log(`[JobStream] Received message: ${event.data}`);
            setLastReceivedMessage(event.data);

            const data: JobUpdate = JSON.parse(event.data ?? "");
            setJobState(data);

            // Map progress string to step index
            const getStepIndex = (progress?: string): number => {
              if (!progress) return 0;

              if (progress.toLowerCase().includes("initializing")) return 0;
              if (progress.toLowerCase().includes("analyzing image")) return 1;
              if (
                progress.toLowerCase().includes("image analyzed") ||
                progress.toLowerCase().includes("processing")
              )
                return 2;
              if (progress.toLowerCase().includes("creating event")) return 3;

              return 0; // Default to first step if no match
            };

            // Update progress based on job status
            if (data.status === "pending") {
              setCurrentStep(0);
            } else if (data.status === "processing") {
              if (data.progress) {
                const stepIndex = getStepIndex(data.progress);
                console.log(`[JobStream] Mapped progress "${data.progress}" to step ${stepIndex}`);

                // Add to seen steps
                seenStepsRef.current.add(data.progress);

                // Only update current step if it's advancing forward
                if (stepIndex >= currentStep) {
                  setCurrentStep(stepIndex);
                }

                // Update the progress step text with confidence if available
                if (data.confidence !== undefined && stepIndex === 2) {
                  const updatedSteps = [...progressSteps];
                  updatedSteps[2] = `Processing data (${(data.confidence * 100).toFixed(
                    0
                  )}% confidence)`;
                  setProgressSteps(updatedSteps);
                }
              }
            } else if (data.status === "completed") {
              // Always go to last step on completion
              setCurrentStep(3);
              setIsComplete(true);

              // Update the last step text with result info if available
              if (data.result) {
                const updatedSteps = [...progressSteps];
                if (data.result.eventId) {
                  updatedSteps[3] = `Event created successfully!`;
                } else if (data.result.message) {
                  updatedSteps[3] = data.result.message;
                }
                setProgressSteps(updatedSteps);
              }

              console.log("[JobStream] Job completed, closing connection");
              es.close();
            } else if (data.status === "failed") {
              setError(data.error || "Unknown error");
              setIsComplete(true);
              console.log(`[JobStream] Job failed: ${data.error}`);
              es.close();
            } else if (data.status === "not_found") {
              setError("Job not found");
              setIsComplete(true);
              console.log("[JobStream] Job not found");
              es.close();
            }
          } catch (error) {
            console.error("Error parsing SSE message:", error, event.data);
          }
        });

        // Handle errors
        es.addEventListener("error", (event) => {
          if (unmounted) return;
          console.error("SSE connection error:", event);
          setIsConnected(false);
          setError("Connection error");

          // Auto-reconnect after delay
          es.close();
          setTimeout(() => {
            if (!unmounted) {
              connectToStream();
            }
          }, 3000);
        });

        // Handle custom heartbeat events
        eventSourceRef.current.addEventListener("heartbeat", () => {
          console.log("[JobStream] Received heartbeat");
        });
      } catch (error) {
        console.error("Failed to create EventSource:", error);
        setError("Failed to connect to job stream");
      }
    };

    // Start the connection
    connectToStream();

    // Clean up on unmount
    return () => {
      unmounted = true;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [jobId]);

  const resetStream = () => {
    console.log("[JobStream] Resetting job stream");
    seenStepsRef.current = new Set();
    setJobState(null);
    setCurrentStep(0);
    setIsConnected(false);
    setError(null);
    setIsComplete(false);
    setLastReceivedMessage(null);

    // Reset progress steps to original state
    setProgressSteps([
      "Initializing job...",
      "Analyzing image...",
      "Processing data...",
      "Creating event...",
    ]);

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
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
    seenSteps: Array.from(seenStepsRef.current),
  };
};
