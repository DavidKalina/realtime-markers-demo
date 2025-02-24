import { useState } from "react";
import { Alert } from "react-native";

export const useImageUpload = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [processedImageUri, setProcessedImageUri] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [eventId, setEventId] = useState<string | null>(null);

  // Define processing steps
  const processingSteps = [
    "Analyzing document...",
    "Extracting information...",
    "Validating data...",
    "Finalizing...",
  ];

  const uploadImage = async (imageUri: string): Promise<boolean> => {
    if (!imageUri) return false;

    try {
      setIsProcessing(true);
      setProcessingStep(0);
      setProcessedImageUri(imageUri);

      // Simulate processing steps with delays
      // In a real application, these would be actual API calls
      for (let i = 0; i < processingSteps.length; i++) {
        await new Promise((resolve) => setTimeout(resolve, 800)); // simulate processing time
        setProcessingStep(i);
      }

      const formData = new FormData();
      formData.append("image", {
        uri: imageUri,
        type: "image/jpeg",
        name: "upload.jpg",
      } as any);

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/process`, {
        method: "POST",
        body: formData,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to process image");
      }

      const result = await response.json();

      // Store the eventId from the response if available
      if (result && result.id) {
        setEventId(result.id);
      }

      // Set success and show success screen instead of navigating
      setIsSuccess(true);
      return true;
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Failed to upload image. Please try again.",
        [{ text: "OK" }],
        { cancelable: false }
      );
      console.error("Error uploading image:", error);
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  const resetUpload = () => {
    setIsSuccess(false);
    setProcessedImageUri(null);
    setProcessingStep(0);
    setEventId(null);
  };

  return {
    uploadImage,
    isProcessing,
    processingStep,
    processingSteps,
    processedImageUri,
    isSuccess,
    eventId,
    resetUpload,
  };
};
