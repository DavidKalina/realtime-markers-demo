import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  useColors,
  spacing,
  radius,
  fontSize,
  fontFamily,
  type Colors,
} from "@/theme";
import { ImageItem } from "@/hooks/useBatchUpload";

const COLUMNS = 3;
const GRID_GAP = spacing.sm;
// Content padding (spacing.lg) + ScreenContent paddingHorizontal (4) on each side
const SCREEN_PADDING = (spacing.lg + 4) * 2;
const CELL_SIZE =
  (Dimensions.get("window").width - SCREEN_PADDING - GRID_GAP * (COLUMNS - 1)) /
  COLUMNS;

interface ImagePreviewGridProps {
  images: ImageItem[];
  isUploading: boolean;
  onRemove: (id: string) => void;
}

export function ImagePreviewGrid({
  images,
  isUploading,
  onRemove,
}: ImagePreviewGridProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  if (images.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Photos</Text>
      <View style={styles.grid}>
        {images.map((item) => (
          <View key={item.id} style={styles.cell}>
            <Image
              source={{ uri: item.uri }}
              style={styles.thumbnail}
              resizeMode="cover"
            />

            {/* Remove button */}
            {!isUploading && item.status === "pending" && (
              <Pressable
                style={styles.removeButton}
                onPress={() => onRemove(item.id)}
              >
                <Text style={styles.removeText}>X</Text>
              </Pressable>
            )}

            {/* Status overlay */}
            {item.status === "uploading" && (
              <View style={styles.overlay}>
                <ActivityIndicator size="small" color={colors.fixed.white} />
              </View>
            )}
            {item.status === "success" && (
              <View style={[styles.overlay, styles.successOverlay]}>
                <Text style={styles.statusIcon}>✓</Text>
              </View>
            )}
            {item.status === "failed" && (
              <View style={[styles.overlay, styles.failedOverlay]}>
                <Text style={styles.statusIcon}>✕</Text>
              </View>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      gap: spacing.sm,
    },
    sectionLabel: {
      color: colors.text.secondary,
      fontFamily: fontFamily.mono,
      fontSize: fontSize.xs,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: GRID_GAP,
    },
    cell: {
      width: CELL_SIZE,
      height: CELL_SIZE,
      borderRadius: radius.md,
      overflow: "hidden",
      backgroundColor: colors.bg.card,
    },
    thumbnail: {
      width: "100%",
      height: "100%",
    },
    removeButton: {
      position: "absolute",
      top: spacing.xs,
      right: spacing.xs,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.overlay.medium,
      alignItems: "center",
      justifyContent: "center",
    },
    removeText: {
      color: colors.fixed.white,
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      fontWeight: "700",
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay.light,
      alignItems: "center",
      justifyContent: "center",
    },
    successOverlay: {
      backgroundColor: "rgba(16, 185, 129, 0.5)",
    },
    failedOverlay: {
      backgroundColor: "rgba(248, 113, 113, 0.5)",
    },
    statusIcon: {
      color: colors.fixed.white,
      fontSize: 28,
      fontWeight: "700",
    },
  });
