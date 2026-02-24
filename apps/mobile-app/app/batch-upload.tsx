import React, { useCallback, useMemo, useRef } from "react";
import { Alert, StyleSheet, Text, View, ViewStyle } from "react-native";
import { useRouter } from "expo-router";
import * as ImageManipulator from "expo-image-manipulator";
import Screen from "@/components/Layout/Screen";
import { BatchImagePicker, ImagePreviewGrid } from "@/components/BatchUpload";
import { useUploadImage } from "@/hooks/useUploadImage";
import { useBatchUpload } from "@/hooks/useBatchUpload";
import { useNetworkQuality } from "@/hooks/useNetworkQuality";
import { colors, spacing, fontFamily, fontSize } from "@/theme";

const MAX_IMAGES = 5;
const PROCESSED_WIDTH = 1200;
const PROCESSED_QUALITY = 0.3;

export default function BatchUploadScreen() {
  const router = useRouter();
  const networkState = useNetworkQuality();
  const uploadingRef = useRef(false);

  const isNetworkSuitable = useCallback(() => {
    return networkState.isConnected && networkState.strength >= 40;
  }, [networkState.isConnected, networkState.strength]);

  const processImage = useCallback(
    async (uri: string): Promise<string | null> => {
      try {
        const processed = await ImageManipulator.manipulateAsync(
          uri,
          [
            {
              resize: { width: PROCESSED_WIDTH },
            } as unknown as ImageManipulator.Action,
          ],
          {
            compress: PROCESSED_QUALITY,
            format: ImageManipulator.SaveFormat.JPEG,
          },
        );
        return processed.uri;
      } catch {
        return uri;
      }
    },
    [],
  );

  const { uploadAndTrack } = useUploadImage({
    processImage,
    isNetworkSuitable,
  });
  const {
    images,
    isUploading,
    currentIndex,
    completedCount,
    failedCount,
    isDone,
    addImages,
    removeImage,
    startUpload,
    reset,
  } = useBatchUpload({ uploadAndTrack });

  const handleBack = useCallback(() => {
    if (isUploading) {
      Alert.alert(
        "Upload in Progress",
        "Photos are still uploading. Are you sure you want to leave?",
        [
          { text: "Stay", style: "cancel" },
          {
            text: "Leave",
            style: "destructive",
            onPress: () => router.back(),
          },
        ],
      );
      return;
    }
    router.back();
  }, [isUploading, router]);

  const handleUpload = useCallback(() => {
    if (uploadingRef.current) return;
    uploadingRef.current = true;
    startUpload().finally(() => {
      uploadingRef.current = false;
    });
  }, [startUpload]);

  const handleDone = useCallback(() => {
    reset();
    router.replace("/");
  }, [reset, router]);

  const footerButtons = useMemo(() => {
    if (images.length === 0) return [];

    if (isDone) {
      return [
        {
          label: "Done",
          onPress: handleDone,
          variant: "primary" as const,
          style: {
            flex: 1,
            backgroundColor: colors.status.success.bg,
            borderColor: colors.status.success.bg,
          } as ViewStyle,
          textStyle: { color: colors.fixed.white },
        },
      ];
    }

    if (isUploading) {
      return [
        {
          label: `Uploading ${currentIndex + 1} of ${images.length}...`,
          onPress: () => {},
          variant: "primary" as const,
          style: { flex: 1 } as ViewStyle,
          loading: true,
        },
      ];
    }

    return [
      {
        label: `Upload All (${images.length})`,
        onPress: handleUpload,
        variant: "primary" as const,
        style: { flex: 1 } as ViewStyle,
      },
    ];
  }, [
    images.length,
    isDone,
    isUploading,
    currentIndex,
    handleUpload,
    handleDone,
  ]);

  return (
    <Screen
      bannerEmoji="📤"
      bannerTitle="Batch Upload"
      onBack={handleBack}
      isScrollable={true}
      noSafeArea={false}
      footerButtons={footerButtons}
      footerSafeArea={true}
    >
      <View style={styles.content}>
        <BatchImagePicker
          currentCount={images.length}
          maxCount={MAX_IMAGES}
          onImagesPicked={addImages}
          disabled={isUploading || isDone}
          autoOpen
        />

        <ImagePreviewGrid
          images={images}
          isUploading={isUploading}
          onRemove={removeImage}
        />

        {/* Status caption */}
        {isDone && (
          <Text style={styles.statusText}>
            {completedCount} succeeded
            {failedCount > 0 ? `, ${failedCount} failed` : ""}
          </Text>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  statusText: {
    color: colors.text.secondary,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
    textAlign: "center",
  },
});
