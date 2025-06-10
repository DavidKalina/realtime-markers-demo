import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/services/ApiClient";
import { JobsModule, type JobData } from "@/services/api/modules/jobs";
import InfiniteScrollFlatList from "@/components/Layout/InfintieScrollFlatList";

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
  const [currentPage, setCurrentPage] = useState(1);

  const webSocketRef = useRef<WebSocket | null>(null);
  const eventSourceRefs = useRef<Map<string, EventSource>>(new Map());
  const jobsRef = useRef<JobData[]>([]);
  const streamsSetupRef = useRef<Set<string>>(new Set());
  const isLoadingRef = useRef<boolean>(false);
  const hasMoreRef = useRef<boolean>(false);
  const currentPageRef = useRef<number>(1);
  const initializedRef = useRef<boolean>(false);

  // Update refs whenever state changes
  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  // Update ref whenever jobs change
  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  // Setup individual streams in a separate effect that doesn't trigger re-renders
  useEffect(() => {
    const setupStreams = async () => {
      // Close existing streams
      eventSourceRefs.current.forEach((stream) => stream.close());
      eventSourceRefs.current.clear();
      streamsSetupRef.current.clear();

      // Setup streams for active jobs using ref
      const currentJobs = jobsRef.current;
      currentJobs.forEach((job) => {
        if (
          job.status === "pending" ||
          (job.status === "processing" && !streamsSetupRef.current.has(job.id))
        ) {
          streamsSetupRef.current.add(job.id);
          jobsModule
            .createJobStream(job.id, {
              onMessage: (data) => {
                console.log(`[EventSource] Updating job ${job.id}:`, data);
                setJobs((prev) => {
                  // Check if job already exists
                  const existingJobIndex = prev.findIndex(
                    (j) => j.id === job.id,
                  );

                  if (existingJobIndex >= 0) {
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
                    // Job doesn't exist, this shouldn't happen but handle gracefully
                    console.warn(
                      `[EventSource] Job ${job.id} not found in current jobs list`,
                    );
                    return prev;
                  }
                });
              },
              onError: (error) => {
                console.error(`Stream error for job ${job.id}:`, error);
              },
            })
            .then((stream) => {
              eventSourceRefs.current.set(job.id, stream);
            });
        }
      });
    };

    setupStreams();
  }, [jobs.length]); // Only depend on jobs.length, not the entire jobs array

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
          setCurrentPage(1);
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

  const setupWebSocket = useCallback(async () => {
    try {
      const ws = await jobsModule.createJobWebSocket({
        onJobUpdate: (jobId, data) => {
          console.log(`[WebSocket] Updating job ${jobId}:`, data);
          setJobs((prev) => {
            // Check if job already exists
            const existingJobIndex = prev.findIndex((j) => j.id === jobId);

            if (existingJobIndex >= 0) {
              // Update existing job
              const updatedJobs = [...prev];
              updatedJobs[existingJobIndex] = {
                ...updatedJobs[existingJobIndex],
                status: data.status || updatedJobs[existingJobIndex].status,
                progress: data.progress,
                progressStep: data.progressStep,
                progressDetails: data.progressDetails,
                error: data.error,
                result: data.result,
                updated: new Date().toISOString(),
              };
              console.log(
                `[WebSocket] Updated job ${jobId}, total jobs: ${updatedJobs.length}`,
              );
              return sortJobsChronologically(updatedJobs);
            } else {
              // Job doesn't exist, this shouldn't happen but handle gracefully
              console.warn(
                `[WebSocket] Job ${jobId} not found in current jobs list`,
              );
              return prev;
            }
          });
        },
        onError: (error) => {
          console.error("WebSocket error:", error);
        },
        onClose: () => {
          console.log("WebSocket disconnected");
        },
      });
      webSocketRef.current = ws;
    } catch (err) {
      console.error("Failed to setup WebSocket:", err);
    }
  }, [jobsModule]);

  useEffect(() => {
    if (user && !initializedRef.current) {
      initializedRef.current = true;
      fetchJobs();
      setupWebSocket();
    }
  }, [user]); // Only depend on user, use ref to prevent re-initialization

  useEffect(() => {
    return () => {
      // Cleanup WebSocket
      if (webSocketRef.current) {
        webSocketRef.current.close();
      }
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
});

export default JobsScreen;
