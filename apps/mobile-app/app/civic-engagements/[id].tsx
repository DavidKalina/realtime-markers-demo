import React, { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View, StyleSheet, Alert, ScrollView } from "react-native";
import * as Haptics from "expo-haptics";
import { MapPin, Calendar } from "lucide-react-native";
import Screen from "@/components/Layout/Screen";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { COLORS } from "@/components/Layout/ScreenLayout";
import {
  apiClient,
  CivicEngagement,
  CivicEngagementType,
  CivicEngagementStatus,
} from "@/services/ApiClient";
import { AuthWrapper } from "@/components/AuthWrapper";
import { useAuth } from "@/contexts/AuthContext";
import Button from "@/components/Layout/Button";

const getTypeIcon = (type: CivicEngagementType) => {
  switch (type) {
    case CivicEngagementType.POSITIVE_FEEDBACK:
      return "👍";
    case CivicEngagementType.NEGATIVE_FEEDBACK:
      return "👎";
    case CivicEngagementType.IDEA:
      return "💡";
    default:
      return "📝";
  }
};

const getTypeColor = (type: CivicEngagementType) => {
  switch (type) {
    case CivicEngagementType.POSITIVE_FEEDBACK:
      return "#10b981"; // green
    case CivicEngagementType.NEGATIVE_FEEDBACK:
      return "#ef4444"; // red
    case CivicEngagementType.IDEA:
      return "#3b82f6"; // blue
    default:
      return COLORS.textSecondary;
  }
};

const getStatusIcon = (status: CivicEngagementStatus) => {
  switch (status) {
    case CivicEngagementStatus.IMPLEMENTED:
      return "✅";
    case CivicEngagementStatus.IN_REVIEW:
      return "⏳";
    case CivicEngagementStatus.CLOSED:
      return "❌";
    case CivicEngagementStatus.PENDING:
    default:
      return "⏱️";
  }
};

const getStatusText = (status: CivicEngagementStatus) => {
  switch (status) {
    case CivicEngagementStatus.IMPLEMENTED:
      return "Implemented";
    case CivicEngagementStatus.IN_REVIEW:
      return "In Review";
    case CivicEngagementStatus.CLOSED:
      return "Closed";
    case CivicEngagementStatus.PENDING:
    default:
      return "Pending";
  }
};

