import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/services/ApiClient";
import { JobsModule, type JobData } from "@/services/api/modules/jobs";
import InfiniteScrollFlatList from "@/components/Layout/InfintieScrollFlatList";
import EventSource from "react-native-sse";

interface JobItemProps {
  job: JobData;
  onRetry?: (jobId: string) => void;
  onCancel?: (jobId: string) => void;
}

/**
 * Utility function to sort jobs chronologically (newest first)
 *
 * Sorting priority:
 * 1. Most recent activity (updated timestamp, fallback to created)
 * 2. Creation date (newest first)
 * 3. Job ID (for consistency when timestamps are identical)
 */
const sortJobsChronologically = (jobs: JobData[]): JobData[] => {
  // Remove duplicates first
  const uniqueJobs = jobs.filter(
    (job, index, self) => index === self.findIndex((j) => j.id === job.id),
  );

  // Log if duplicates were found
  if (uniqueJobs.length !== jobs.length) {
    console.warn(
      `Found ${jobs.length - uniqueJobs.length} duplicate jobs, removing them`,
    );
  }

  return uniqueJobs.sort((a, b) => {
    // Get the most recent timestamp for each job
    const aTimestamp = a.updated || a.created;
    const bTimestamp = b.updated || b.created;

    // Compare timestamps (newest first)
    const timeComparison =
      new Date(bTimestamp).getTime() - new Date(aTimestamp).getTime();

    if (timeComparison !== 0) {
      return timeComparison;
    }

    // If timestamps are equal, sort by created date
    const createdComparison =
      new Date(b.created).getTime() - new Date(a.created).getTime();

    if (createdComparison !== 0) {
      return createdComparison;
    }

    // If created dates are equal, sort by job ID for consistency
    return b.id.localeCompare(a.id);
  });
};

