import React, { useEffect } from "react";
import { StyleSheet, Text, View, TouchableOpacity, Image } from "react-native";
import { useRouter } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withDelay,
  FadeIn,
  SlideInDown,
  ZoomIn,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";

interface SuccessScreenProps {
  imageUri: string;
  onNewScan: () => void;
  eventName?: string;
}

export const SuccessScreen: React.FC<SuccessScreenProps> = ({
  imageUri,
  onNewScan,
  eventName = "Document Processed",
}) => {
  const router = useRouter();
  const checkmarkScale = useSharedValue(0);
  const cardScale = useSharedValue(0.9);

  useEffect(() => {
    // Animate checkmark
    checkmarkScale.value = withSequence(
      withSpring(1.3, { damping: 10 }),
      withSpring(1, { damping: 15 })
    );

    // Animate card
    cardScale.value = withDelay(400, withSpring(1, { damping: 15 }));
  }, []);

  const checkmarkStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: checkmarkScale.value }],
    };
  });

  const cardStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: cardScale.value }],
    };
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.successCircle]} entering={ZoomIn.springify().damping(10)}>
        <Animated.View style={checkmarkStyle}>
          <Feather name="check" size={64} color="#FFFFFF" />
        </Animated.View>
      </Animated.View>

      <Animated.Text style={styles.successTitle} entering={FadeIn.delay(300).duration(800)}>
        Success!
      </Animated.Text>

      <Animated.Text style={styles.successSubtitle} entering={FadeIn.delay(600).duration(800)}>
        {eventName}
      </Animated.Text>

      <Animated.View
        style={[styles.card, cardStyle]}
        entering={SlideInDown.delay(900).springify().damping(15)}
      >
        <Text style={styles.cardTitle}>Document Preview</Text>
        <View style={styles.imageContainer}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
          ) : (
            <View style={styles.placeholderImage}>
              <Feather name="file-text" size={48} color="#666" />
              <Text style={styles.placeholderText}>Preview not available</Text>
            </View>
          )}
        </View>
      </Animated.View>

      <Animated.View style={styles.buttonContainer} entering={SlideInDown.delay(1200).springify()}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={() => router.push("/")}
        >
          <Feather name="home" size={20} color="#FFFFFF" style={styles.buttonIcon} />
          <Text style={styles.primaryButtonText}>Go to Home</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={onNewScan}>
          <Feather name="camera" size={20} color="#333" style={styles.buttonIcon} />
          <Text style={styles.secondaryButtonText}>New Scan</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#333",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  successCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#69db7c",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    elevation: 10,
    shadowColor: "#69db7c",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
    fontFamily: "BungeeInline",
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 18,
    color: "#adb5bd",
    marginBottom: 32,
    fontFamily: "SpaceMono",
    textAlign: "center",
  },
  card: {
    backgroundColor: "#444",
    borderRadius: 16,
    padding: 16,
    width: "100%",
    maxWidth: 400,
    marginBottom: 32,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  cardTitle: {
    fontSize: 16,
    color: "#FFFFFF",
    marginBottom: 16,
    fontFamily: "SpaceMono",
    textAlign: "center",
  },
  imageContainer: {
    width: "100%",
    height: 200,
    backgroundColor: "#333",
    borderRadius: 12,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholderImage: {
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    color: "#666",
    marginTop: 8,
    fontFamily: "SpaceMono",
  },
  buttonContainer: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    maxWidth: 400,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    flex: 1,
    marginHorizontal: 6,
    elevation: 3,
  },
  primaryButton: {
    backgroundColor: "#69db7c",
  },
  secondaryButton: {
    backgroundColor: "#e9ecef",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SpaceMono",
  },
  secondaryButtonText: {
    color: "#333",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SpaceMono",
  },
  buttonIcon: {
    marginRight: 8,
  },
});
