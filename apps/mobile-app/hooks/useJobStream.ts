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

  // Use ref to track EventSource instance with extended type
  const eventSourceRef = useRef<ExtendedEventSource | null>(null);

  useEffect(() => {
    let unmounted = false;

    // Don't do anything if there's no jobId
    if (!jobId) return;

    const connectToStream = () => {
      // Close existing connection if any
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      try {
        // Create a new EventSource connection
        // Adjust your API URL as needed
        const url = `https://your-api-domain.com/api/jobs/${jobId}/stream`;

        const es = new EventSource(url, {
          headers: {
            // Add any needed auth headers here
            Authorization: "Bearer your-token-here",
          },
        });

        // Cast to our extended type that supports custom events
        eventSourceRef.current = es as ExtendedEventSource;

        // Handle connection open
        es.addEventListener("open", () => {
          if (unmounted) return;
          console.log("SSE connection established");
          setIsConnected(true);
          setError(null);
        });

        // Handle messages
        es.addEventListener("message", (event) => {
          if (unmounted) return;

          try {
            const data: JobUpdate = JSON.parse(event.data ?? "");
            setJobState(data);

            // Update progress based on job status
            switch (data.status) {
              case "pending":
                setCurrentStep(0);
                break;
              case "processing":
                // Update progress steps if the server sent any
                if (data.progress) {
                  // Determine the current step based on the progress message
                  if (data.progress.includes("Image analyzed")) {
                    setCurrentStep(2);
                  } else {
                    setCurrentStep(1);
                  }
                }

                // If we have confidence data, show that in our UI
                if (data.confidence) {
                  // Update the current step text to include confidence
                  const updatedSteps = [...progressSteps];
                  updatedSteps[2] = `Analysis complete (${(data.confidence * 100).toFixed(
                    0
                  )}% confidence)`;
                  setProgressSteps(updatedSteps);
                }
                break;
              case "completed":
                setCurrentStep(3);
                setIsComplete(true);
                es.close();
                break;
              case "failed":
                setError(data.error || "Unknown error");
                setIsComplete(true);
                es.close();
                break;
              case "not_found":
                setError("Job not found");
                setIsComplete(true);
                es.close();
                break;
            }
          } catch (error) {
            console.error("Error parsing SSE message:", error);
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

        // Handle custom heartbeat events - now properly typed
        eventSourceRef.current.addEventListener("heartbeat", () => {
          console.log("Received heartbeat");
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
    setJobState(null);
    setCurrentStep(0);
    setIsConnected(false);
    setError(null);
    setIsComplete(false);

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
  };
};