const JobItem: React.FC<JobItemProps> = ({ job, onRetry, onCancel }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "#27ae60";
      case "failed":
        return "#e74c3c";
      case "processing":
        return "#f39c12";
      case "pending":
        return "#3498db";
      default:
        return "#95a5a6";
    }
  };

  const getJobTypeDisplayName = (type: string) => {
    switch (type) {
      case "process_flyer":
        return "Process Flyer";
      case "process_private_event":
        return "Create Private Event";
      case "process_multi_event_flyer":
        return "Process Multi-Event Flyer";
      case "cleanup_outdated_events":
        return "Cleanup Events";
      default:
        return type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
    }
  };

  const getEventDetails = () => {
    const eventDetails = job.data?.eventDetails as
      | { title?: string; emoji?: string }
      | undefined;
    const result = job.result;

    // Prefer result emoji if present (for completed jobs)
    if (result?.title || result?.emoji) {
      return {
        title: result.title || eventDetails?.title || "Event Created",
        emoji: result.emoji || eventDetails?.emoji || "📍",
        isPrivate: false,
      };
    }

    // For private events in progress, use eventDetails
    if (eventDetails) {
      return {
        title: eventDetails.title || "Creating Private Event",
        emoji: eventDetails.emoji || "📍",
        isPrivate: true,
      };
    }

    return null;
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) {
      return "Unknown date";
    }

    const date = new Date(dateString);

    // Check if the date is valid
    if (isNaN(date.getTime())) {
      return "Invalid date";
    }

    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMinutes < 1) {
      return "Just now";
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else if (diffInDays < 7) {
      return `${diffInDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const handleRetry = () => {
    if (onRetry) {
      onRetry(job.id);
    }
  };

  const handleCancel = () => {
    Alert.alert("Cancel Job", "Are you sure you want to cancel this job?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes",
        style: "destructive",
        onPress: () => onCancel?.(job.id),
      },
    ]);
  };

  const eventDetails = getEventDetails();
  const jobTitle = eventDetails
    ? eventDetails.title
    : getJobTypeDisplayName(job.type);
  const jobEmoji = eventDetails?.emoji || "⚙️";
  const jobDescription =
    job.progressStep || job.error || job.result?.message || undefined;

  return (
    <View style={styles.jobItem}>
      <View style={styles.jobContent}>
        <View style={styles.jobHeader}>
          <View style={styles.emojiContainer}>
            <Text style={styles.emoji}>{jobEmoji}</Text>
          </View>
          <View style={styles.titleContainer}>
            <View style={styles.titleRow}>
              <Text style={styles.titleText} numberOfLines={1}>
                {jobTitle}
              </Text>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(job.status) },
                ]}
              >
                <Text style={styles.statusBadgeText}>
                  {job.status.toUpperCase()}
                </Text>
              </View>
            </View>
            {jobDescription && (
              <Text style={styles.jobDescription} numberOfLines={2}>
                {jobDescription}
              </Text>
            )}
            <View style={styles.jobFooter}>
              <View style={styles.footerLeft}>
                <Text style={styles.jobDate}>
                  {formatDate(job.updated || job.created)}
                </Text>
                {eventDetails && (
                  <View style={styles.privacyBadge}>
                    <Text style={styles.privacyBadgeText}>
                      {eventDetails.isPrivate ? "🔒 Private" : "🌍 Public"}
                    </Text>
                  </View>
                )}
                {job.progress !== undefined && (
                  <View style={styles.progressBadge}>
                    <Text style={styles.progressBadgeText}>
                      {Math.round(job.progress)}%
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.footerRight}>
                {job.status === "failed" && (
                  <TouchableOpacity
                    style={styles.retryButton}
                    onPress={handleRetry}
                  >
                    <Text style={styles.retryButtonText}>Retry</Text>
                  </TouchableOpacity>
                )}
                {(job.status === "pending" || job.status === "processing") && (
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={handleCancel}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

const JobsScreen: React.FC = () => {
  const router = useRouter();
  const { user } = useAuth();
  const jobsModule = new JobsModule(apiClient);

  const [jobs, setJobs] = useState<JobData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const eventSourceRefs = useRef<Map<string, EventSource>>(new Map());
  const jobsRef = useRef<JobData[]>([]);
  const streamsSetupRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef<boolean>(false);

  // Update ref whenever jobs change
  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  // Setup individual streams for active jobs using react-native-sse
  useEffect(() => {
    const setupStreams = async () => {
      const currentJobs = jobsRef.current;

      console.log(`[EventSource] Total jobs loaded: ${currentJobs.length}`);
      console.log(
        "[EventSource] All jobs:",
        currentJobs.map((job) => ({
          id: job.id,
          type: job.type,
          status: job.status,
          progress: job.progress,
        })),
      );

      // Debug: Log current state
      const activeJobs = currentJobs.filter(
        (job) => job.status === "pending" || job.status === "processing",
      );
      console.log(
        `[EventSource] Setup check - Active jobs: ${activeJobs.length}, Current streams: ${streamsSetupRef.current.size}`,
      );
      activeJobs.forEach((job) => {
        console.log(
          `[EventSource] Active job: ${job.id} (${job.status}) - Has stream: ${streamsSetupRef.current.has(job.id)}`,
        );
      });

      // Get current active job IDs that need streaming
      const activeJobIds = new Set(
        currentJobs
          .filter(
            (job) => job.status === "pending" || job.status === "processing",
          )
          .map((job) => job.id),
      );

      console.log("[EventSource] Active job IDs:", Array.from(activeJobIds));

      // Close streams for jobs that are no longer active
      for (const [jobId, stream] of eventSourceRefs.current.entries()) {
        if (!activeJobIds.has(jobId)) {
          console.log(
            `[EventSource] Closing stream for completed/failed job: ${jobId}`,
          );
          stream.close();
          eventSourceRefs.current.delete(jobId);
          streamsSetupRef.current.delete(jobId);
        }
      }

      // Setup streams for active jobs that don't already have streams
      for (const job of currentJobs) {
        if (
          (job.status === "pending" || job.status === "processing") &&
          !streamsSetupRef.current.has(job.id)
        ) {
          console.log(
            `[EventSource] Setting up stream for job: ${job.id} (${job.status})`,
          );
          streamsSetupRef.current.add(job.id);

          try {
            // Create EventSource stream using react-native-sse
            const accessToken = await apiClient.getAccessToken();
            const url =
              accessToken !== null
                ? `${apiClient.baseUrl}/api/jobs/${job.id}/stream?token=${encodeURIComponent(accessToken as string)}`
                : `${apiClient.baseUrl}/api/jobs/${job.id}/stream`;

            console.log(
              `[EventSource] Creating stream for job ${job.id} with URL:`,
              url,
            );

            const stream = new EventSource(url);

            // Use addEventListener for react-native-sse
            stream.addEventListener("message", (event) => {
              try {
                console.log(
                  `[EventSource] Raw message received for job ${job.id}:`,
                  event,
                );

                if (!event.data) {
                  console.warn(
                    `[EventSource] Received null/empty data for job ${job.id}`,
                  );
                  return;
                }

                console.log(
                  `[EventSource] Parsing data for job ${job.id}:`,
                  event.data,
                );
                const data = JSON.parse(event.data);
                console.log(
                  `[EventSource] Parsed update for job ${job.id}:`,
                  data,
                );

                setJobs((prev) => {
                  // Check if job already exists
                  const existingJobIndex = prev.findIndex(
                    (j) => j.id === job.id,
                  );

                  if (existingJobIndex >= 0) {
                    const currentJob = prev[existingJobIndex];

                    // Only update if there are actual changes
                    if (
                      currentJob.status !== data.status ||
                      currentJob.progress !== data.progress ||
                      currentJob.progressStep !== data.progressStep ||
                      currentJob.error !== data.error ||
                      JSON.stringify(currentJob.result) !==
                        JSON.stringify(data.result)
                    ) {
                      // Update existing job
                      const updatedJobs = [...prev];
                      updatedJobs[existingJobIndex] = {
                        ...updatedJobs[existingJobIndex],
                        status:
                          data.status || updatedJobs[existingJobIndex].status,
                        progress: data.progress,
                        progressStep: data.progressStep,
                        progressDetails: data.progressDetails,
                        error: data.error,
                        result: data.result,
                        updated: new Date().toISOString(),
                      };
                      console.log(
                        `[EventSource] Updated job ${job.id}, total jobs: ${updatedJobs.length}`,
                      );
                      return sortJobsChronologically(updatedJobs);
                    } else {
                      console.log(
                        `[EventSource] No changes detected for job ${job.id}`,
                      );
                    }
                  } else {
                    // Job doesn't exist, this shouldn't happen but handle gracefully
                    console.warn(
                      `[EventSource] Job ${job.id} not found in current jobs list`,
                    );
                  }
                  return prev;
                });

                // Close connection if job is completed or failed
                if (data.status === "completed" || data.status === "failed") {
                  console.log(
                    `[EventSource] Job ${job.id} completed/failed, closing stream`,
                  );
                  stream.close();
                  streamsSetupRef.current.delete(job.id);
                  eventSourceRefs.current.delete(job.id);
                }
              } catch (error) {
                console.error(
                  `[EventSource] Error parsing SSE data for job ${job.id}:`,
                  error,
                );
                console.error("[EventSource] Raw event data:", event);
              }
            });

            stream.addEventListener("error", (event) => {
              console.error(
                `[EventSource] Stream error for job ${job.id}:`,
                event,
              );
              console.error("[EventSource] Error event details:", {
                type: event.type,
                event: event,
              });
              // Remove from tracking on error
              streamsSetupRef.current.delete(job.id);
              eventSourceRefs.current.delete(job.id);
            });

            stream.addEventListener("open", () => {
              console.log(`[EventSource] Stream opened for job: ${job.id}`);
            });

            eventSourceRefs.current.set(job.id, stream);
            console.log(
              `[EventSource] Successfully created stream for job: ${job.id}`,
            );
          } catch (error) {
            console.error(`Failed to create stream for job ${job.id}:`, error);
            // Remove from tracking on error
            streamsSetupRef.current.delete(job.id);
          }
        }
      }

      // Debug: Log final state
      console.log(
        `[EventSource] Setup complete - Active streams: ${streamsSetupRef.current.size}`,
      );
    };

    setupStreams();
  }, [jobs]); // Depend on jobs to detect new active jobs

  // Add a periodic job refresh to detect new jobs from other devices
  useEffect(() => {
    if (!user) return;

    const refreshInterval = setInterval(async () => {
      try {
        console.log("[AutoRefresh] Checking for new jobs...");
        const response = await jobsModule.getUserJobs(50);
        const newJobs = response.jobs;

        setJobs((prev) => {
          // Create a Map to ensure unique jobs by ID
          const jobsMap = new Map<string, JobData>();

          // Add existing jobs
          prev.forEach((job) => jobsMap.set(job.id, job));

          // Add new jobs (this will overwrite existing ones if they have the same ID)
          newJobs.forEach((job) => jobsMap.set(job.id, job));

          // Convert back to array and sort
          const sortedJobs = sortJobsChronologically(
            Array.from(jobsMap.values()),
          );

          const prevCount = prev.length;
          const newCount = sortedJobs.length;

          if (newCount > prevCount) {
            const newJobIds = sortedJobs
              .filter((job) => !prev.some((p) => p.id === job.id))
              .map((job) => job.id);

            console.log(
              `[AutoRefresh] Found ${newCount - prevCount} new jobs!`,
            );
            console.log("[AutoRefresh] New job IDs:", newJobIds);
            console.log(
              "[AutoRefresh] New jobs details:",
              sortedJobs
                .filter((job) => newJobIds.includes(job.id))
                .map((job) => ({
                  id: job.id,
                  type: job.type,
                  status: job.status,
                  creatorId: job.data?.creatorId,
                  userMatch: job.data?.creatorId === user?.id,
                })),
            );

            // Check if any new jobs are active and need SSE streams
            const newActiveJobs = sortedJobs
              .filter((job) => newJobIds.includes(job.id))
              .filter(
                (job) =>
                  job.status === "pending" || job.status === "processing",
              );

            if (newActiveJobs.length > 0) {
              console.log(
                `[AutoRefresh] ${newActiveJobs.length} new active jobs need SSE streams:`,
                newActiveJobs.map((job) => job.id),
              );
            }
          }

          return sortedJobs;
        });
      } catch (error) {
        console.error("[AutoRefresh] Failed to check for new jobs:", error);
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(refreshInterval);
  }, [user, jobsModule]);

  const fetchJobs = useCallback(
    async (page = 1, refresh = false) => {
      try {
        setError(null);
        if (page === 1) {
          setIsLoading(true);
        }

        const response = await jobsModule.getUserJobs(50);
        const newJobs = response.jobs;

        // Debug logging to check job structure
        console.log("Fetched jobs:", newJobs);
        console.log(
          "[fetchJobs] Job statuses:",
          newJobs.map((job) => ({
            id: job.id,
            type: job.type,
            status: job.status,
            progress: job.progress,
          })),
        );

        if (newJobs && newJobs.length > 0) {
          console.log(
            "First job structure:",
            JSON.stringify(newJobs[0], null, 2),
          );
          console.log(
            "Job IDs:",
            newJobs.map((job) => job?.id),
          );

          // Log emoji information for completed jobs
          newJobs.forEach((job, index) => {
            if (job.status === "completed" && job.result) {
              const eventDetails = job.data?.eventDetails as
                | { emoji?: string }
                | undefined;
              console.log(`Job ${index + 1} (${job.id}):`, {
                type: job.type,
                status: job.status,
                resultEmoji: job.result.emoji,
                resultTitle: job.result.title,
                eventDetailsEmoji: eventDetails?.emoji,
              });
            }
          });

          // Check for duplicates in fetched jobs
          const jobIds = newJobs.map((job) => job.id);
          const uniqueJobIds = [...new Set(jobIds)];
          if (jobIds.length !== uniqueJobIds.length) {
            console.warn(
              `[fetchJobs] Found ${jobIds.length - uniqueJobIds.length} duplicate job IDs in fetched data`,
            );
          }
        }

        if (refresh || page === 1) {
          const sortedJobs = sortJobsChronologically(newJobs);
          console.log(
            `[fetchJobs] Setting ${sortedJobs.length} jobs (refresh/page 1)`,
          );
          setJobs(sortedJobs);
        } else {
          setJobs((prev) => {
            // Create a Map to ensure unique jobs by ID
            const jobsMap = new Map<string, JobData>();

            // Add existing jobs
            prev.forEach((job) => jobsMap.set(job.id, job));

            // Add new jobs (this will overwrite existing ones if they have the same ID)
            newJobs.forEach((job) => jobsMap.set(job.id, job));

            // Convert back to array and sort
            const sortedJobs = sortJobsChronologically(
              Array.from(jobsMap.values()),
            );
            console.log(
              `[fetchJobs] Updated jobs: ${prev.length} -> ${sortedJobs.length} (page ${page})`,
            );
            return sortedJobs;
          });
        }

        // Since we're limiting to 50 jobs, there's no pagination
        setHasMore(false);
      } catch (err) {
        console.error("Failed to fetch jobs:", err);
        setError("Failed to load jobs");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [jobsModule],
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchJobs(1, true);
  }, [fetchJobs]);

  const handleFetchMore = useCallback(async () => {
    // Disable pagination since we're limiting to 50 most recent jobs
    // No more jobs to fetch beyond the initial 50
    return;
  }, []); // No dependencies needed since this is disabled

  const handleRetry = useCallback(
    async (jobId: string) => {
      try {
        await jobsModule.retryJob(jobId);
        Alert.alert("Success", "Job has been queued for retry");
        handleRefresh();
      } catch (err) {
        console.error("Failed to retry job:", err);
        Alert.alert("Error", "Failed to retry job");
      }
    },
    [jobsModule, handleRefresh],
  );

  const handleCancel = useCallback(
    async (jobId: string) => {
      try {
        await jobsModule.cancelJob(jobId);
        Alert.alert("Success", "Job has been cancelled");
        handleRefresh();
      } catch (err) {
        console.error("Failed to cancel job:", err);
        Alert.alert("Error", "Failed to cancel job");
      }
    },
    [jobsModule, handleRefresh],
  );

  useEffect(() => {
    if (user && !initializedRef.current) {
      initializedRef.current = true;
      fetchJobs();
    }
  }, [user]); // Only depend on user, use ref to prevent re-initialization

  useEffect(() => {
    return () => {
      // Cleanup EventSources
      eventSourceRefs.current.forEach((stream) => stream.close());
      eventSourceRefs.current.clear();
    };
  }, []);

  const renderJobItem = useCallback(
    (job: JobData) => (
      <JobItem
        key={job.id}
        job={job}
        onRetry={handleRetry}
        onCancel={handleCancel}
      />
    ),
    [handleRetry, handleCancel],
  );

  const handleRetryAll = useCallback(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Manual trigger to test stream setup
  const handleManualStreamSetup = useCallback(() => {
    console.log("[Manual] Triggering manual stream setup");
    const currentJobs = jobsRef.current;
    const activeJobs = currentJobs.filter(
      (job) => job.status === "pending" || job.status === "processing",
    );

    console.log(
      `[Manual] Found ${activeJobs.length} active jobs:`,
      activeJobs.map((job) => `${job.id} (${job.status})`),
    );

    // Debug: Log detailed job information
    console.log("[Manual] Detailed job information:");
    currentJobs.forEach((job, index) => {
      console.log(`[Manual] Job ${index + 1}:`, {
        id: job.id,
        type: job.type,
        status: job.status,
        creatorId: job.data?.creatorId,
        userMatch: job.data?.creatorId === user?.id,
        hasData: !!job.data,
        dataKeys: job.data ? Object.keys(job.data) : [],
      });
    });

    // If no active jobs, create a test connection to a dummy job
    if (activeJobs.length === 0) {
      console.log("[Manual] No active jobs found, testing with dummy job");
      const testJobId = "test-job-123";

      apiClient.getAccessToken().then((accessToken) => {
        const url =
          accessToken !== null
            ? `${apiClient.baseUrl}/api/jobs/${testJobId}/stream?token=${encodeURIComponent(accessToken as string)}`
            : `${apiClient.baseUrl}/api/jobs/${testJobId}/stream`;

        console.log("[Manual] Testing SSE connection with URL:", url);

        const stream = new EventSource(url);

        stream.addEventListener("message", (event) => {
          console.log("[Manual] Test stream received message:", event);
        });

        stream.addEventListener("error", (event) => {
          console.log("[Manual] Test stream error:", event);
        });

        stream.addEventListener("open", () => {
          console.log("[Manual] Test stream opened successfully");
        });
      });
      return;
    }

    activeJobs.forEach((job) => {
      if (!streamsSetupRef.current.has(job.id)) {
        console.log(`[Manual] Setting up stream for job: ${job.id}`);
        streamsSetupRef.current.add(job.id);

        // Create EventSource stream using react-native-sse
        apiClient.getAccessToken().then((accessToken) => {
          const url =
            accessToken !== null
              ? `${apiClient.baseUrl}/api/jobs/${job.id}/stream?token=${encodeURIComponent(accessToken as string)}`
              : `${apiClient.baseUrl}/api/jobs/${job.id}/stream`;

          const stream = new EventSource(url);

          stream.addEventListener("message", (event) => {
            try {
              if (!event.data) {
                console.warn(
                  `[Manual] Received null/empty data for job ${job.id}`,
                );
                return;
              }
              const data = JSON.parse(event.data);
              console.log(`[Manual] Received update for job ${job.id}:`, data);

              setJobs((prev) => {
                const existingJobIndex = prev.findIndex((j) => j.id === job.id);
                if (existingJobIndex >= 0) {
                  const currentJob = prev[existingJobIndex];

                  // Only update if there are actual changes
                  if (
                    currentJob.status !== data.status ||
                    currentJob.progress !== data.progress ||
                    currentJob.progressStep !== data.progressStep ||
                    currentJob.error !== data.error ||
                    JSON.stringify(currentJob.result) !==
                      JSON.stringify(data.result)
                  ) {
                    const updatedJobs = [...prev];
                    updatedJobs[existingJobIndex] = {
                      ...updatedJobs[existingJobIndex],
                      status:
                        data.status || updatedJobs[existingJobIndex].status,
                      progress: data.progress,
                      progressStep: data.progressStep,
                      progressDetails: data.progressDetails,
                      error: data.error,
                      result: data.result,
                      updated: new Date().toISOString(),
                    };
                    return sortJobsChronologically(updatedJobs);
                  }
                }
                return prev;
              });

              // Close connection if job is completed or failed
              if (data.status === "completed" || data.status === "failed") {
                console.log(
                  `[Manual] Job ${job.id} completed/failed, closing stream`,
                );
                stream.close();
                streamsSetupRef.current.delete(job.id);
                eventSourceRefs.current.delete(job.id);
              }
            } catch (error) {
              console.error(
                `[Manual] Error parsing SSE data for job ${job.id}:`,
                error,
              );
            }
          });

          stream.addEventListener("error", (event) => {
            console.error(`[Manual] Stream error for job ${job.id}:`, event);
            streamsSetupRef.current.delete(job.id);
            eventSourceRefs.current.delete(job.id);
          });

          eventSourceRefs.current.set(job.id, stream);
          console.log(
            `[Manual] Successfully created stream for job: ${job.id}`,
          );
        });
      } else {
        console.log(`[Manual] Stream already exists for job: ${job.id}`);
      }
    });
  }, []);

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Please log in to view your jobs</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>My Jobs</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefresh}
          disabled={isRefreshing}
        >
          <Ionicons
            name="refresh"
            size={24}
            color={isRefreshing ? "#ccc" : "#000"}
          />
        </TouchableOpacity>
      </View>

      {/* Debug section - remove in production */}
      {__DEV__ && (
        <View style={styles.debugSection}>
          <Text style={styles.debugTitle}>Debug Info:</Text>
          <Text style={styles.debugText}>Total Jobs: {jobs.length}</Text>
          <Text style={styles.debugText}>
            Active SSE Streams: {streamsSetupRef.current.size}
          </Text>
          <Text style={styles.debugText}>
            Active Jobs:{" "}
            {
              jobs.filter(
                (job) =>
                  job.status === "pending" || job.status === "processing",
              ).length
            }
          </Text>
          <Text style={styles.debugText}>
            Current User ID: {user?.id || "Not logged in"}
          </Text>
          <Text style={styles.debugText}>
            Jobs with Creator ID:{" "}
            {jobs.filter((job) => job.data?.creatorId).length}
          </Text>
          <Text style={styles.debugText}>
            Jobs matching user:{" "}
            {jobs.filter((job) => job.data?.creatorId === user?.id).length}
          </Text>
          <TouchableOpacity
            style={styles.debugButton}
            onPress={handleManualStreamSetup}
          >
            <Text style={styles.debugButtonText}>
              Setup SSE for Active Jobs
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.debugButton}
            onPress={async () => {
              console.log("[ManualRefresh] Manually checking for new jobs...");
              try {
                const response = await jobsModule.getUserJobs(50);
                const newJobs = response.jobs;

                setJobs((prev) => {
                  const jobsMap = new Map<string, JobData>();
                  prev.forEach((job) => jobsMap.set(job.id, job));
                  newJobs.forEach((job) => jobsMap.set(job.id, job));

                  const sortedJobs = sortJobsChronologically(
                    Array.from(jobsMap.values()),
                  );

                  const prevCount = prev.length;
                  const newCount = sortedJobs.length;

                  if (newCount > prevCount) {
                    console.log(
                      `[ManualRefresh] Found ${newCount - prevCount} new jobs!`,
                    );
                    console.log(
                      "[ManualRefresh] New job IDs:",
                      sortedJobs
                        .filter((job) => !prev.some((p) => p.id === job.id))
                        .map((job) => job.id),
                    );
                  } else {
                    console.log("[ManualRefresh] No new jobs found");
                  }

                  return sortedJobs;
                });
              } catch (error) {
                console.error(
                  "[ManualRefresh] Failed to check for new jobs:",
                  error,
                );
              }
            }}
          >
            <Text style={styles.debugButtonText}>Check for New Jobs</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.debugButton}
            onPress={() => {
              console.log("[Test] Testing SSE connection...");
              const testJobId = "test-job-123";
              apiClient.getAccessToken().then((accessToken) => {
                const url =
                  accessToken !== null
                    ? `${apiClient.baseUrl}/api/jobs/${testJobId}/stream?token=${encodeURIComponent(accessToken as string)}`
                    : `${apiClient.baseUrl}/api/jobs/${testJobId}/stream`;

                console.log("[Test] SSE URL:", url);
                console.log(
                  "[Test] Access token:",
                  accessToken ? "present" : "missing",
                );

                const stream = new EventSource(url);

                stream.addEventListener("message", (event) => {
                  console.log("[Test] SSE message received:", event);
                });

                stream.addEventListener("error", (event) => {
                  console.log("[Test] SSE error:", event);
                });

                stream.addEventListener("open", () => {
                  console.log("[Test] SSE connection opened");
                });
              });
            }}
          >
            <Text style={styles.debugButtonText}>Test SSE Connection</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.debugButton}
            onPress={() => {
              apiClient.getAccessToken().then((accessToken) => {
                console.log(
                  "[Postman] Use this structure for Postman requests:",
                );
                console.log(
                  "[Postman] URL:",
                  `${apiClient.baseUrl}/api/events/private`,
                );
                console.log("[Postman] Method: POST");
                console.log("[Postman] Headers:", {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${accessToken}`,
                });
                console.log(
                  "[Postman] Body:",
                  JSON.stringify(
                    {
                      title: "Test Event from Postman",
                      date: new Date(
                        Date.now() + 24 * 60 * 60 * 1000,
                      ).toISOString(),
                      location: {
                        type: "Point",
                        coordinates: [-122.4194, 37.7749],
                      },
                      address: "123 Test St, San Francisco, CA",
                      description: "Test event created from Postman",
                      emoji: "📱",
                      sharedWithIds: [],
                    },
                    null,
                    2,
                  ),
                );
                console.log("[Postman] Current User ID:", user?.id);
                console.log(
                  "[Postman] Access Token:",
                  accessToken ? "Present" : "Missing",
                );
              });
            }}
          >
            <Text style={styles.debugButtonText}>Show Postman Structure</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.debugButton}
            onPress={async () => {
              console.log("[Test] Creating test job...");
              try {
                const response = await fetch(
                  `${apiClient.baseUrl}/api/events/private`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${await apiClient.getAccessToken()}`,
                    },
                    body: JSON.stringify({
                      title: "Test Job for SSE",
                      date: new Date(
                        Date.now() + 24 * 60 * 60 * 1000,
                      ).toISOString(),
                      location: {
                        type: "Point",
                        coordinates: [-122.4194, 37.7749],
                      },
                      address: "123 Test St, San Francisco, CA",
                      description: "Test job to verify SSE streaming",
                      emoji: "🧪",
                      sharedWithIds: [],
                    }),
                  },
                );

                const result = await response.json();
                console.log("[Test] Job creation result:", result);

                if (result.jobId) {
                  console.log("[Test] Job created successfully:", result.jobId);
                  // Refresh jobs to see the new job
                  handleRefresh();
                }
              } catch (error) {
                console.error("[Test] Failed to create job:", error);
              }
            }}
          >
            <Text style={styles.debugButtonText}>Create Test Job</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.debugButton}
            onPress={() => {
              console.log("[Debug] Current job state:");
              console.log("[Debug] Total jobs:", jobs.length);
              console.log(
                "[Debug] Active SSE streams:",
                streamsSetupRef.current.size,
              );
              console.log("[Debug] Current user ID:", user?.id);

              jobs.forEach((job, index) => {
                console.log(`[Debug] Job ${index + 1}:`, {
                  id: job.id,
                  type: job.type,
                  status: job.status,
                  creatorId: job.data?.creatorId,
                  userMatch: job.data?.creatorId === user?.id,
                  hasSSEStream: streamsSetupRef.current.has(job.id),
                  isActive:
                    job.status === "pending" || job.status === "processing",
                });
              });

              const activeJobs = jobs.filter(
                (job) =>
                  job.status === "pending" || job.status === "processing",
              );

              console.log("[Debug] Active jobs:", activeJobs.length);
              console.log(
                "[Debug] Active jobs with SSE streams:",
                activeJobs.filter((job) => streamsSetupRef.current.has(job.id))
                  .length,
              );

              const jobsNeedingStreams = activeJobs.filter(
                (job) => !streamsSetupRef.current.has(job.id),
              );

              if (jobsNeedingStreams.length > 0) {
                console.log(
                  "[Debug] Jobs needing SSE streams:",
                  jobsNeedingStreams.map((job) => job.id),
                );
              }
            }}
          >
            <Text style={styles.debugButtonText}>Debug Job State</Text>
          </TouchableOpacity>
        </View>
      )}

      <InfiniteScrollFlatList
        data={jobs}
        renderItem={renderJobItem}
        fetchMoreData={handleFetchMore}
        onRefresh={handleRefresh}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        hasMore={hasMore}
        error={error}
        emptyListMessage="No jobs found"
        onRetry={handleRetryAll}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    fontFamily: "SpaceMono",
  },
  refreshButton: {
    padding: 8,
  },
  listContainer: {
    padding: 12,
  },
  jobItem: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  jobContent: {
    flex: 1,
  },
  jobHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  emojiContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  emoji: {
    fontSize: 18,
  },
  titleContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  titleText: {
    flex: 1,
    color: "#000",
    fontSize: 16,
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },
  jobDescription: {
    color: "#6c757d",
    fontSize: 14,
    fontFamily: "SpaceMono",
    lineHeight: 20,
    marginBottom: 4,
  },
  jobFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  footerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  footerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  jobDate: {
    color: "#007AFF",
    fontSize: 12,
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  statusBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },
  privacyBadge: {
    backgroundColor: "#f8f9fa",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  privacyBadgeText: {
    color: "#6c757d",
    fontSize: 11,
    fontFamily: "SpaceMono",
    fontWeight: "500",
  },
  progressBadge: {
    backgroundColor: "#f8f9fa",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  progressBadgeText: {
    color: "#6c757d",
    fontSize: 11,
    fontFamily: "SpaceMono",
    fontWeight: "500",
  },
  retryButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },
  cancelButton: {
    backgroundColor: "#FF3B30",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  cancelButtonText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },
  errorText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#e74c3c",
    textAlign: "center",
    marginTop: 20,
  },
  debugSection: {
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e9ecef",
  },
  debugTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
    marginBottom: 8,
  },
  debugText: {
    fontSize: 14,
    color: "#6c757d",
    marginBottom: 4,
  },
  debugButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
    alignItems: "center",
  },
  debugButtonText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },
});

export default JobsScreen;
