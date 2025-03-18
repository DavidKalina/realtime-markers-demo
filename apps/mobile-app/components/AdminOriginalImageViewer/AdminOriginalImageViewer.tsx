import React, { useState, useEffect } from "react";
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
import * as Haptics from "expo-haptics";
import { Image as LucideImage, X, ZoomIn, Share2, Shield } from "lucide-react-native";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import apiClient from "@/services/ApiClient";

interface AdminOriginalImageViewerProps {
  eventId: string;
  isAdmin: boolean;
}

const AdminOriginalImageViewer: React.FC<AdminOriginalImageViewerProps> = ({
  eventId,
  isAdmin,
}) => {
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
        const localUri = await apiClient.streamEventImage(eventId);

        if (isMounted) {
          setImageUrl(localUri);
        }
      } catch (err) {
        console.error("Error fetching original image:", err);
        if (isMounted) {
          setError("Could not load original image");
          Alert.alert(
            "Image Loading Error",
            "There was a problem loading the original image. Please check your internet connection and admin privileges."
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
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

      // Download the image
      const { uri } = await FileSystem.downloadAsync(imageUrl, fileUri);

      // Check if sharing is available
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri);
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
                <ZoomIn size={20} color="#ffffff" />
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
              <X size={22} color="#f8f9fa" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleShareImage}
              style={styles.shareButton}
              disabled={downloading}
              activeOpacity={0.7}
            >
              {downloading ? (
                <ActivityIndicator size="small" color="#f8f9fa" />
              ) : (
                <Share2 size={22} color="#f8f9fa" />
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

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#3a3a3a",
    borderRadius: 16,
    padding: 0,
    marginVertical: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    overflow: "hidden",
  },

  // Header gradient
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
    paddingHorizontal: 18,
    paddingVertical: 14,
  },

  cardIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
    backgroundColor: "rgba(255, 152, 0, 0.2)",
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
    flex: 1,
  },

  // Admin badge
  adminBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 152, 0, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 152, 0, 0.3)",
  },

  adminText: {
    fontSize: 10,
    color: "#ff9800",
    fontFamily: "SpaceMono",
    fontWeight: "600",
    marginLeft: 4,
  },

  // Card content
  cardContent: {
    paddingHorizontal: 18,
    paddingBottom: 18,
  },

  // Loading state
  loadingContainer: {
    height: 180,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(66, 66, 66, 0.5)",
    borderRadius: 12,
  },

  loadingText: {
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
    fontSize: 12,
    marginTop: 10,
  },

  // Error state
  errorContainer: {
    height: 100,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(66, 66, 66, 0.5)",
    borderRadius: 12,
  },

  errorText: {
    color: "#f97583",
    fontFamily: "SpaceMono",
    fontSize: 12,
    textAlign: "center",
    paddingHorizontal: 20,
  },

  // Image container
  imageContainer: {
    position: "relative",
    backgroundColor: "#424242",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },

  thumbnail: {
    width: "100%",
    height: 220,
    borderRadius: 12,
  },

  viewOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  viewText: {
    color: "#ffffff",
    fontFamily: "SpaceMono",
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 8,
  },

  // No image state
  noImageContainer: {
    height: 100,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(66, 66, 66, 0.5)",
    borderRadius: 12,
  },

  noImageText: {
    color: "#adb5bd",
    fontFamily: "SpaceMono",
    fontSize: 14,
  },

  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    paddingTop: 50, // Provide space for status bar
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    zIndex: 10,
  },

  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(58, 58, 58, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },

  shareButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(58, 58, 58, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
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
