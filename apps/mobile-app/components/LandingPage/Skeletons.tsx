import React, { useMemo } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import ShimmerView from "@/components/Layout/ShimmerView";
import { useColors, radius, spacing, type Colors } from "@/theme";

const { width: screenWidth } = Dimensions.get("window");
const CAROUSEL_WIDTH = screenWidth * 0.85;
const CAROUSEL_MARGIN = (screenWidth - CAROUSEL_WIDTH) / 2;

/* ─── ThirdSpaceScoreHero skeleton ─── */
export const ScoreHeroSkeleton: React.FC = () => {
  const colors = useColors();
  const sk = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={sk.heroContainer}>
      <View style={sk.heroHeaderRow}>
        <View style={sk.heroCityBlock}>
          <ShimmerView style={sk.heroCityLine} />
          <ShimmerView style={sk.heroLabelLine} />
        </View>
        <ShimmerView style={sk.heroMomentum} />
      </View>
      <View style={sk.heroTopRow}>
        <ShimmerView style={sk.heroCircle} />
        <View style={sk.heroStatsCol}>
          {Array.from({ length: 5 }).map((_, i) => (
            <View key={i} style={sk.heroStatRow}>
              <ShimmerView style={sk.heroStatLabel} />
              <ShimmerView style={sk.heroStatValue} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

/* ─── ContributorsSection skeleton ─── */
export const ContributorsSkeleton: React.FC = () => {
  const colors = useColors();
  const sk = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={sk.contribContainer}>
      <ShimmerView style={sk.sectionTitleLine} />
      <ShimmerView style={sk.sectionSubtitleLine} />
      <View style={sk.contribList}>
        {Array.from({ length: 5 }).map((_, i) => (
          <View key={i} style={[sk.contribRow, i === 4 && sk.contribRowLast]}>
            <ShimmerView style={sk.contribRank} />
            <ShimmerView style={sk.contribAvatar} />
            <View style={{ flex: 1, gap: 2 }}>
              <ShimmerView style={sk.contribName} />
              <ShimmerView style={sk.contribMeta} />
            </View>
            <ShimmerView style={sk.contribScore} />
          </View>
        ))}
      </View>
    </View>
  );
};

/* ─── TopEventsSection skeleton ─── */
export const TopEventsSkeleton: React.FC = () => {
  const colors = useColors();
  const sk = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={sk.topContainer}>
      <View style={sk.topHeaderRow}>
        <ShimmerView style={sk.topIcon} />
        <ShimmerView style={sk.topTitleLine} />
      </View>
      {Array.from({ length: 5 }).map((_, i) => (
        <View key={i} style={sk.topItem}>
          <ShimmerView style={sk.topRank} />
          <View style={{ flex: 1, gap: 2 }}>
            <ShimmerView style={sk.topName} />
            <ShimmerView style={sk.topMeta} />
          </View>
        </View>
      ))}
    </View>
  );
};

/* ─── List skeleton (HappeningToday / WeeklyRegulars) ─── */
export const ListSkeleton: React.FC = () => {
  const colors = useColors();
  const sk = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={sk.topContainer}>
      <View style={sk.topHeaderRow}>
        <ShimmerView style={sk.topIcon} />
        <ShimmerView style={{ width: 110, height: 12, borderRadius: 3 }} />
      </View>
      {Array.from({ length: 3 }).map((_, i) => (
        <View key={i} style={sk.topItem}>
          <ShimmerView style={{ width: 56, height: 18, borderRadius: 4 }} />
          <View style={{ flex: 1, gap: 2 }}>
            <ShimmerView style={sk.topName} />
            <ShimmerView style={sk.topMeta} />
          </View>
        </View>
      ))}
    </View>
  );
};

/* ─── Carousel skeleton (WhatsHappening / Featured) ─── */
export const CarouselSkeleton: React.FC<{ title: string }> = ({ title }) => {
  const colors = useColors();
  const sk = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={sk.carouselContainer}>
      <ShimmerView style={sk.sectionTitleLine} />
      {title === "What's Happening" && (
        <ShimmerView style={sk.sectionSubtitleLine} />
      )}
      <View style={sk.carouselScroll}>
        <View style={sk.carouselCard}>
          <View style={sk.carouselCardBody}>
            <View style={sk.carouselHeader}>
              <ShimmerView style={sk.carouselDot} />
              <ShimmerView style={sk.carouselKind} />
            </View>
            <ShimmerView style={sk.carouselTitle} />
            <ShimmerView style={sk.carouselMetaLine} />
          </View>
        </View>
      </View>
      <View style={sk.carouselPagination}>
        <ShimmerView style={sk.carouselDotActive} />
        <ShimmerView style={sk.carouselDotInactive} />
        <ShimmerView style={sk.carouselDotInactive} />
      </View>
    </View>
  );
};