const getStatusColor = (status: CivicEngagementStatus) => {
  switch (status) {
    case CivicEngagementStatus.IMPLEMENTED:
      return "#10b981"; // green
    case CivicEngagementStatus.IN_REVIEW:
      return "#f59e0b"; // orange
    case CivicEngagementStatus.CLOSED:
      return "#ef4444"; // red
    case CivicEngagementStatus.PENDING:
    default:
      return COLORS.textSecondary;
  }
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const CivicEngagementDetails = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const [civicEngagement, setCivicEngagement] =
    useState<CivicEngagement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const civicEngagementId = params.id as string;

  useEffect(() => {
    if (civicEngagementId) {
      loadCivicEngagement();
    }
  }, [civicEngagementId]);

  const loadCivicEngagement = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response =
        await apiClient.civicEngagements.getCivicEngagementById(
          civicEngagementId,
        );

      if (response) {
        setCivicEngagement(response);
      } else {
        setError("Failed to load civic engagement");
      }
    } catch (err) {
      console.error("Error loading civic engagement:", err);
      setError("Failed to load civic engagement");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handleEdit = useCallback(() => {
    if (!civicEngagement) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: "/create-civic-engagement" as const,
      params: {
        id: civicEngagement.id,
        title: civicEngagement.title,
        description: civicEngagement.description,
        type: civicEngagement.type,
      },
    });
  }, [civicEngagement, router]);

  const handleDelete = useCallback(() => {
    if (!civicEngagement) return;

    Alert.alert(
      "Delete Civic Engagement",
      "Are you sure you want to delete this civic engagement? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await apiClient.civicEngagements.deleteCivicEngagement(
                civicEngagement.id,
              );
              Alert.alert("Success", "Civic engagement deleted successfully", [
                {
                  text: "OK",
                  onPress: () => router.back(),
                },
              ]);
            } catch (err) {
              console.error("Error deleting civic engagement:", err);
              Alert.alert("Error", "Failed to delete civic engagement");
            }
          },
        },
      ],
    );
  }, [civicEngagement, router]);

  const isOwner = civicEngagement?.creatorId === user?.id;

  if (isLoading) {
    return (
      <AuthWrapper>
        <Screen
          bannerTitle="Civic Engagement"
          showBackButton
          onBack={handleBack}
          noAnimation
        >
          <View style={styles.loadingContainer}>
            <ThemedText>Loading...</ThemedText>
          </View>
        </Screen>
      </AuthWrapper>
    );
  }

  if (error || !civicEngagement) {
    return (
      <AuthWrapper>
        <Screen
          bannerTitle="Civic Engagement"
          showBackButton
          onBack={handleBack}
          noAnimation
        >
          <View style={styles.errorContainer}>
            <ThemedText style={styles.errorText}>
              {error || "Civic engagement not found"}
            </ThemedText>
            <Button
              title="Retry"
              onPress={loadCivicEngagement}
              variant="primary"
            />
          </View>
        </Screen>
      </AuthWrapper>
    );
  }

  return (
    <AuthWrapper>
      <Screen
        bannerTitle="Civic Engagement"
        showBackButton
        onBack={handleBack}
        noAnimation
        footerButtons={
          isOwner
            ? [
                {
                  label: "Edit",
                  onPress: handleEdit,
                  variant: "primary",
                  style: { flex: 1, marginRight: 8 },
                },
                {
                  label: "Delete",
                  onPress: handleDelete,
                  variant: "error",
                  style: { flex: 1, marginLeft: 8 },
                },
              ]
            : []
        }
        contentStyle={{ paddingBottom: 32 }}
      >
        <ScrollView
          style={styles.container}
          showsVerticalScrollIndicator={false}
        >
          <ThemedView style={styles.card}>
            {/* Header with type and status */}
            <View style={styles.header}>
              <View style={styles.typeContainer}>
                <ThemedText style={styles.typeIcon}>
                  {getTypeIcon(civicEngagement.type)}
                </ThemedText>
                <ThemedText
                  style={[
                    styles.typeText,
                    { color: getTypeColor(civicEngagement.type) },
                  ]}
                >
                  {civicEngagement.type.replace("_", " ")}
                </ThemedText>
              </View>

              <View style={styles.statusContainer}>
                <ThemedText style={styles.statusIcon}>
                  {getStatusIcon(civicEngagement.status)}
                </ThemedText>
                <ThemedText
                  style={[
                    styles.statusText,
                    { color: getStatusColor(civicEngagement.status) },
                  ]}
                >
                  {getStatusText(civicEngagement.status)}
                </ThemedText>
              </View>
            </View>

            {/* Title */}
            <ThemedText style={styles.title}>
              {civicEngagement.title}
            </ThemedText>

            {/* Description */}
            {civicEngagement.description && (
              <ThemedText style={styles.description}>
                {civicEngagement.description}
              </ThemedText>
            )}

            {/* Location */}
            {civicEngagement.address && (
              <View style={styles.infoRow}>
                <MapPin size={16} color={COLORS.textSecondary} />
                <ThemedText style={styles.infoText}>
                  {civicEngagement.address}
                </ThemedText>
              </View>
            )}

            {/* Created date */}
            <View style={styles.infoRow}>
              <Calendar size={16} color={COLORS.textSecondary} />
              <ThemedText style={styles.infoText}>
                Created {formatDate(civicEngagement.createdAt)}
              </ThemedText>
            </View>

            {/* Implemented date */}
            {civicEngagement.implementedAt && (
              <View style={styles.infoRow}>
                <Calendar size={16} color="#10b981" />
                <ThemedText style={[styles.infoText, { color: "#10b981" }]}>
                  Implemented {formatDate(civicEngagement.implementedAt)}
                </ThemedText>
              </View>
            )}

            {/* Location notes */}
            {civicEngagement.locationNotes && (
              <View style={styles.notesContainer}>
                <ThemedText style={styles.notesLabel}>
                  Location Notes:
                </ThemedText>
                <ThemedText style={styles.notesText}>
                  {civicEngagement.locationNotes}
                </ThemedText>
              </View>
            )}
          </ThemedView>
        </ScrollView>
      </Screen>
    </AuthWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: "center",
  },
  card: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  typeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  typeIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  typeText: {
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "500",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
    lineHeight: 26,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
    opacity: 0.8,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  notesContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
  },
});

export default CivicEngagementDetails;
