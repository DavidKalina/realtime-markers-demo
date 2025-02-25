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
        const url = `https://f49e-69-162-231-94.ngrok-free.app/api/jobs/${jobId}/stream`;

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
            console.log("Received job update:", data);
            setJobState(data);

            // Update progress based on job status and progress message
            if (data.status === "pending") {
              setCurrentStep(0);
            } else if (data.status === "processing") {
              // More granular mapping of progress messages to steps
              if (data.progress) {
                if (data.progress.includes("Image analyzed")) {
                  setCurrentStep(2);

                  // Update the progress step text with confidence if available
                  if (data.confidence !== undefined) {
                    const updatedSteps = [...progressSteps];
                    updatedSteps[2] = `Analysis complete (${(data.confidence * 100).toFixed(
                      0
                    )}% confidence)`;
                    setProgressSteps(updatedSteps);
                  }
                } else if (data.progress.includes("creating event")) {
                  setCurrentStep(3);
                } else {
                  // Default to the image analysis step for any other processing message
                  setCurrentStep(1);
                }
              } else {
                // If no specific progress message, move to step 1
                setCurrentStep(1);
              }
            } else if (data.status === "completed") {
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

              es.close();
            } else if (data.status === "failed") {
              setError(data.error || "Unknown error");
              setIsComplete(true);
              es.close();
            } else if (data.status === "not_found") {
              setError("Job not found");
              setIsComplete(true);
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
  };
};
