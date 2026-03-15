import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  useColors,
  type Colors,
  fontSize,
  fontWeight,
  fontFamily,
  spacing,
  radius,
} from "@/theme";
import type { ProfileInsightsResponse } from "@/services/api/modules/profileInsights";

interface AdventureFootprintProps {
  footprint: ProfileInsightsResponse["footprint"];
}

const CITY_COLORS = [
  "#4ade80",
  "#60a5fa",
  "#fbbf24",
  "#a78bfa",
  "#f97316",
  "#f472b6",
  "#67e8f9",
];

const AdventureFootprint: React.FC<AdventureFootprintProps> = ({
  footprint,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const isEmpty =
    footprint.totalCheckins === 0 && footprint.totalCompletedItineraries === 0;

  return (
    <View>
      <Text style={styles.sectionLabel}>ADVENTURE FOOTPRINT</Text>
      <View style={styles.container}>
        {isEmpty ? (
          <Text style={styles.emptyHint}>
            Complete adventures to track your footprint
          </Text>
        ) : null}
        {/* Hero stats row */}
        <View style={styles.heroRow}>
          <View style={styles.heroStat}>
            <Text style={[styles.heroValue, { color: "#4ade80" }]}>
              {footprint.totalDistanceMiles > 0
                ? `${footprint.totalDistanceMiles}`
                : "0"}
            </Text>
            <Text style={styles.heroUnit}>miles</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStat}>
            <Text style={[styles.heroValue, { color: "#60a5fa" }]}>
              {footprint.totalUniqueVenues}
            </Text>
            <Text style={styles.heroUnit}>venues</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStat}>
            <Text style={[styles.heroValue, { color: "#fbbf24" }]}>
              {footprint.totalCompletedItineraries}
            </Text>
            <Text style={styles.heroUnit}>adventures</Text>
          </View>
        </View>

        {/* Detail stats */}
        <View style={styles.detailRow}>
          <View style={styles.detailItem}>
            <Text style={styles.detailValue}>
              {footprint.totalStopsVisited}
            </Text>
            <Text style={styles.detailLabel}>stops visited</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailValue}>
              {footprint.avgStopsPerItinerary}
            </Text>
            <Text style={styles.detailLabel}>avg per trip</Text>
          </View>
        </View>

        {/* City breakdown */}
        {footprint.cities.length > 0 && (
          <View style={styles.citiesSection}>
            <Text style={styles.citiesLabel}>CITIES</Text>
            <View style={styles.citiesList}>
              {footprint.cities.map((city, i) => {
                const color = CITY_COLORS[i % CITY_COLORS.length];
                const shortName = city.city.split(",")[0].trim();
                return (
                  <View key={city.city} style={styles.cityRow}>
                    <View style={styles.cityNameRow}>
                      <View
                        style={[styles.cityDot, { backgroundColor: color }]}
                      />
                      <Text style={styles.cityName}>{shortName}</Text>
                    </View>
                    <View style={styles.cityStats}>
                      <Text style={[styles.cityStat, { color }]}>
                        {city.completedCount}
                      </Text>
                      <Text style={styles.cityStatLabel}>trips</Text>
                      <Text style={styles.cityStatSep}>{"\u00B7"}</Text>
                      <Text style={[styles.cityStat, { color }]}>
                        {city.uniqueVenues}
                      </Text>
                      <Text style={styles.cityStatLabel}>venues</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    sectionLabel: {
      fontSize: 11,
      fontWeight: fontWeight.semibold,
      color: colors.text.label,
      fontFamily: fontFamily.mono,
      letterSpacing: 1.5,
      marginBottom: spacing.md,
    },
    container: {
      backgroundColor: colors.bg.elevated,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border.default,
      gap: spacing.md,
    },
    // Hero stats
    heroRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-around",
    },
    heroStat: {
      alignItems: "center",
      flex: 1,
    },
    heroValue: {
      fontSize: 24,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
    },
    heroUnit: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
      marginTop: 2,
    },
    heroDivider: {
      width: StyleSheet.hairlineWidth,
      height: 32,
      backgroundColor: colors.border.default,
    },
    // Detail row
    detailRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: spacing.xl,
    },
    detailItem: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 4,
    },
    detailValue: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
    },
    detailLabel: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
    // Cities
    citiesSection: {
      gap: spacing.sm,
    },
    citiesLabel: {
      fontSize: 9,
      fontWeight: fontWeight.semibold,
      color: colors.text.label,
      fontFamily: fontFamily.mono,
      letterSpacing: 1,
    },
    citiesList: {
      gap: spacing.xs,
    },
    cityRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    cityNameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    cityDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    cityName: {
      fontSize: 12,
      fontWeight: fontWeight.medium,
      fontFamily: fontFamily.mono,
      color: colors.text.primary,
    },
    cityStats: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 3,
    },
    cityStat: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      fontFamily: fontFamily.mono,
    },
    cityStatLabel: {
      fontSize: 10,
      fontFamily: fontFamily.mono,
      color: colors.text.secondary,
    },
    cityStatSep: {
      fontSize: 10,
      color: colors.text.label,
      marginHorizontal: 2,
    },
    emptyHint: {
      fontSize: 11,
      fontFamily: fontFamily.mono,
      color: colors.text.label,
      textAlign: "center",
    },
  });

export default AdventureFootprint;