/* ─── Skeleton styles matched to real component dimensions ─── */
const createStyles = (colors: Colors) =>
  StyleSheet.create({
    /* ThirdSpaceScoreHero — measured: 385×220, inner width 353 */
    heroContainer: {
      height: 220,
      marginBottom: spacing["3xl"],
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
    },
    heroHeaderRow: {
      height: 47,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    heroCityBlock: { width: 125, height: 47 },
    heroCityLine: { width: 120, height: 22, borderRadius: 4 },
    heroLabelLine: { width: 140, height: 14, borderRadius: 4, marginTop: 4 },
    heroMomentum: { width: 80, height: 14, borderRadius: 4 },
    heroTopRow: {
      height: 121,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.lg,
    },
    heroCircle: { width: 120, height: 120, borderRadius: 60 },
    heroStatsCol: { flex: 1, gap: spacing.xs },
    heroStatRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    heroStatLabel: { width: 70, height: 11, borderRadius: 3 },
    heroStatValue: { width: 24, height: 14, borderRadius: 3 },

    /* ContributorsSection — matches container: marginBottom 24 */
    contribContainer: { marginBottom: spacing["2xl"] },
    sectionTitleLine: {
      width: 100,
      height: 12,
      borderRadius: 3,
      marginBottom: spacing.xs,
      marginHorizontal: spacing.lg,
    },
    sectionSubtitleLine: {
      width: 160,
      height: 12,
      borderRadius: 3,
      marginBottom: spacing.sm,
      marginHorizontal: spacing.lg,
    },
    contribList: {
      marginHorizontal: CAROUSEL_MARGIN,
      backgroundColor: "rgba(255, 255, 255, 0.03)",
      borderRadius: radius.lg,
      overflow: "hidden",
    },
    contribRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      gap: spacing._10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border.default,
    },
    contribRowLast: { borderBottomWidth: 0 },
    contribRank: { width: 20, height: 12, borderRadius: 3 },
    contribAvatar: { width: 24, height: 24, borderRadius: 12 },
    contribName: { width: "60%", height: 13, borderRadius: 3 },
    contribMeta: { width: "40%", height: 11, borderRadius: 3 },
    contribScore: { width: 24, height: 13, borderRadius: 3 },

    /* TopEventsSection — matches container: marginBottom 24, paddingHorizontal 16 */
    topContainer: {
      marginBottom: spacing["2xl"],
      paddingHorizontal: spacing.lg,
    },
    topHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      marginBottom: spacing.md,
    },
    topIcon: { width: 14, height: 14, borderRadius: 3 },
    topTitleLine: { width: 80, height: 12, borderRadius: 3 },
    topItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.sm + 2,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.default,
    },
    topRank: { width: 24, height: 24, borderRadius: 12 },
    topName: { width: "70%", height: 14, borderRadius: 3 },
    topMeta: { width: "40%", height: 10, borderRadius: 3 },

    /* Carousel skeleton — matches WhatsHappening / Featured layout */
    carouselContainer: { marginBottom: spacing["2xl"] },
    carouselScroll: { paddingHorizontal: CAROUSEL_MARGIN },
    carouselCard: {
      width: CAROUSEL_WIDTH,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border.default,
      overflow: "hidden",
    },
    carouselCardBody: {
      padding: spacing.md,
      gap: spacing.xs,
    },
    carouselHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    carouselDot: { width: 6, height: 6, borderRadius: 3 },
    carouselKind: { width: 60, height: 10, borderRadius: 3 },
    carouselTitle: { width: "80%", height: 14, borderRadius: 3 },
    carouselMetaLine: { width: "50%", height: 11, borderRadius: 3 },
    carouselPagination: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      marginTop: spacing.sm,
      gap: spacing.xs,
    },
    carouselDotActive: {
      width: 24,
      height: 8,
      borderRadius: 4,
    },
    carouselDotInactive: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
  });
