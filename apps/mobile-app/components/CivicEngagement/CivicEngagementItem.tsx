import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import {
  CivicEngagement,
  CivicEngagementType,
  CivicEngagementStatus,
} from "@/services/ApiClient";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
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

export const CivicEngagementItem: React.FC<CivicEngagementItemProps> = ({
  civicEngagement,
  onPress,
  showLocation = true,
  showStatus = true,
}) => {
  const handlePress = () => {
    if (onPress) {
      onPress(civicEngagement);
    }
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <ThemedView style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.typeContainer}>
            <Text style={styles.typeIcon}>
              {getTypeIcon(civicEngagement.type)}
            </Text>
            <ThemedText
              style={[
                styles.typeText,
                { color: getTypeColor(civicEngagement.type) },
              ]}
            >
              {civicEngagement.type.replace("_", " ")}
            </ThemedText>
          </View>

          {showStatus && (
            <View style={styles.statusContainer}>
              {getStatusIcon(civicEngagement.status)}
              <ThemedText
                style={[
                  styles.statusText,
                  { color: getStatusColor(civicEngagement.status) },
                ]}
              >
                {getStatusText(civicEngagement.status)}
              </ThemedText>
            </View>
          )}
        </View>

        {/* Title */}
        <ThemedText style={styles.title} numberOfLines={2}>
          {civicEngagement.title}
        </ThemedText>

        {/* Description */}
        {civicEngagement.description && (
          <ThemedText style={styles.description} numberOfLines={2}>
            {civicEngagement.description}
          </ThemedText>
        )}

        {/* Location */}
        {showLocation && civicEngagement.address && (
          <View style={styles.locationContainer}>
            <MapPin size={12} color={COLORS.textSecondary} />
            <ThemedText style={styles.locationText} numberOfLines={1}>
              {civicEngagement.address}
            </ThemedText>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.dateContainer}>
            <Calendar size={12} color={COLORS.textSecondary} />
            <ThemedText style={styles.dateText}>
              {formatDistanceToNow(new Date(civicEngagement.createdAt))} ago
            </ThemedText>
          </View>

          {/* Show implemented date if available */}
          {civicEngagement.implementedAt && (
            <View style={styles.implementedContainer}>
              <CheckCircle size={12} color="#10b981" />
              <ThemedText
                style={[styles.implementedText, { color: "#10b981" }]}
              >
                Implemented{" "}
                {formatDistanceToNow(new Date(civicEngagement.implementedAt))}{" "}
                ago
              </ThemedText>
            </View>
          )}
        </View>
      </ThemedView>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  card: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  typeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  typeIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  typeText: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusText: {
    fontSize: 10,
    fontWeight: "500",
    marginLeft: 3,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
    lineHeight: 18,
  },
  description: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
    opacity: 0.8,
  },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  locationText: {
    fontSize: 11,
    marginLeft: 4,
    opacity: 0.7,
    flex: 1,
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
    fontSize: 10,
    marginLeft: 3,
    opacity: 0.6,
  },
  implementedContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  implementedText: {
    fontSize: 10,
    marginLeft: 3,
    fontWeight: "500",
  },
});
