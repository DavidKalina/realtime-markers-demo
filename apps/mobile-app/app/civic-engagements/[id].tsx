import { AuthWrapper } from "@/components/AuthWrapper";
import Button from "@/components/Layout/Button";
import Screen from "@/components/Layout/Screen";
import { ThemedText } from "@/components/ThemedText";
import { useAuth } from "@/contexts/AuthContext";
import {
  apiClient,
  CivicEngagement,
  CivicEngagementStatus,
  CivicEngagementType,
} from "@/services/ApiClient";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Clock,
  MapPin,
  MessageSquare,
  Navigation2,
  User,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  ColorValue,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

// Municipal-friendly color scheme
const MUNICIPAL_COLORS = {
  primary: "#1e40af", // Professional blue
  secondary: "#059669", // Municipal green
  accent: "#f59e0b", // Warm amber
  background: "#f8fafc", // Light gray background
  card: "#ffffff", // White cards
  text: "#1e293b", // Dark slate text
  textSecondary: "#64748b", // Medium gray
  border: "#e2e8f0", // Light border
  success: "#10b981", // Green for success states
  warning: "#f59e0b", // Amber for warnings
  error: "#ef4444", // Red for errors
};

// Memoized helper functions
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
      return MUNICIPAL_COLORS.success;
    case CivicEngagementType.NEGATIVE_FEEDBACK:
      return MUNICIPAL_COLORS.error;
    case CivicEngagementType.IDEA:
      return MUNICIPAL_COLORS.primary;
    default:
      return MUNICIPAL_COLORS.textSecondary;
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
      return MUNICIPAL_COLORS.success;
    case CivicEngagementStatus.IN_REVIEW:
      return MUNICIPAL_COLORS.warning;
    case CivicEngagementStatus.CLOSED:
      return MUNICIPAL_COLORS.error;
    case CivicEngagementStatus.PENDING:
    default:
      return MUNICIPAL_COLORS.textSecondary;
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

// Memoized InfoCard component
const InfoCard = React.memo(
  ({
    children,
    title,
    icon: Icon,
  }: {
    children: React.ReactNode;
    title?: string;
    icon?: React.ComponentType<{
      size?: number | string;
      color?: ColorValue;
      strokeWidth?: number | string;
    }>;
  }) => (
    <View style={styles.infoCard}>
      {(title || Icon) && (
        <View style={styles.infoCardHeader}>
          {Icon && (
            <View style={styles.infoCardIcon}>
              <Icon
                size={18}
                color={MUNICIPAL_COLORS.primary}
                strokeWidth={2}
              />
            </View>
          )}
          {title && <Text style={styles.infoCardTitle}>{title}</Text>}
        </View>
      )}
      <View style={styles.infoCardContent}>{children}</View>
    </View>
  ),
);

