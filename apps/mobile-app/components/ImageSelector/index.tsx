// ImageSelector.tsx
import { Image as ImageIcon } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { colors, radius } from "@/theme";

interface ImageSelectorProps {
  onImageSelected: (uri: string) => void;
  disabled?: boolean;
}

export const ImageSelector: React.FC<ImageSelectorProps> = ({
  onImageSelected,
  disabled = false,
}) => {
  const pickImage = async () => {
    try {
      // Request permission first
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        alert("Permission to access media library is required!");
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        // Pass the selected image URI to the parent component
        onImageSelected(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      alert("Failed to pick image. Please try again.");
    }
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={pickImage}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View style={[styles.button, disabled && styles.buttonDisabled]}>
        <ImageIcon size={20} color={colors.text.primary} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.bg.elevated,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
});
