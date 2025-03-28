import { ImageSelector } from "@/components/ImageSelector";
import { useUserLocation } from "@/contexts/LocationContext";
import { useEventBroker } from "@/hooks/useEventBroker";
import apiClient from "@/services/ApiClient";
import { EventTypes } from "@/services/EventBroker";
import { useJobSessionStore } from "@/stores/useJobSessionStore";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import * as FileSystem from "expo-file-system";

export default function UploadScreen() {
    const router = useRouter();
    const [isUploading, setIsUploading] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const isMounted = useRef(true);
    const { userLocation } = useUserLocation();
    const navigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const addJob = useJobSessionStore((state) => state.addJob);
    const { publish } = useEventBroker();

    // Set mounted flag to false when component unmounts
    useEffect(() => {
        return () => {
            isMounted.current = false;
            if (navigationTimerRef.current) {
                clearTimeout(navigationTimerRef.current);
            }
        };
    }, []);

    // Queue job and navigate after a brief delay
    const queueJobAndNavigateDelayed = useCallback(
        (jobId: string) => {
            if (!jobId || !isMounted.current) return;

            // Add to job queue
            addJob(jobId);

            // Publish job queued event
            publish(EventTypes.JOB_QUEUED, {
                timestamp: Date.now(),
                source: "UploadScreen",
                jobId: jobId,
                message: "Document upload queued for processing",
            });

            // Set a timer to navigate away after a brief preview
            navigationTimerRef.current = setTimeout(() => {
                if (isMounted.current) {
                    // Navigate back to the map
                    router.replace("/");
                }
            }, 1500); // Show preview for 1.5 seconds
        },
        [addJob, publish, router]
    );

    // Handle image upload
    const uploadImageAndQueue = async (uri: string) => {
        if (!isMounted.current) return null;

        try {
            setUploadProgress(10);

            // Handle base64 images
            let imageUri = uri;
            if (uri.startsWith('data:') || uri.startsWith('base64,')) {
                // Convert base64 to file URI
                const base64Data = uri.startsWith('data:')
                    ? uri.split(',')[1]
                    : uri;

                // Create a temporary file
                const tempFilePath = `${FileSystem.cacheDirectory}temp_${Date.now()}.jpg`;
                await FileSystem.writeAsStringAsync(
                    tempFilePath,
                    base64Data,
                    { encoding: FileSystem.EncodingType.Base64 }
                );
                imageUri = tempFilePath;
            }

            // Create imageFile object for apiClient
            const imageFile = {
                uri: imageUri,
                name: "document.jpg",
                type: "image/jpeg",
            } as any;

            // Add location data if available
            if (userLocation) {
                imageFile.userLat = userLocation[1].toString();
                imageFile.userLng = userLocation[0].toString();
            }

            setUploadProgress(70);

            // Upload using API client
            const result = await apiClient.processEventImage(imageFile);

            setUploadProgress(100);

            if (result.jobId && isMounted.current) {
                queueJobAndNavigateDelayed(result.jobId);
                return result.jobId;
            }
        } catch (error) {
            console.error("Upload failed:", error);
            if (isMounted.current) {
                Alert.alert(
                    "Upload Failed",
                    "Failed to process the document. Please try again.",
                    [{ text: "OK" }]
                );
            }
            throw error;
        }
    };

    // Handle image selection from gallery
    const handleImageSelected = async (uri: string) => {
        if (!isMounted.current) return;

        try {
            // Show the selected image
            setPreviewImage(uri);

            // Start upload process
            setIsUploading(true);

            // Show a notification
            publish(EventTypes.NOTIFICATION, {
                timestamp: Date.now(),
                source: "UploadScreen",
                message: "Processing document...",
            });

            // Upload the image and process
            await uploadImageAndQueue(uri);
        } catch (error) {
            console.error("Gallery image processing failed:", error);

            if (isMounted.current) {
                Alert.alert(
                    "Upload Failed",
                    "Failed to process the image. Please try again or choose a different image.",
                    [
                        {
                            text: "Try Again",
                            onPress: () => handleImageSelected(uri)
                        },
                        {
                            text: "Cancel",
                            style: "cancel",
                            onPress: () => {
                                setPreviewImage(null);
                                setIsUploading(false);
                            }
                        }
                    ]
                );
            }
        }
    };

    // Back button handler
    const handleBack = () => {
        if (!isMounted.current) return;

        if (navigationTimerRef.current) {
            clearTimeout(navigationTimerRef.current);
        }

        setTimeout(() => {
            if (isMounted.current) {
                router.replace("/");
            }
        }, 50);
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                    <Feather name="arrow-left" size={24} color="#f8f9fa" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Upload Document</Text>
            </View>

            {/* Content */}
            <View style={styles.content}>
                {isUploading ? (
                    <View style={styles.uploadingContainer}>
                        <ActivityIndicator size="large" color="#93c5fd" />
                        <Text style={styles.uploadingText}>Processing document...</Text>
                        {uploadProgress > 0 && (
                            <Text style={styles.progressText}>{uploadProgress}%</Text>
                        )}
                    </View>
                ) : (
                    <View style={styles.uploadContainer}>
                        {previewImage ? (
                            <Animated.View entering={FadeIn} style={styles.previewContainer}>
                                <Image source={{ uri: previewImage }} style={styles.previewImage} />
                                <TouchableOpacity
                                    style={styles.retryButton}
                                    onPress={() => setPreviewImage(null)}
                                >
                                    <Text style={styles.retryButtonText}>Choose Different Image</Text>
                                </TouchableOpacity>
                            </Animated.View>
                        ) : (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyStateText}>Select a document to upload</Text>
                                <ImageSelector onImageSelected={handleImageSelected} />
                            </View>
                        )}
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#333",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(255, 255, 255, 0.1)",
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        color: "#f8f9fa",
        fontSize: 18,
        fontFamily: "SpaceMono",
        marginLeft: 16,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    uploadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    uploadingText: {
        color: "#f8f9fa",
        marginTop: 16,
        fontFamily: "SpaceMono",
    },
    progressText: {
        color: "#93c5fd",
        marginTop: 8,
        fontFamily: "SpaceMono",
    },
    uploadContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    emptyState: {
        alignItems: "center",
    },
    emptyStateText: {
        color: "#f8f9fa",
        marginBottom: 24,
        fontFamily: "SpaceMono",
    },
    previewContainer: {
        alignItems: "center",
    },
    previewImage: {
        width: 300,
        height: 400,
        borderRadius: 8,
        marginBottom: 16,
    },
    retryButton: {
        backgroundColor: "rgba(255, 255, 255, 0.1)",
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    retryButtonText: {
        color: "#f8f9fa",
        fontFamily: "SpaceMono",
    },
}); 