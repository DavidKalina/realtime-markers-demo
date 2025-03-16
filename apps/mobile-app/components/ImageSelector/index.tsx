// ImageSelector.tsx
import React from "react";
import { StyleSheet, TouchableOpacity, View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

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
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

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
        <Feather name="image" size={20} color="#f8f9fa" />
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#f8f9fa",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
    marginBottom: 4,
  },
  buttonDisabled: {
    opacity: 0.5,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  text: {
    color: "#f8f9fa",
    fontSize: 12,
    fontFamily: "SpaceMono",
  },
});
