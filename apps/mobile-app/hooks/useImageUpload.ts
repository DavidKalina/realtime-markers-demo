import { useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";

export const useImageUpload = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { push } = useRouter();

  const uploadImage = async (imageUri: string): Promise<boolean> => {
    if (!imageUri) return false;

    try {
      setIsProcessing(true);

      const formData = new FormData();
      formData.append("image", {
        uri: imageUri,
        type: "image/jpeg",
        name: "upload.jpg",
      } as any);

      const response = await fetch(process.env.EXPO_PUBLIC_API_URL!, {
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

      // Navigate to home screen
      push("/");

      // Show success message
      Alert.alert("Success", "Event processed successfully!", [{ text: "OK" }], {
        cancelable: false,
      });

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

  return {
    uploadImage,
    isProcessing,
  };
};
