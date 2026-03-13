import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Modal,
  Dimensions,
  Alert,
} from "react-native";
import {
  useColors,
  spacing,
  radius,
  fontSize,
  fontWeight,
  fontFamily,
  type Colors,
} from "@/theme";
import * as Haptics from "expo-haptics";
import {
  Image as LucideImage,
  X,
  ZoomIn,
  Share2,
  Shield,
} from "lucide-react-native";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { apiClient } from "@/services/ApiClient";

interface AdminOriginalImageViewerProps {
  eventId: string;
  isAdmin: boolean;
}

const AdminOriginalImageViewer: React.FC<AdminOriginalImageViewerProps> = ({
  eventId,
  isAdmin,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!isAdmin || !eventId) return;

    let isMounted = true;

    const fetchImageUrl = async () => {
      setLoading(true);
      setError(null);

      try {
        // Get the local file URI
        const localUri = await apiClient.events.streamEventImage(eventId);

        if (isMounted) {
          setImageUrl(localUri);
        }
      } catch (err) {
        console.error("Error fetching original image:", err);
        if (isMounted) {
          setError("Could not load original image");
          Alert.alert(
            "Image Loading Error",
            "There was a problem loading the original image. Please check your internet connection and admin privileges.",
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchImageUrl();

    return () => {
      isMounted = false;
    };
  }, [eventId, isAdmin]);

  const handleImagePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setModalVisible(false);
  };

  const handleShareImage = async () => {
    if (!imageUrl) return;

    try {
      setDownloading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Download the image to a local file for sharing
      const fileName = `event-flyer-${eventId}.jpg`;
      const destination = new File(Paths.cache, fileName);

      // Download the image
      const downloaded = await File.downloadFileAsync(imageUrl, destination, {
        idempotent: true,
      });

      // Check if sharing is available
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(downloaded.uri);
      } else {
        setError("Sharing is not available on this device");
        Alert.alert("Sharing Error", "Sharing is not available on this device");
      }
    } catch (err) {
      console.error("Error sharing image:", err);
      setError("Failed to share image");
      Alert.alert("Sharing Error", "Failed to share the image");
    } finally {
      setDownloading(false);
    }
  };

  // Don't render anything if user is not admin
  if (!isAdmin) return null;

  return (
    <View style={styles.container}>
      {/* Gradient header background */}

      {/* Header section */}
      <View style={styles.cardHeader}>
        <View style={styles.cardIconContainer}>
          <LucideImage size={20} color="#ff9800" />
        </View>
        <Text style={styles.cardTitle}>Original Event Flyer</Text>
        <View style={styles.adminBadge}>
          <Shield size={12} color="#ff9800" />
          <Text style={styles.adminText}>ADMIN</Text>
        </View>
      </View>

      {/* Content section */}
      <View style={styles.cardContent}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#ff9800" />
            <Text style={styles.loadingText}>Loading original image...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : imageUrl ? (
          <View style={styles.imageContainer}>
            <TouchableOpacity onPress={handleImagePress} activeOpacity={0.9}>
              <Image
                source={{ uri: imageUrl }}
                style={styles.thumbnail}
                resizeMode="cover"
                onError={(e) => {
                  console.error("Image load error:", e.nativeEvent.error);
                  setError("Failed to display image");
                }}
              />
              <View style={styles.viewOverlay}>
                <ZoomIn size={20} color={colors.fixed.white} />
                <Text style={styles.viewText}>View Full Image</Text>
              </View>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.noImageContainer}>
            <Text style={styles.noImageText}>No original image available</Text>
          </View>
        )}
      </View>

      {/* Fullscreen modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={handleCloseModal}
              style={styles.closeButton}
              activeOpacity={0.7}
            >
              <X size={22} color={colors.text.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleShareImage}
              style={styles.shareButton}
              disabled={downloading}
              activeOpacity={0.7}
            >
              {downloading ? (
                <ActivityIndicator size="small" color={colors.text.primary} />
              ) : (
                <Share2 size={22} color={colors.text.primary} />
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.modalContent}
            activeOpacity={1}
            onPress={handleCloseModal}
          >
            {imageUrl && (
              <Image
                source={{ uri: imageUrl }}
                style={styles.fullImage}
                resizeMode="contain"
                onError={(e) => {
                  console.error("Modal image load error:", e.nativeEvent.error);
                  Alert.alert("Image Error", "Failed to display full image");
                  handleCloseModal();
                }}
              />
            )}
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
};

const windowWidth = Dimensions.get("window").width;
const windowHeight = Dimensions.get("window").height;

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.bg.card,
      borderRadius: radius["2xl"],
      padding: 0,
      marginVertical: spacing.lg,
      shadowColor: colors.overlay.light,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 8,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border.default,
    },

    // Gradient header
    headerGradient: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      height: 50,
    },

    // Card header
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.default,
    },

    cardIconContainer: {
      width: 40,
      height: 40,
      borderRadius: radius.md,
      justifyContent: "center",
      alignItems: "center",
      marginRight: spacing.lg,
      backgroundColor: "rgba(255, 152, 0, 0.15)",
      borderWidth: 1,
      borderColor: "rgba(255, 152, 0, 0.3)",
    },

    cardTitle: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.bold,
      color: colors.text.primary,
      fontFamily: fontFamily.mono,
      flex: 1,
      letterSpacing: 0.5,
    },

    // Admin badge
    adminBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(255, 152, 0, 0.15)",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius._10,
      borderWidth: 1,
      borderColor: "rgba(255, 152, 0, 0.3)",
    },

    adminText: {
      fontSize: 11,
      color: "#ff9800",
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      marginLeft: spacing._6,
      letterSpacing: 0.5,
    },

    // Card content
    cardContent: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xl,
    },

    // Loading state
    loadingContainer: {
      height: 180,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.border.subtle,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border.medium,
    },

    loadingText: {
      color: colors.text.secondary,
      fontFamily: fontFamily.mono,
      fontSize: 13,
      marginTop: spacing.md,
    },

    // Error state
    errorContainer: {
      height: 100,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.border.subtle,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border.medium,
    },

    errorText: {
      color: "#f97583",
      fontFamily: fontFamily.mono,
      fontSize: 13,
      textAlign: "center",
      paddingHorizontal: spacing.xl,
    },

    // Image container
    imageContainer: {
      position: "relative",
      backgroundColor: colors.border.subtle,
      borderRadius: radius.xl,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border.medium,
    },

    thumbnail: {
      width: "100%",
      height: 220,
      borderRadius: radius.xl,
    },

    viewOverlay: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.overlay.medium,
      paddingVertical: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },

    viewText: {
      color: colors.fixed.white,
      fontFamily: fontFamily.mono,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      marginLeft: spacing.sm,
    },

    // No image state
    noImageContainer: {
      height: 100,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.border.subtle,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border.medium,
    },

    noImageText: {
      color: colors.text.secondary,
      fontFamily: fontFamily.mono,
      fontSize: fontSize.sm,
    },

    // Modal styles
    modalContainer: {
      flex: 1,
      backgroundColor: colors.overlay.heavy,
    },

    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      padding: spacing.lg,
      paddingTop: spacing._50,
      backgroundColor: colors.overlay.light,
      zIndex: 10,
    },

    closeButton: {
      width: 40,
      height: 40,
      borderRadius: radius.md,
      backgroundColor: colors.border.subtle,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border.medium,
    },

    shareButton: {
      width: 40,
      height: 40,
      borderRadius: radius.md,
      backgroundColor: colors.border.subtle,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border.medium,
    },

    modalContent: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },

    fullImage: {
      width: windowWidth,
      height: windowHeight * 0.7,
    },
  });

export default AdminOriginalImageViewer;
