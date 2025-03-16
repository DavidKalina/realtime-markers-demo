// components/AdminOriginalImageViewer.tsx
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
import { Image as LucideImage, X, ZoomIn, Share2 } from "lucide-react-native";
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
      <View style={styles.headerRow}>
        <View style={styles.titleContainer}>
          <LucideImage size={16} color="#93c5fd" style={{ marginRight: 8 }} />
          <Text style={styles.title}>Original Event Flyer</Text>
        </View>
        <Text style={styles.adminText}>Admin Only</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#93c5fd" />
          <Text style={styles.loadingText}>Loading original image...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : imageUrl ? (
        <View style={styles.imageContainer}>
          <TouchableOpacity onPress={handleImagePress}>
            <Image
              source={{ uri: imageUrl }}
              style={styles.thumbnail}
              resizeMode="contain"
              onError={(e) => {
                console.error("Image load error:", e.nativeEvent.error);
                setError("Failed to display image");
              }}
            />
            <View style={styles.viewOverlay}>
              <ZoomIn size={24} color="#ffffff" />
              <Text style={styles.viewText}>View Original</Text>
            </View>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.noImageContainer}>
          <Text style={styles.noImageText}>No original image available</Text>
        </View>
      )}

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={handleCloseModal} style={styles.closeButton}>
              <X size={24} color="#f8f9fa" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleShareImage}
              style={styles.shareButton}
              disabled={downloading}
            >
              {downloading ? (
                <ActivityIndicator size="small" color="#f8f9fa" />
              ) : (
                <Share2 size={24} color="#f8f9fa" />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
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
          </View>
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
    borderRadius: 10,
    padding: 16,
    marginTop: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    fontSize: 14,
    color: "#93c5fd",
    fontFamily: "SpaceMono",
    fontWeight: "500",
  },
  adminText: {
    fontSize: 12,
    color: "#ff9800",
    fontFamily: "SpaceMono",
    fontWeight: "500",
    backgroundColor: "#3f3f3f",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  loadingContainer: {
    height: 150,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#424242",
    borderRadius: 8,
  },
  loadingText: {
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
    fontSize: 12,
    marginTop: 8,
  },
  errorContainer: {
    height: 60,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#424242",
    borderRadius: 8,
  },
  errorText: {
    color: "#f97583",
    fontFamily: "SpaceMono",
    fontSize: 12,
  },
  imageContainer: {
    position: "relative",
    backgroundColor: "#424242",
    borderRadius: 8,
    overflow: "hidden",
  },
  thumbnail: {
    width: "100%",
    height: 180,
    borderRadius: 8,
  },
  viewOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  viewText: {
    color: "#ffffff",
    fontFamily: "SpaceMono",
    fontSize: 14,
    marginLeft: 8,
  },
  noImageContainer: {
    height: 80,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#424242",
    borderRadius: 8,
  },
  noImageText: {
    color: "#adb5bd",
    fontFamily: "SpaceMono",
    fontSize: 14,
  },
  modalContainer: {
    paddingVertical: 50,
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  fullImage: {
    width: windowWidth,
    height: windowHeight * 0.8,
  },
});

export default AdminOriginalImageViewer;
