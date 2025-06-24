import React, { useCallback, useMemo } from "react";
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import {
  CivicEngagement,
  CivicEngagementType,
  CivicEngagementStatus,
} from "@/services/ApiClient";
import { COLORS } from "@/components/Layout/ScreenLayout";
import {
  MapPin,
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
} from "lucide-react-native";

// Simple date formatting function
const formatDistanceToNow = (date: Date): string => {
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));

  if (diffInDays > 0) {
    return diffInDays === 1 ? "1 day" : `${diffInDays} days`;
  } else if (diffInHours > 0) {
    return diffInHours === 1 ? "1 hour" : `${diffInHours} hours`;
  } else if (diffInMinutes > 0) {
    return diffInMinutes === 1 ? "1 minute" : `${diffInMinutes} minutes`;
  } else {
    return "just now";
  }
};

// Helper function to format coordinates
const formatCoordinates = (coordinates: [number, number]): string => {
  const [lng, lat] = coordinates;
  return `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
};

interface CivicEngagementItemProps {
  civicEngagement: CivicEngagement;
  onPress?: (civicEngagement: CivicEngagement) => void;
  showLocation?: boolean;
  showStatus?: boolean;
}

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

const getStatusIcon = (status: CivicEngagementStatus) => {
  switch (status) {
    case CivicEngagementStatus.IMPLEMENTED:
      return <CheckCircle size={14} color="#10b981" />;
    case CivicEngagementStatus.IN_REVIEW:
      return <Clock size={14} color="#f59e0b" />;
    case CivicEngagementStatus.CLOSED:
      return <XCircle size={14} color="#ef4444" />;
    case CivicEngagementStatus.PENDING:
    default:
      return <Clock size={14} color={COLORS.textSecondary} />;
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

const getTypeBadgeColor = (type: CivicEngagementType) => {
  switch (type) {
    case CivicEngagementType.POSITIVE_FEEDBACK:
      return { background: "#D1FAE5", text: "#10b981" }; // green
    case CivicEngagementType.NEGATIVE_FEEDBACK:
      return { background: "#FEE2E2", text: "#ef4444" }; // red
    case CivicEngagementType.IDEA:
      return { background: "#DBEAFE", text: "#3b82f6" }; // blue
    default:
      return { background: COLORS.divider, text: COLORS.textSecondary };
  }
};

export const CivicEngagementItem: React.FC<CivicEngagementItemProps> =
  React.memo(
    ({ civicEngagement, onPress, showLocation = true, showStatus = true }) => {
      const handlePress = useCallback(() => {
        if (onPress) {
          onPress(civicEngagement);
        }
      }, [civicEngagement, onPress]);

      const styles = useMemo(
        () =>
          StyleSheet.create({
            container: {
              paddingVertical: 16,
              paddingHorizontal: 16,
              borderBottomWidth: 1,
              borderBottomColor: COLORS.divider,
            },
            content: {
              flex: 1,
            },
            header: {
              flexDirection: "row",
              alignItems: "flex-start",
            },
            emojiContainer: {
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: COLORS.textPrimary,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 12,
              borderWidth: 1,
              borderColor: COLORS.buttonBorder,
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
              color: COLORS.textPrimary,
              fontSize: 16,
              fontFamily: "Poppins-Regular",
              fontWeight: "600",
            },
            statusBadge: {
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: COLORS.buttonBorder,
              marginLeft: 8,
              flexDirection: "row",
              alignItems: "center",
            },
            statusBadgeText: {
              fontSize: 12,
              fontFamily: "Poppins-Regular",
              fontWeight: "600",
              marginLeft: 3,
            },
            description: {
              color: COLORS.textSecondary,
              fontSize: 14,
              fontFamily: "Poppins-Regular",
              lineHeight: 20,
              marginBottom: 4,
            },
            locationContainer: {
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 4,
            },
            locationText: {
              fontSize: 12,
              marginLeft: 4,
              color: COLORS.textSecondary,
              fontFamily: "Poppins-Regular",
            },
            footer: {
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            },
            dateContainer: {
              flexDirection: "row",
              alignItems: "center",
            },
            dateText: {
              fontSize: 12,
              marginLeft: 3,
              color: COLORS.textSecondary,
              fontFamily: "Poppins-Regular",
            },
            implementedContainer: {
              flexDirection: "row",
              alignItems: "center",
            },
            implementedText: {
              fontSize: 12,
              marginLeft: 3,
              fontWeight: "500",
              color: "#10b981",
              fontFamily: "Poppins-Regular",
            },
            typeBadge: {
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: COLORS.buttonBorder,
              marginRight: 8,
              flexDirection: "row",
              alignItems: "center",
            },
            typeBadgeText: {
              fontSize: 12,
              fontFamily: "Poppins-Regular",
              fontWeight: "600",
              marginLeft: 3,
            },
          }),
        [],
      );

      const typeBadgeColors = getTypeBadgeColor(civicEngagement.type);

      return (
        <TouchableOpacity
          style={styles.container}
          onPress={handlePress}
          activeOpacity={0.7}
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <View style={styles.emojiContainer}>
                <Text style={styles.emoji}>
                  {getTypeIcon(civicEngagement.type)}
                </Text>
              </View>
              <View style={styles.titleContainer}>
                <View style={styles.titleRow}>
                  <View
                    style={[
                      styles.typeBadge,
                      {
                        backgroundColor: typeBadgeColors.background,
                        borderColor: typeBadgeColors.text,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeBadgeText,
                        { color: typeBadgeColors.text },
                      ]}
                    >
                      {civicEngagement.type.replace("_", " ")}
                    </Text>
                  </View>
                  {showStatus && (
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor:
                            getStatusColor(civicEngagement.status) + "20",
                        },
                      ]}
                    >
                      {getStatusIcon(civicEngagement.status)}
                      <Text
                        style={[
                          styles.statusBadgeText,
                          { color: getStatusColor(civicEngagement.status) },
                        ]}
                      >
                        {getStatusText(civicEngagement.status)}
                      </Text>
                    </View>
                  )}
                </View>
                {civicEngagement.description && (
                  <Text style={styles.description} numberOfLines={2}>
                    {civicEngagement.description}
                  </Text>
                )}
                {showLocation &&
                  (civicEngagement.location?.coordinates ||
                    civicEngagement.address) && (
                    <View style={styles.locationContainer}>
                      <MapPin size={12} color={COLORS.textSecondary} />
                      <Text style={styles.locationText} numberOfLines={1}>
                        {civicEngagement.location?.coordinates
                          ? formatCoordinates(
                              civicEngagement.location.coordinates,
                            )
                          : civicEngagement.address}
                      </Text>
                    </View>
                  )}
                <View style={styles.footer}>
                  <View style={styles.dateContainer}>
                    <Calendar size={12} color={COLORS.textSecondary} />
                    <Text style={styles.dateText}>
                      {formatDistanceToNow(new Date(civicEngagement.createdAt))}{" "}
                      ago
                    </Text>
                  </View>

                  {civicEngagement.implementedAt && (
                    <View style={styles.implementedContainer}>
                      <CheckCircle size={12} color="#10b981" />
                      <Text style={styles.implementedText}>
                        Implemented{" "}
                        {formatDistanceToNow(
                          new Date(civicEngagement.implementedAt),
                        )}{" "}
                        ago
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      );
    },
  );

CivicEngagementItem.displayName = "CivicEngagementItem";
