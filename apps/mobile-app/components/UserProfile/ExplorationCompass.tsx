/**
 * ExplorationCompass — directional coverage gaps rendered as a
 * compass rose. Shows which directions the user has explored vs
 * where gaps exist, along with exploration profile label.
 */

import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import {
  fontFamily,
  fontWeight,
  spacing,
  useColors,
  type Colors,
} from "@/theme";

const GREEN = "#86efac";
const AMBER = "#fbbf24";

// ── Types ──────────────────────────────────────────────────────

export interface DirectionalGap {
  direction: string;
  angleDeg: number;
  gapWidthDeg: number;
}

export type ExplorationProfile =
  | "early_explorer"
  | "depth_focused"
  | "breadth_focused"
  | "well_rounded";

export interface ExplorationCompassProps {
  gaps: DirectionalGap[];
  explorationProfile: ExplorationProfile;
  coveragePct: number;
  territorySqMiles: number;
  clusterCount: number;
}

// ── Config ─────────────────────────────────────────────────────

const PROFILE_CONFIG: Record<
  ExplorationProfile,
  { label: string; description: string; color: string }
> = {
  early_explorer: {
    label: "EARLY EXPLORER",
    description: "Just beginning to map your territory",
    color: AMBER,
  },
  depth_focused: {
    label: "DEPTH FOCUSED",
    description: "You know your spots well — try branching out",
    color: "#c4b5fd",
  },
  breadth_focused: {
    label: "BREADTH FOCUSED",
    description: "Wide coverage — consider revisiting favorites",
    color: "#93c5fd",
  },
  well_rounded: {
    label: "WELL ROUNDED",
    description: "Balanced exploration across your territory",
    color: GREEN,
  },
};

const COMPASS_SIZE = 140;
const CENTER = COMPASS_SIZE / 2;
const OUTER_R = 56;
const INNER_R = 20;

const CARDINALS = [
  { label: "N", angle: -90 },
  { label: "E", angle: 0 },
  { label: "S", angle: 90 },
  { label: "W", angle: 180 },
];

// ── Helpers ────────────────────────────────────────────────────

function polarToXY(angleDeg: number, r: number): [number, number] {
  const rad = (angleDeg * Math.PI) / 180;
  return [CENTER + r * Math.cos(rad), CENTER + r * Math.sin(rad)];
}

function arcPath(startDeg: number, widthDeg: number, r: number): string {
  const start = polarToXY(startDeg - 90, r);
  const end = polarToXY(startDeg - 90 + widthDeg, r);
  const largeArc = widthDeg > 180 ? 1 : 0;
  return `M ${start[0]} ${start[1]} A ${r} ${r} 0 ${largeArc} 1 ${end[0]} ${end[1]}`;
}

// ── Component ──────────────────────────────────────────────────

