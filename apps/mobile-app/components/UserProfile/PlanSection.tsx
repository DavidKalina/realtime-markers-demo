import { PlanType } from "@/services/ApiClient";
import { Crown, Zap } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Badge from "../Layout/Badge";
import Card from "../Layout/Card";

interface PlanSectionProps {
  planDetails: {
    planType: PlanType;
    weeklyScanCount: number;
    scanLimit: number;
    remainingScans: number;
    lastReset: Date | null;
  } | null;
  progressWidth: number;
}

const PlanSection: React.FC<PlanSectionProps> = ({
  planDetails,
  progressWidth,
}) => {
  const isPro = planDetails?.planType === PlanType.PRO;
  const planIcon = isPro ? (
    <Crown size={16} color="#fbbf24" />
  ) : (
    <Zap size={16} color="#93c5fd" />
  );

  return (
    <Card delay={350}>
      <View style={styles.planHeader}>
        <Badge
          label={planDetails?.planType || "FREE"}
          variant={isPro ? "pro" : "default"}
          icon={planIcon}
        />
      </View>
      <View style={styles.usageContainer}>
        <View style={styles.usageHeader}>
          <Text style={styles.usageLabel}>Weekly Scans</Text>
          <Text style={styles.usageCount}>
            {planDetails?.weeklyScanCount || 0} / {planDetails?.scanLimit || 10}
          </Text>
        </View>
        <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBar,
              {
                width: `${progressWidth}%`,
              },
            ]}
          />
        </View>
        <Text style={styles.usageNote}>
          {planDetails?.remainingScans || 0} scans remaining this week
        </Text>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  planHeader: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 16,
  },
  usageContainer: {
    padding: 16,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    borderRadius: 12,
  },
  usageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  usageLabel: {
    color: "#a0a0a0",
    fontSize: 14,
    fontFamily: "SpaceMono",
  },
  usageCount: {
    color: "#f8f9fa",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SpaceMono",
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#93c5fd",
    borderRadius: 4,
  },
  usageNote: {
    color: "#a0a0a0",
    fontSize: 12,
    fontFamily: "SpaceMono",
    marginTop: 8,
  },
});

export default PlanSection;
