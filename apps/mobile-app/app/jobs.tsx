import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/services/ApiClient";
import { JobsModule, type JobData } from "@/services/api/modules/jobs";
import InfiniteScrollFlatList from "@/components/Layout/InfintieScrollFlatList";
import Screen from "@/components/Layout/Screen";
import EventSource from "react-native-sse";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSpring,
} from "react-native-reanimated";
import { AuthWrapper } from "@/components/AuthWrapper";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

interface JobItemProps {
  job: JobData;
  onRetry?: (jobId: string) => void;
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

const JobItem: React.FC<JobItemProps> = ({ job, onRetry }) => {
  const router = useRouter();

  // Animation values for spinning cog
  const rotation = useSharedValue(0);
  const progressBarWidth = useSharedValue(0);

  // Start spinning animation for processing jobs
  useEffect(() => {
    if (job.status === "processing") {
      rotation.value = withRepeat(
        withTiming(360, { duration: 2000 }),
        -1,
        false,
      );
    } else {
      rotation.value = withTiming(0, { duration: 300 });
    }
  }, [job.status]);

  // Animate progress bar when progress changes
  useEffect(() => {
    const targetProgress = job.progress !== undefined ? job.progress : 0;
    progressBarWidth.value = withSpring(targetProgress, {
      damping: 15,
      stiffness: 100,
    });
  }, [job.progress]);

  // Animated style for spinning cog
  const cogAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  // Animated style for progress bar
  const progressBarAnimatedStyle = useAnimatedStyle(() => {
    return {
      width: `${progressBarWidth.value}%`,
    };
  });

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

  const handleJobPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/job-details?jobId=${job.id}`);
  };

  const eventDetails = getEventDetails();
  const jobTitle = eventDetails
    ? eventDetails.title
    : getJobTypeDisplayName(job.type);

  // Use spinning cog for processing jobs, otherwise use the event emoji or default
  const shouldShowSpinningCog = job.status === "processing";
  const jobEmoji = shouldShowSpinningCog ? "⚙️" : eventDetails?.emoji || "⚙️";

  // Enhanced job description with step details
  const getJobDescription = () => {
    if (job.error) return job.error;
    if (job.result?.message) return job.result.message;

    // Show detailed step progress if available
    if (job.progressDetails) {
      console.log(
        `[JobItem] Job ${job.id} has progressDetails:`,
        job.progressDetails,
      );
      const { currentStep, totalSteps, stepProgress, stepDescription } =
        job.progressDetails;
      return `${stepDescription} (Step ${currentStep}/${totalSteps} - ${stepProgress}%)`;
    }

    // Fallback to simple progress step
    if (job.progressStep) return job.progressStep;

    return undefined;
  };

  const jobDescription = getJobDescription();

  // Render animated progress bar for overall job progress
  const renderAnimatedProgressBar = () => {
    if (
      job.progress === undefined ||
      job.status === "completed" ||
      job.status === "failed"
    ) {
      return null;
    }

    return (
      <View style={styles.animatedProgressContainer}>
        <View style={styles.animatedProgressTrack}>
          <Animated.View
            style={[styles.animatedProgressFill, progressBarAnimatedStyle]}
          />
        </View>
      </View>
    );
  };

  return (
    <TouchableOpacity
      style={styles.jobItem}
      onPress={handleJobPress}
      activeOpacity={0.7}
    >
      <View style={styles.jobContent}>
        <View style={styles.jobHeader}>
          <View style={styles.emojiContainer}>
            {shouldShowSpinningCog ? (
              <Animated.Text style={[styles.emoji, cogAnimatedStyle]}>
                {jobEmoji}
              </Animated.Text>
            ) : (
              <Text style={styles.emoji}>{jobEmoji}</Text>
            )}
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
            {renderAnimatedProgressBar()}
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
                <Ionicons name="chevron-forward" size={16} color="#6c757d" />
              </View>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const JobsScreen: React.FC = () => {
  const { user } = useAuth();
  const router = useRouter();
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

      // Get current active job IDs that need streaming
      const activeJobIds = new Set(
        currentJobs
          .filter(
            (job) => job.status === "pending" || job.status === "processing",
          )
          .map((job) => job.id),
      );

      // Close streams for jobs that are no longer active
      for (const [jobId, stream] of eventSourceRefs.current.entries()) {
        if (!activeJobIds.has(jobId)) {
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
          streamsSetupRef.current.add(job.id);

          try {
            // Create EventSource stream using react-native-sse
            const accessToken = await apiClient.getAccessToken();
            const url =
              accessToken !== null
                ? `${apiClient.baseUrl}/api/jobs/${job.id}/stream?token=${encodeURIComponent(accessToken as string)}`
                : `${apiClient.baseUrl}/api/jobs/${job.id}/stream`;

            const stream = new EventSource(url);

            // Use addEventListener for react-native-sse
            stream.addEventListener("message", (event) => {
              try {
                if (!event.data) {
                  return;
                }

                const data = JSON.parse(event.data);
                console.log(
                  `[JobsScreen] Received SSE update for job ${job.id}:`,
                  {
                    fullData: data,
                    progressDetails: data.progressDetails,
                    progressStep: data.progressStep,
                    progress: data.progress,
                    status: data.status,
                  },
                );

                setJobs((prev) => {
                  // Check if job already exists
                  const existingJobIndex = prev.findIndex(
                    (j) => j.id === job.id,
                  );

                  if (existingJobIndex >= 0) {
                    const currentJob = prev[existingJobIndex];

                    // Always update if progress has changed (even by small amounts)
                    const progressChanged =
                      currentJob.progress !== data.progress;
                    const statusChanged = currentJob.status !== data.status;
                    const stepChanged =
                      currentJob.progressStep !== data.progressStep;
                    const progressDetailsChanged =
                      JSON.stringify(currentJob.progressDetails) !==
                      JSON.stringify(data.progressDetails);
                    const errorChanged = currentJob.error !== data.error;
                    const resultChanged =
                      JSON.stringify(currentJob.result) !==
                      JSON.stringify(data.result);

                    if (
                      progressChanged ||
                      statusChanged ||
                      stepChanged ||
                      progressDetailsChanged ||
                      errorChanged ||
                      resultChanged
                    ) {
                      console.log(
                        `[JobsScreen] Updating job ${job.id} with changes:`,
                        {
                          progressChanged,
                          statusChanged,
                          stepChanged,
                          progressDetailsChanged,
                          errorChanged,
                          resultChanged,
                          newProgressDetails: data.progressDetails,
                        },
                      );

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
                      return sortJobsChronologically(updatedJobs);
                    }
                  }
                  return prev;
                });

                // Close connection if job is completed or failed
                if (data.status === "completed" || data.status === "failed") {
                  stream.close();
                  streamsSetupRef.current.delete(job.id);
                  eventSourceRefs.current.delete(job.id);
                }
              } catch (error) {
                console.error(
                  `Error parsing SSE data for job ${job.id}:`,
                  error,
                );
              }
            });

            stream.addEventListener("error", (event) => {
              console.error(`Stream error for job ${job.id}:`, event);
              // Remove from tracking on error
              streamsSetupRef.current.delete(job.id);
              eventSourceRefs.current.delete(job.id);
            });

            eventSourceRefs.current.set(job.id, stream);
          } catch (error) {
            console.error(`Failed to create stream for job ${job.id}:`, error);
            // Remove from tracking on error
            streamsSetupRef.current.delete(job.id);
          }
        }
      }
    };

    setupStreams();
  }, [jobs]); // Depend on jobs to detect new active jobs

  // Add a periodic job refresh to detect new jobs from other devices
  useEffect(() => {
    if (!user) return;

    const refreshInterval = setInterval(async () => {
      try {
        const response = await jobsModule.getUserJobs(10);
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

          return sortedJobs;
        });
      } catch (error) {
        console.error("Failed to check for new jobs:", error);
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

        const response = await jobsModule.getUserJobs(10);
        const newJobs = response.jobs;

        if (refresh || page === 1) {
          const sortedJobs = sortJobsChronologically(newJobs);
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
            return sortedJobs;
          });
        }

        // Since we're limiting to 10 jobs, there's no pagination
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
    // Disable pagination since we're limiting to 10 most recent jobs
    // No more jobs to fetch beyond the initial 10
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
    (job: JobData) => <JobItem key={job.id} job={job} onRetry={handleRetry} />,
    [handleRetry],
  );

  const handleRetryAll = useCallback(() => {
    fetchJobs();
  }, [fetchJobs]);

  if (!user) {
    return (
      <AuthWrapper>
        <Screen bannerTitle="Jobs">
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>
              Please log in to view your jobs
            </Text>
          </View>
        </Screen>
      </AuthWrapper>
    );
  }

  return (
    <AuthWrapper>
      <Screen
        onBack={() => router.back()}
        bannerTitle="Jobs"
        bannerEmoji="⚙️"
        showBackButton={true}
        footerButtons={[
          {
            label: "Refresh",
            onPress: handleRefresh,
            variant: "ghost",
          },
        ]}
        isScrollable={false}
      >
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
      </Screen>
    </AuthWrapper>
  );
};

const styles = StyleSheet.create({
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
  errorText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#e74c3c",
    textAlign: "center",
    marginTop: 20,
  },
  animatedProgressContainer: {
    marginBottom: 8,
  },
  animatedProgressTrack: {
    height: 4,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    borderRadius: 2,
    overflow: "hidden",
  },
  animatedProgressFill: {
    height: "100%",
    backgroundColor: "#007AFF",
    borderRadius: 2,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default JobsScreen;