function ExplorationCompass({
  gaps,
  explorationProfile,
  coveragePct,
  territorySqMiles,
  clusterCount,
}: ExplorationCompassProps) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);
  const profile = PROFILE_CONFIG[explorationProfile];

  return (
    <View style={s.container}>
      <Text style={s.sectionLabel}>TERRITORY</Text>

      <View style={s.card}>
        <View style={s.compassRow}>
          {/* SVG Compass */}
          <Svg width={COMPASS_SIZE} height={COMPASS_SIZE}>
            {/* Concentric rings */}
            <Circle cx={CENTER} cy={CENTER} r={OUTER_R} stroke="rgba(255, 255, 255, 0.06)" strokeWidth={1} fill="none" />
            <Circle cx={CENTER} cy={CENTER} r={OUTER_R * 0.66} stroke="rgba(255, 255, 255, 0.04)" strokeWidth={0.5} fill="none" />
            <Circle cx={CENTER} cy={CENTER} r={OUTER_R * 0.33} stroke="rgba(255, 255, 255, 0.03)" strokeWidth={0.5} fill="none" />

            {/* Cardinal tick marks */}
            {CARDINALS.map((c) => {
              const [ox, oy] = polarToXY(c.angle, OUTER_R + 2);
              const [ix, iy] = polarToXY(c.angle, OUTER_R - 4);
              const [tx, ty] = polarToXY(c.angle, OUTER_R + 12);
              return (
                <React.Fragment key={c.label}>
                  <Line x1={ix} y1={iy} x2={ox} y2={oy} stroke="rgba(255, 255, 255, 0.15)" strokeWidth={1} />
                  <SvgText
                    x={tx}
                    y={ty}
                    fill="rgba(255, 255, 255, 0.25)"
                    fontSize={8}
                    fontFamily="SpaceMono"
                    textAnchor="middle"
                    alignmentBaseline="central"
                  >
                    {c.label}
                  </SvgText>
                </React.Fragment>
              );
            })}

            {/* Coverage arcs (filled = explored) — draw as full circle, then overlay gaps */}
            <Circle cx={CENTER} cy={CENTER} r={OUTER_R - 8} stroke={`${GREEN}30`} strokeWidth={10} fill="none" />

            {/* Gap arcs */}
            {gaps.map((gap, i) => (
              <Path
                key={i}
                d={arcPath(gap.angleDeg, gap.gapWidthDeg, OUTER_R - 8)}
                stroke={`${AMBER}60`}
                strokeWidth={10}
                fill="none"
                strokeLinecap="round"
              />
            ))}

            {/* Center dot */}
            <Circle cx={CENTER} cy={CENTER} r={3} fill={GREEN} opacity={0.6} />
          </Svg>

          {/* Profile info */}
          <View style={s.profileColumn}>
            <View style={[s.profileBadge, { borderColor: `${profile.color}44` }]}>
              <Text style={[s.profileLabel, { color: profile.color }]}>
                {profile.label}
              </Text>
            </View>
            <Text style={s.profileDesc}>{profile.description}</Text>

            <View style={s.profileStats}>
              <View style={s.pStat}>
                <Text style={s.pStatValue}>{coveragePct}%</Text>
                <Text style={s.pStatLabel}>COVERAGE</Text>
              </View>
              <View style={s.pStat}>
                <Text style={s.pStatValue}>{territorySqMiles.toFixed(1)}</Text>
                <Text style={s.pStatLabel}>SQ MI</Text>
              </View>
              <View style={s.pStat}>
                <Text style={s.pStatValue}>{clusterCount}</Text>
                <Text style={s.pStatLabel}>CLUSTERS</Text>
              </View>
            </View>

            {gaps.length > 0 && (
              <Text style={s.gapHint}>
                {gaps.length} gap{gaps.length !== 1 ? "s" : ""} detected{" "}
                {gaps.map((g) => g.direction).join(", ")}
              </Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      gap: spacing.sm,
    },
    sectionLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 9,
      fontWeight: fontWeight.bold,
      color: colors.text.disabled,
      letterSpacing: 1.5,
      marginBottom: spacing.xs,
    },
    card: {
      backgroundColor: "rgba(255, 255, 255, 0.02)",
      borderRadius: 6,
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.04)",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    compassRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    profileColumn: {
      flex: 1,
      gap: spacing.sm,
    },
    profileBadge: {
      borderWidth: 1,
      borderRadius: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      alignSelf: "flex-start",
    },
    profileLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 8,
      fontWeight: fontWeight.bold,
      letterSpacing: 1,
    },
    profileDesc: {
      fontFamily: fontFamily.mono,
      fontSize: 9,
      color: colors.text.secondary,
      lineHeight: 14,
    },
    profileStats: {
      flexDirection: "row",
      gap: spacing.md,
    },
    pStat: {
      alignItems: "center",
      gap: 1,
    },
    pStatValue: {
      fontFamily: fontFamily.mono,
      fontSize: 12,
      fontWeight: fontWeight.bold,
      color: colors.text.primary,
    },
    pStatLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 7,
      fontWeight: fontWeight.bold,
      color: colors.text.disabled,
      letterSpacing: 0.8,
    },
    gapHint: {
      fontFamily: fontFamily.mono,
      fontSize: 8,
      color: AMBER,
      fontWeight: fontWeight.medium,
      letterSpacing: 0.3,
    },
  });

export default React.memo(ExplorationCompass);
