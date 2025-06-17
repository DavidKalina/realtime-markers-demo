import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { JobData } from "@/services/api/modules/jobs";
import { apiClient } from "@/services/ApiClient";
import { JobsModule } from "@/services/api/modules/jobs";
import { useAuth } from "@/contexts/AuthContext";
import Screen from "@/components/Layout/Screen";
import { AuthWrapper } from "@/components/AuthWrapper";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

const JobDetailsScreen: React.FC = () => {
  const { jobId } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  // Memoize the jobsModule to prevent infinite re-renders
  const jobsModule = React.useMemo(() => new JobsModule(apiClient), []);

  const [job, setJob] = React.useState<JobData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchJobDetails = async () => {
      if (!jobId || !user) return;

      try {
        setIsLoading(true);
        setError(null);

        // Fetch job details from the API
        const response = await jobsModule.getUserJobs(100); // Get more jobs to find the specific one
        const foundJob = response.jobs.find((j) => j.id === jobId);

        if (foundJob) {
          setJob(foundJob);
        } else {
          setError("Job not found");
        }
      } catch (err) {
        console.error("Failed to fetch job details:", err);
        setError("Failed to load job details");
      } finally {
        setIsLoading(false);
      }
    };

    fetchJobDetails();
  }, [jobId, user]); // Removed jobsModule from dependencies

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

  const getEventDetails = () => {
    const eventDetails = job?.data?.eventDetails as
      | { title?: string; emoji?: string }
      | undefined;
    const result = job?.result;

    // Determine if this is a private event based on job type
    const isPrivateEvent = job?.type === "process_private_event";

    if (result?.title || result?.emoji) {
      return {
        title: result.title || eventDetails?.title || "Event Created",
        emoji: result.emoji || eventDetails?.emoji || "📍",
        isPrivate: isPrivateEvent,
      };
    }

    if (eventDetails) {
      return {
        title: eventDetails.title || "Creating Private Event",
        emoji: eventDetails.emoji || "📍",
        isPrivate: isPrivateEvent,
      };
    }

    return null;
  };

  const formatDetailedDate = (dateString: string | undefined) => {
    if (!dateString) return "Unknown date";

    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Invalid date";

    return date.toLocaleString();
  };

  const renderProgressSection = () => {
    if (!job) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Progress</Text>
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${job.progress || 0}%`,
                  backgroundColor: getStatusColor(job.status),
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {Math.round(job.progress || 0)}%
          </Text>
        </View>

        {job.progressStep && (
          <Text style={styles.progressStep}>{job.progressStep}</Text>
        )}

        {job.progressDetails && (
          <View style={styles.progressDetails}>
            <Text style={styles.progressDetailsText}>
              Step {job.progressDetails.currentStep} of{" "}
              {job.progressDetails.totalSteps}
            </Text>
            <Text style={styles.progressDetailsText}>
              {job.progressDetails.stepDescription}
            </Text>
            {job.progressDetails.stepProgress !== undefined && (
              <Text style={styles.progressDetailsText}>
                Step Progress: {Math.round(job.progressDetails.stepProgress)}%
              </Text>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderResultSection = () => {
    if (!job?.result) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Event Information</Text>
        <View style={styles.resultContainer}>
          {job.result.message && (
            <Text style={styles.resultMessage}>{job.result.message}</Text>
          )}

          {job.result.title && (
            <View style={styles.resultItem}>
              <Text style={styles.resultLabel}>Title:</Text>
              <Text style={styles.resultValue}>{job.result.title}</Text>
            </View>
          )}

          {job.result.emoji && (
            <View style={styles.resultItem}>
              <Text style={styles.resultLabel}>Emoji:</Text>
              <Text style={styles.resultValue}>{job.result.emoji}</Text>
            </View>
          )}

          {job.result.coordinates && (
            <View style={styles.resultItem}>
              <Text style={styles.resultLabel}>Location:</Text>
              <Text style={styles.resultValue}>
                {job.result.coordinates[0].toFixed(6)},{" "}
                {job.result.coordinates[1].toFixed(6)}
              </Text>
            </View>
          )}

          {job.result.confidence !== undefined && (
            <View style={styles.resultItem}>
              <Text style={styles.resultLabel}>Confidence:</Text>
              <Text style={styles.resultValue}>
                {Math.round((job.result.confidence as number) * 100)}%
              </Text>
            </View>
          )}

          {job.result.date && (
            <View style={styles.resultItem}>
              <Text style={styles.resultLabel}>Event Date:</Text>
              <Text style={styles.resultValue}>
                {formatDetailedDate(job.result.date as string)}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderErrorSection = () => {
    if (!job?.error) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Error</Text>
        <View style={styles.jobErrorContainer}>
          <Text style={styles.jobErrorText}>{job.error}</Text>
        </View>
      </View>
    );
  };

  const renderEventLink = () => {
    if (!job?.result?.eventId) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Event Details</Text>
        <TouchableOpacity
          style={styles.eventLinkContainer}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push(`/details?eventId=${job.result!.eventId}`);
          }}
        >
          <View style={styles.eventLinkContent}>
            <Text style={styles.eventLinkText}>View Event Details</Text>
            <Ionicons name="chevron-forward" size={16} color="#007AFF" />
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  if (isLoading) {
    return (
      <AuthWrapper>
        <Screen
          bannerTitle="Job Details"
          showBackButton={true}
          onBack={() => router.back()}
        >
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading job details...</Text>
          </View>
        </Screen>
      </AuthWrapper>
    );
  }

  if (error || !job) {
    return (
      <AuthWrapper>
        <Screen
          bannerTitle="Job Details"
          showBackButton={true}
          onBack={() => router.back()}
        >
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error || "Job not found"}</Text>
          </View>
        </Screen>
      </AuthWrapper>
    );
  }

  const eventDetails = getEventDetails();

  return (
    <AuthWrapper>
      <Screen
        bannerTitle="Job Details"
        bannerEmoji={eventDetails?.emoji || "⚙️"}
        showBackButton={true}
        onBack={() => router.back()}
        isScrollable={false}
      >
        <ScrollView
          style={styles.container}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Section */}
          <View style={styles.headerSection}>
            <View style={styles.jobHeader}>
              <View style={styles.emojiContainer}>
                <Text style={styles.emoji}>{eventDetails?.emoji || "⚙️"}</Text>
              </View>
              <View style={styles.jobInfo}>
                <Text style={styles.jobTitle}>
                  {eventDetails?.title || getJobTypeDisplayName(job.type)}
                </Text>
                <View style={styles.jobMeta}>
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
                  <Text style={styles.jobType}>
                    {getJobTypeDisplayName(job.type)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Timestamps Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Timeline</Text>
            <View style={styles.timelineContainer}>
              <View style={styles.timelineItem}>
                <Text style={styles.timelineLabel}>Created:</Text>
                <Text style={styles.timelineValue}>
                  {formatDetailedDate(job.created)}
                </Text>
              </View>
              {job.updated && (
                <View style={styles.timelineItem}>
                  <Text style={styles.timelineLabel}>Last Updated:</Text>
                  <Text style={styles.timelineValue}>
                    {formatDetailedDate(job.updated)}
                  </Text>
                </View>
              )}
              {job.completed && (
                <View style={styles.timelineItem}>
                  <Text style={styles.timelineLabel}>Completed:</Text>
                  <Text style={styles.timelineValue}>
                    {formatDetailedDate(job.completed)}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Progress Section */}
          {renderProgressSection()}

          {/* Result Section */}
          {renderResultSection()}

          {/* Error Section */}
          {renderErrorSection()}

          {/* Event Link */}
          {renderEventLink()}
        </ScrollView>
      </Screen>
    </AuthWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "#6c757d",
    fontFamily: "SpaceMono",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 16,
    color: "#e74c3c",
    fontFamily: "SpaceMono",
    textAlign: "center",
  },
  jobErrorContainer: {
    backgroundColor: "#fdf2f2",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  jobErrorText: {
    fontSize: 14,
    color: "#dc2626",
    fontFamily: "SpaceMono",
    lineHeight: 20,
  },
  headerSection: {
    marginBottom: 24,
  },
  jobHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  emojiContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  emoji: {
    fontSize: 24,
  },
  jobInfo: {
    flex: 1,
  },
  jobTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#000",
    fontFamily: "SpaceMono",
    marginBottom: 8,
  },
  jobMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },
  jobType: {
    fontSize: 14,
    color: "#6c757d",
    fontFamily: "SpaceMono",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
    fontFamily: "SpaceMono",
    marginBottom: 12,
  },
  timelineContainer: {
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    padding: 16,
  },
  timelineItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  timelineLabel: {
    fontSize: 14,
    color: "#6c757d",
    fontFamily: "SpaceMono",
    fontWeight: "500",
  },
  timelineValue: {
    fontSize: 14,
    color: "#000",
    fontFamily: "SpaceMono",
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: "rgba(0, 0, 0, 0.1)",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
    fontFamily: "SpaceMono",
    minWidth: 40,
  },
  progressStep: {
    fontSize: 14,
    color: "#6c757d",
    fontFamily: "SpaceMono",
    marginBottom: 8,
  },
  progressDetails: {
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    padding: 12,
  },
  progressDetailsText: {
    fontSize: 13,
    color: "#6c757d",
    fontFamily: "SpaceMono",
    marginBottom: 4,
  },
  resultContainer: {
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    padding: 16,
  },
  resultMessage: {
    fontSize: 16,
    color: "#000",
    fontFamily: "SpaceMono",
    marginBottom: 12,
    lineHeight: 22,
  },
  resultItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  resultLabel: {
    fontSize: 14,
    color: "#6c757d",
    fontFamily: "SpaceMono",
    fontWeight: "500",
  },
  resultValue: {
    fontSize: 14,
    color: "#000",
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },
  eventLinkContainer: {
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    padding: 16,
  },
  eventLinkContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eventLinkText: {
    fontSize: 14,
    color: "#007AFF",
    fontFamily: "SpaceMono",
  },
});

export default JobDetailsScreen;
