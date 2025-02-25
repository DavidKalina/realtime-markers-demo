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

// Progressive display mode - simpler and more reliable approach
export const useJobStreamEnhanced = (jobId: string | null) => {
  // Basic job state
  const [jobState, setJobState] = useState<JobUpdate | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const [lastReceivedMessage, setLastReceivedMessage] = useState<string | null>(null);

  // Progress tracking
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

  // Track the SEQUENCE of steps we've seen
  const [seenStepSequence, setSeenStepSequence] = useState<number[]>([]);
  // Set the display index to track which step we're showing
  const [displayIndex, setDisplayIndex] = useState<number>(0);

  // Use ref to track EventSource instance
  const eventSourceRef = useRef<ExtendedEventSource | null>(null);

  // Cache of all received updates for debugging
  const [allUpdates, setAllUpdates] = useState<string[]>([]);

  // Track last seen timestamp to determine display timing
  const lastStepChangeRef = useRef<number>(Date.now());
  const MIN_STEP_DISPLAY_TIME = 1000; // ms

  // Step advancement timer
  const timerRef = useRef<number | null>(null);

  // This effect advances the display step based on timing
  useEffect(() => {
    // If we have more steps to show and enough time has passed
    if (seenStepSequence.length > 0 && displayIndex < seenStepSequence.length - 1) {
      const timeSinceLastChange = Date.now() - lastStepChangeRef.current;

      if (timeSinceLastChange >= MIN_STEP_DISPLAY_TIME) {
        // Advance to next step
        setDisplayIndex((prev) => prev + 1);
        lastStepChangeRef.current = Date.now();
      } else {
        // Schedule next step advancement
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }

        const remainingTime = MIN_STEP_DISPLAY_TIME - timeSinceLastChange;
        timerRef.current = setTimeout(() => {
          setDisplayIndex((prev) => prev + 1);
          lastStepChangeRef.current = Date.now();
        }, remainingTime) as unknown as number;
      }
    }

    // Cleanup timer
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [seenStepSequence, displayIndex]);

  // Compute the current step to display
  const currentStep =
    seenStepSequence.length > 0 && displayIndex < seenStepSequence.length
      ? seenStepSequence[displayIndex]
      : 0;

  // Core job stream logic
  useEffect(() => {
    let unmounted = false;

    // Don't do anything if there's no jobId
    if (!jobId) return;

    console.log(`[JobStream] Starting job stream for job ${jobId}`);

    // Reset state for new job
    setSeenStepSequence([]);
    setDisplayIndex(0);
    setAllUpdates([]);
    lastStepChangeRef.current = Date.now();

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

          // Add initial step
          setSeenStepSequence((prev) => [...prev, 0]);
        });

        // Handle messages
        es.addEventListener("message", (event) => {
          if (unmounted) return;

          try {
            console.log(`[JobStream] Received message: ${event.data}`);
            setLastReceivedMessage(event.data);

            const data: JobUpdate = JSON.parse(event.data ?? "");
            setJobState(data);

            // Add the raw update to our debug list
            const updateInfo = `${data.status}${data.progress ? ": " + data.progress : ""}`;
            setAllUpdates((prev) => [...prev, updateInfo]);

            // Map progress string to step index with more granular mapping
            const getStepIndex = (progress?: string): number => {
              if (!progress) return 0;

              // Exact string matching rather than includes for reliability
              const progressLower = progress.toLowerCase().trim();

              // Map exact strings to step indices
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

              // Try exact match first
              if (progressMap[progressLower] !== undefined) {
                return progressMap[progressLower];
              }

              // Fallback to includes for backward compatibility (but with ordered priority)
              if (progressLower.includes("initializing")) return 0;
              if (progressLower.includes("analyzing image with vision")) return 2;
              if (progressLower.includes("analyzing image")) return 1;
              if (progressLower.includes("image analyzed")) return 3;
              if (progressLower.includes("generating text embeddings")) return 4;
              if (progressLower.includes("extracting event details")) return 5;
              if (progressLower.includes("finding similar")) return 6;
              if (progressLower.includes("processing complete")) return 7;
              if (progressLower.includes("creating event")) return 8;

              // Default
              return 0;
            };

            // Helper to add step to our sequence while avoiding duplicates
            // In useJobStreamEnhanced.ts
            const addStepToSequence = (stepIndex: number) => {
              setSeenStepSequence((prev) => {
                // Skip if this step already exists anywhere in the sequence
                if (prev.includes(stepIndex)) {
                  return prev;
                }

                // Make sure we don't add steps out of logical order
                // For example, don't add step 7 before step 5
                const maxExpectedStep = prev.length > 0 ? prev[prev.length - 1] + 1 : 0;
                if (stepIndex > maxExpectedStep) {
                  // Fill in any missing steps
                  const newSequence = [...prev];
                  for (let i = maxExpectedStep; i <= stepIndex; i++) {
                    newSequence.push(i);
                  }
                  return newSequence;
                }

                return [...prev, stepIndex];
              });
            };

            // Update progress steps with metadata if available
            const updateStepWithMetadata = (stepIndex: number, data: JobUpdate) => {
              setProgressSteps((prev) => {
                const updated = [...prev];

                // Update confidence info
                if (data.confidence !== undefined) {
                  if (stepIndex === 3) {
                    updated[3] = `Image analyzed successfully (${(data.confidence * 100).toFixed(
                      0
                    )}% confidence)`;
                  } else if (stepIndex === 7) {
                    updated[7] = `Processing complete! (${(data.confidence * 100).toFixed(
                      0
                    )}% confidence)`;
                  }
                }

                // Update title info
                if (data.title && stepIndex === 5) {
                  updated[5] = `Event details extracted: "${data.title}"`;
                }

                // Update similarity score
                if (data.similarityScore !== undefined && stepIndex === 6) {
                  const similarityPercent = (data.similarityScore * 100).toFixed(0);
                  updated[6] = `Similar events found (${similarityPercent}% match)`;
                }

                return updated;
              });
            };

            // Process based on job status
            if (data.status === "pending") {
              // Add initializing step if it's not already in our sequence
              addStepToSequence(0);
            } else if (data.status === "processing") {
              if (data.progress) {
                const stepIndex = getStepIndex(data.progress);
                console.log(`[JobStream] Mapped progress "${data.progress}" to step ${stepIndex}`);

                // Add step to our sequence
                addStepToSequence(stepIndex);

                // Update step label with metadata
                updateStepWithMetadata(stepIndex, data);
              }
            } else if (data.status === "completed") {
              // Determine which step to show as final
              let finalStep = 7; // Default to "Processing complete!"

              if (data.result?.eventId) {
                finalStep = 8; // "Creating event..."
                setProgressSteps((prev) => {
                  const updated = [...prev];
                  updated[8] = `Event created successfully!`;
                  return updated;
                });
              } else if (data.result?.message) {
                // Show error message
                setProgressSteps((prev) => {
                  const updated = [...prev];
                  updated[7] = data.result.message;
                  return updated;
                });
              }

              // Add final step to sequence
              addStepToSequence(finalStep);

              // Update metadata
              updateStepWithMetadata(finalStep, data);

              // Mark job as complete
              setIsComplete(true);
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

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [jobId]);

  const resetStream = () => {
    console.log("[JobStream] Resetting job stream");
    setJobState(null);
    setIsConnected(false);
    setError(null);
    setIsComplete(false);
    setLastReceivedMessage(null);
    setSeenStepSequence([]);
    setDisplayIndex(0);
    setAllUpdates([]);

    // Reset progress steps to original state
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
