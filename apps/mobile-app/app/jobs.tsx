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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return "checkmark-circle";
      case "failed":
        return "close-circle";
      case "processing":
        return "sync";
      case "pending":
        return "time";
      default:
        return "help-circle";
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
    const diffInHours = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60),
    );

    if (diffInHours < 1) {
      return "Just now";
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
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

  return (
    <View style={styles.jobItem}>
      <View style={styles.jobHeader}>
        <View style={styles.jobInfo}>
          <View style={styles.jobTypeRow}>
            <Ionicons
              name={getStatusIcon(job.status)}
              size={20}
              color={getStatusColor(job.status)}
            />
            <Text style={styles.jobType}>
              {getJobTypeDisplayName(job.type)}
            </Text>
          </View>
          <Text style={styles.jobDate}>{formatDate(job.updated)}</Text>
        </View>
        <View style={styles.jobStatus}>
          <Text
            style={[styles.statusText, { color: getStatusColor(job.status) }]}
          >
            {job.status.toUpperCase()}
          </Text>
        </View>
      </View>

      {job.progressStep && (
        <View style={styles.progressSection}>
          <Text style={styles.progressStep}>{job.progressStep}</Text>
          {job.progress !== undefined && (
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${job.progress}%`,
                      backgroundColor: getStatusColor(job.status),
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {Math.round(job.progress)}%
              </Text>
            </View>
          )}
        </View>
      )}

      {job.progressDetails && (
        <View style={styles.detailsSection}>
          <Text style={styles.detailsText}>
            Step {job.progressDetails.currentStep} of{" "}
            {job.progressDetails.totalSteps}
          </Text>
          <Text style={styles.detailsDescription}>
            {job.progressDetails.stepDescription}
          </Text>
        </View>
      )}

      {job.error && (
        <View style={styles.errorSection}>
          <Text style={styles.errorText}>Error: {job.error}</Text>
        </View>
      )}

      {job.result &&
        typeof job.result === "object" &&
        "message" in job.result &&
        typeof (job.result as Record<string, unknown>).message === "string" && (
          <View style={styles.resultSection}>
            <Text style={styles.resultText}>
              {(job.result as Record<string, unknown>).message as string}
            </Text>
          </View>
        )}

      <View style={styles.jobActions}>
        {job.status === "failed" && (
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Ionicons name="refresh" size={16} color="#3498db" />
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        )}
        {(job.status === "pending" || job.status === "processing") && (
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
            <Ionicons name="close" size={16} color="#e74c3c" />
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}
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
                setJobs((prev) =>
                  prev.map((j) =>
                    j.id === job.id
                      ? {
                          ...j,
                          status: data.status || j.status,
                          progress: data.progress,
                          progressStep: data.progressStep,
                          progressDetails: data.progressDetails,
                          error: data.error,
                          result: data.result as Record<string, unknown>,
                          updated: new Date().toISOString(),
                        }
                      : j,
                  ),
                );
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

        const response = await jobsModule.getUserJobs();
        const newJobs = response.jobs;

        // Debug logging to check job structure
        console.log("Fetched jobs:", newJobs);
        if (newJobs && newJobs.length > 0) {
          console.log("First job structure:", newJobs[0]);
          console.log(
            "Job IDs:",
            newJobs.map((job) => job?.id),
          );
        }

        if (refresh || page === 1) {
          setJobs(newJobs);
          setCurrentPage(1);
        } else {
          setJobs((prev) => [...prev, ...newJobs]);
        }

        setHasMore(newJobs.length > 0);
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
    // Use refs to avoid dependency changes
    if (!hasMoreRef.current || isLoadingRef.current) return;
    await fetchJobs(currentPageRef.current + 1);
  }, [fetchJobs]); // Only depend on fetchJobs, use refs for other values

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
          setJobs((prev) =>
            prev.map((job) =>
              job.id === jobId
                ? {
                    ...job,
                    status: data.status || job.status,
                    progress: data.progress,
                    progressStep: data.progressStep,
                    progressDetails: data.progressDetails,
                    error: data.error,
                    result: data.result as Record<string, unknown>,
                    updated: new Date().toISOString(),
                  }
                : job,
            ),
          );
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
    padding: 16,
  },
  jobItem: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  jobHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  jobInfo: {
    flex: 1,
  },
  jobTypeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  jobType: {
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
    fontFamily: "SpaceMono",
  },
  jobDate: {
    fontSize: 12,
    color: "#6c757d",
    fontFamily: "SpaceMono",
  },
  jobStatus: {
    alignItems: "flex-end",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "SpaceMono",
  },
  progressSection: {
    marginBottom: 12,
  },
  progressStep: {
    fontSize: 14,
    color: "#495057",
    marginBottom: 8,
    fontFamily: "SpaceMono",
  },
  progressBarContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: "#e9ecef",
    borderRadius: 3,
    marginRight: 8,
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    fontWeight: "600",
    minWidth: 30,
    textAlign: "right",
    fontFamily: "SpaceMono",
  },
  detailsSection: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
  },
  detailsText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#495057",
    marginBottom: 4,
    fontFamily: "SpaceMono",
  },
  detailsDescription: {
    fontSize: 12,
    color: "#6c757d",
    fontFamily: "SpaceMono",
  },
  errorSection: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: "#f8d7da",
    borderRadius: 8,
  },
  errorText: {
    fontSize: 12,
    color: "#721c24",
    fontFamily: "SpaceMono",
  },
  resultSection: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: "#d4edda",
    borderRadius: 8,
  },
  resultText: {
    fontSize: 12,
    color: "#155724",
    fontFamily: "SpaceMono",
  },
  jobActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#e3f2fd",
  },
  retryButtonText: {
    fontSize: 12,
    color: "#3498db",
    marginLeft: 4,
    fontWeight: "600",
    fontFamily: "SpaceMono",
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#ffebee",
  },
  cancelButtonText: {
    fontSize: 12,
    color: "#e74c3c",
    marginLeft: 4,
    fontWeight: "600",
    fontFamily: "SpaceMono",
  },
});

export default JobsScreen;