// Memoized ActionButton component
const ActionButton = React.memo(
  ({
    onPress,
    icon: Icon,
    text,
    variant = "primary",
    disabled = false,
  }: {
    onPress: () => void;
    icon: React.ComponentType<{
      size?: number | string;
      color?: ColorValue;
      strokeWidth?: number | string;
    }>;
    text: string;
    variant?: "primary" | "secondary" | "outline" | "error";
    disabled?: boolean;
  }) => {
    const getButtonStyle = () => {
      switch (variant) {
        case "primary":
          return {
            backgroundColor: MUNICIPAL_COLORS.primary,
            borderColor: MUNICIPAL_COLORS.primary,
            textColor: "#ffffff",
          };
        case "secondary":
          return {
            backgroundColor: MUNICIPAL_COLORS.secondary,
            borderColor: MUNICIPAL_COLORS.secondary,
            textColor: "#ffffff",
          };
        case "outline":
          return {
            backgroundColor: "transparent",
            borderColor: MUNICIPAL_COLORS.border,
            textColor: MUNICIPAL_COLORS.text,
          };
        case "error":
          return {
            backgroundColor: MUNICIPAL_COLORS.error,
            borderColor: MUNICIPAL_COLORS.error,
            textColor: "#ffffff",
          };
        default:
          return {
            backgroundColor: MUNICIPAL_COLORS.primary,
            borderColor: MUNICIPAL_COLORS.primary,
            textColor: "#ffffff",
          };
      }
    };

    const buttonStyle = getButtonStyle();

    return (
      <TouchableOpacity
        style={[
          styles.actionButton,
          {
            backgroundColor: buttonStyle.backgroundColor,
            borderColor: buttonStyle.borderColor,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.8}
      >
        <Icon size={20} color={buttonStyle.textColor} strokeWidth={2} />
        <Text
          style={[styles.actionButtonText, { color: buttonStyle.textColor }]}
        >
          {text}
        </Text>
      </TouchableOpacity>
    );
  },
);

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

  const handleOpenMaps = useCallback(() => {
    if (!civicEngagement?.address) return;

    // For iOS, you might want to use Apple Maps
    // const url = `https://maps.apple.com/?address=${encodeURIComponent(civicEngagement.address)}`;

    // For Android, you might want to use Google Maps
    // const url = `https://maps.google.com/?q=${encodeURIComponent(civicEngagement.address)}`;

    // Linking.openURL(url);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [civicEngagement?.address]);

  const isOwner = civicEngagement?.creatorId === user?.id;

  // Memoize computed values
  const formattedCreatedDate = useMemo(() => {
    if (!civicEngagement?.createdAt) return "";
    return formatDate(civicEngagement.createdAt);
  }, [civicEngagement?.createdAt]);

  const formattedImplementedDate = useMemo(() => {
    if (!civicEngagement?.implementedAt) return "";
    return formatDate(civicEngagement.implementedAt);
  }, [civicEngagement?.implementedAt]);

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

  // Prepare footer buttons
  const footerButtons = isOwner
    ? [
        {
          label: "Edit",
          onPress: handleEdit,
          variant: "primary" as const,
          style: { flex: 1, marginRight: 8 },
        },
        {
          label: "Delete",
          onPress: handleDelete,
          variant: "error" as const,
          style: { flex: 1, marginLeft: 8 },
        },
      ]
    : [];

  return (
    <AuthWrapper>
      <Screen
        bannerTitle="Civic Engagement"
        showBackButton
        onBack={handleBack}
        noAnimation
        footerButtons={footerButtons}
        contentStyle={{ paddingBottom: 32 }}
      >
        <ScrollView
          style={styles.container}
          showsVerticalScrollIndicator={false}
        >
          {/* Title and Type Section */}
          <Animated.View
            entering={FadeInDown.duration(600).delay(300).springify()}
            style={styles.titleSection}
          >
            <Text style={styles.engagementTitle}>{civicEngagement.title}</Text>

            {/* Type and Status Badge */}
            <View style={styles.badgeContainer}>
              <View
                style={[
                  styles.typeBadge,
                  {
                    backgroundColor: getTypeColor(civicEngagement.type) + "20",
                  },
                ]}
              >
                <Text style={styles.typeEmoji}>
                  {getTypeIcon(civicEngagement.type)}
                </Text>
                <Text
                  style={[
                    styles.typeText,
                    { color: getTypeColor(civicEngagement.type) },
                  ]}
                >
                  {civicEngagement.type.replace("_", " ")}
                </Text>
              </View>

              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor:
                      getStatusColor(civicEngagement.status) + "20",
                  },
                ]}
              >
                <Text style={styles.statusEmoji}>
                  {getStatusIcon(civicEngagement.status)}
                </Text>
                <Text
                  style={[
                    styles.statusText,
                    { color: getStatusColor(civicEngagement.status) },
                  ]}
                >
                  {getStatusText(civicEngagement.status)}
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* Details Cards */}
          <Animated.View
            entering={FadeInDown.duration(600).delay(400).springify()}
            style={styles.detailsSection}
          >
            {/* Description Card */}
            {civicEngagement.description && (
              <InfoCard title="Description" icon={MessageSquare}>
                <Text style={styles.descriptionText}>
                  {civicEngagement.description}
                </Text>
              </InfoCard>
            )}

            {/* Location Card */}
            {civicEngagement.address && (
              <InfoCard title="Location" icon={MapPin}>
                <TouchableOpacity
                  style={styles.detailRow}
                  onPress={handleOpenMaps}
                  activeOpacity={0.7}
                >
                  <View style={styles.locationContent}>
                    <Text style={styles.detailText}>
                      {civicEngagement.address}
                    </Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.mapCardFooter}>
                  <ActionButton
                    onPress={handleOpenMaps}
                    icon={Navigation2}
                    text="Open in Maps"
                    variant="outline"
                  />
                </View>
              </InfoCard>
            )}

            {/* Location Notes Card */}
            {civicEngagement.locationNotes && (
              <InfoCard title="Location Notes" icon={MapPin}>
                <Text style={styles.notesText}>
                  {civicEngagement.locationNotes}
                </Text>
              </InfoCard>
            )}

            {/* Timeline Card */}
            <InfoCard title="Timeline" icon={Clock}>
              <View style={styles.timelineContainer}>
                <View style={styles.timelineItem}>
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineLabel}>Created</Text>
                    <Text style={styles.timelineDate}>
                      {formattedCreatedDate}
                    </Text>
                  </View>
                </View>

                {civicEngagement.implementedAt && (
                  <View style={styles.timelineItem}>
                    <View style={styles.timelineContent}>
                      <Text
                        style={[
                          styles.timelineLabel,
                          { color: MUNICIPAL_COLORS.success },
                        ]}
                      >
                        Implemented
                      </Text>
                      <Text
                        style={[
                          styles.timelineDate,
                          { color: MUNICIPAL_COLORS.success },
                        ]}
                      >
                        {formattedImplementedDate}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </InfoCard>

            {/* Creator Information */}
            {civicEngagement.creator && (
              <InfoCard title="Submitted By" icon={User}>
                <View style={styles.creatorContainer}>
                  <Text style={styles.creatorText}>
                    {(() => {
                      if (
                        civicEngagement.creator?.firstName &&
                        civicEngagement.creator?.lastName
                      ) {
                        return `${civicEngagement.creator.firstName} ${civicEngagement.creator.lastName}`;
                      } else if (civicEngagement.creator?.firstName) {
                        return civicEngagement.creator.firstName;
                      } else if (civicEngagement.creator?.lastName) {
                        return civicEngagement.creator.lastName;
                      } else if (civicEngagement.creator?.email) {
                        return civicEngagement.creator.email;
                      }
                      return "Anonymous User";
                    })()}
                  </Text>
                </View>
              </InfoCard>
            )}
          </Animated.View>
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
  titleSection: {
    marginBottom: 24,
  },
  engagementTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: MUNICIPAL_COLORS.text,
    lineHeight: 32,
    marginBottom: 16,
  },
  badgeContainer: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "transparent",
  },
  typeEmoji: {
    fontSize: 16,
    marginRight: 6,
  },
  typeText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "transparent",
  },
  statusEmoji: {
    fontSize: 14,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  detailsSection: {
    gap: 16,
  },
  infoCard: {
    backgroundColor: MUNICIPAL_COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: MUNICIPAL_COLORS.border,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  infoCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  infoCardIcon: {
    marginRight: 8,
  },
  infoCardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: MUNICIPAL_COLORS.text,
  },
  infoCardContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  descriptionText: {
    fontSize: 16,
    lineHeight: 24,
    color: MUNICIPAL_COLORS.text,
    opacity: 0.9,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  locationContent: {
    flex: 1,
    marginLeft: 8,
  },
  detailText: {
    fontSize: 14,
    color: MUNICIPAL_COLORS.text,
    lineHeight: 20,
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20,
    color: MUNICIPAL_COLORS.text,
    opacity: 0.8,
  },
  mapCardFooter: {
    marginTop: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  timelineContainer: {
    gap: 16,
  },
  timelineItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  timelineContent: {
    flex: 1,
    marginLeft: 12,
  },
  timelineLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: MUNICIPAL_COLORS.text,
    marginBottom: 2,
  },
  timelineDate: {
    fontSize: 14,
    color: MUNICIPAL_COLORS.textSecondary,
  },
  creatorContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  creatorText: {
    fontSize: 14,
    color: MUNICIPAL_COLORS.text,
    marginLeft: 8,
    fontWeight: "500",
  },
});

export default CivicEngagementDetails;
