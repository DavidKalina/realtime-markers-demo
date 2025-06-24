import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
} from "react-native";
import { Calendar, MessageSquare } from "lucide-react-native";
import { COLORS } from "../Layout/ScreenLayout";

interface ContentTypeOverlayProps {
  isVisible: boolean;
  capturedImageUri: string | null;
  onSelectEvent: () => void;
  onSelectCivicEngagement: () => void;
  onCancel: () => void;
}

export const ContentTypeOverlay: React.FC<ContentTypeOverlayProps> = ({
  isVisible,
  capturedImageUri,
  onSelectEvent,
  onSelectCivicEngagement,
  onCancel,
}) => {
  const [pressedOption, setPressedOption] = useState<string | null>(null);

  const handlePressIn = (option: string) => {
    setPressedOption(option);
  };

  const handlePressOut = () => {
    setPressedOption(null);
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onCancel}
    >
      <View style={styles.container}>
        {/* Background Image */}
        {capturedImageUri && (
          <Image
            source={{ uri: capturedImageUri }}
            style={styles.backgroundImage}
            resizeMode="cover"
          />
        )}
        {/* Dark overlay for contrast */}
        <View style={styles.darkLayer} />

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.title}>What would you like to share?</Text>
          <Text style={styles.subtitle}>
            Choose the type of community content you'd like to create
          </Text>

          <View style={styles.optionsContainer}>
            {/* Event Option */}
            <TouchableOpacity
              style={[
                styles.optionCard,
                pressedOption === "event" && styles.optionCardPressed,
              ]}
              onPress={onSelectEvent}
              onPressIn={() => handlePressIn("event")}
              onPressOut={handlePressOut}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.optionIcon,
                  pressedOption === "event" && styles.optionIconPressed,
                ]}
              >
                <Calendar size={32} color={COLORS.accent} />
              </View>
              <Text style={styles.optionTitle}>Community Event</Text>
              <Text style={styles.optionDescription}>
                Share a local event, meeting, or activity
              </Text>
            </TouchableOpacity>

            {/* Civic Engagement Option */}
            <TouchableOpacity
              style={[
                styles.optionCard,
                pressedOption === "civic" && styles.optionCardPressed,
              ]}
              onPress={onSelectCivicEngagement}
              onPressIn={() => handlePressIn("civic")}
              onPressOut={handlePressOut}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.optionIcon,
                  pressedOption === "civic" && styles.optionIconPressed,
                ]}
              >
                <MessageSquare size={32} color={COLORS.accent} />
              </View>
              <Text style={styles.optionTitle}>Community Feedback</Text>
              <Text style={styles.optionDescription}>
                Report an issue, share an idea, or provide feedback
              </Text>
            </TouchableOpacity>
          </View>

          {/* Cancel Button */}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onCancel}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
  },
  darkLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  content: {
    width: "90%",
    maxWidth: 400,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: "700",
    fontFamily: "Poppins-Regular",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontFamily: "Poppins-Regular",
    marginBottom: 32,
    textAlign: "center",
  },
  optionsContainer: {
    width: "100%",
    gap: 16,
    marginBottom: 24,
  },
  optionCard: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: COLORS.buttonBorder,
    alignItems: "center",
    minHeight: 120,
    justifyContent: "center",
    transform: [{ scale: 1 }],
  },
  optionCardPressed: {
    backgroundColor: COLORS.accent + "10",
    borderColor: COLORS.accent,
    transform: [{ scale: 0.98 }],
  },
  optionIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.accent + "20",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  optionIconPressed: {
    backgroundColor: COLORS.accent + "40",
    transform: [{ scale: 1.05 }],
  },
  optionTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "Poppins-Regular",
    marginBottom: 4,
  },
  optionDescription: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "Poppins-Regular",
    textAlign: "center",
  },
  cancelButton: {
    backgroundColor: COLORS.buttonBackground,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },
  cancelButtonText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontFamily: "Poppins-Regular",
  },
});
