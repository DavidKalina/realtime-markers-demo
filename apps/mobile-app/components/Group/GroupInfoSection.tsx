import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Globe, Users, MapPin } from "lucide-react-native";
import SectionHeader from "@/components/Layout/SectionHeader";
import { COLORS } from "@/components/Layout/ScreenLayout";

interface GroupInfoSectionProps {
  memberCount: number;
  visibility: string;
  address?: string;
}

export const GroupInfoSection: React.FC<GroupInfoSectionProps> = ({
  memberCount,
  visibility,
  address,
}) => {
  return (
    <View style={styles.section}>
      <SectionHeader icon={Globe} title="Group Info" />
      <View style={styles.detailsContainer}>
        <View style={styles.detailRow}>
          <View style={styles.detailIconContainer}>
            <Users size={18} color={COLORS.accent} />
          </View>
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Members</Text>
            <Text style={styles.detailValue}>{memberCount}</Text>
          </View>
        </View>
        <View style={styles.detailRow}>
          <View style={styles.detailIconContainer}>
            <Globe size={18} color={COLORS.accent} />
          </View>
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Visibility</Text>
            <Text style={styles.detailValue}>{visibility}</Text>
          </View>
        </View>
        {address && (
          <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
            <View style={styles.detailIconContainer}>
              <MapPin size={18} color={COLORS.accent} />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Location</Text>
              <Text style={styles.detailValue}>{address}</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  detailsContainer: {
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    borderRadius: 16,
    overflow: "hidden",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  detailIconContainer: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 10,
    marginRight: 12,
  },
  detailContent: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailLabel: {
    fontSize: 15,
    color: COLORS.textSecondary,
    fontFamily: "SpaceMono",
    letterSpacing: 0.2,
  },
  detailValue: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    fontWeight: "600",
    letterSpacing: 0.2,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
});
