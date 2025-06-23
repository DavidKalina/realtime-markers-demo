import { useAuth } from "@/contexts/AuthContext";
import * as Haptics from "expo-haptics";
import { Chrome } from "lucide-react-native";
import React, { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";

interface OAuthButtonsProps {
  onError?: (error: string) => void;
}

const OAuthButtons: React.FC<OAuthButtonsProps> = ({ onError }) => {
  const { signInWithGoogle, signInWithFacebook, getAvailableOAuthProviders } =
    useAuth();
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [isLoadingFacebook, setIsLoadingFacebook] = useState(false);

  const googleButtonScale = useSharedValue(1);
  const facebookButtonScale = useSharedValue(1);

  const availableProviders = getAvailableOAuthProviders();

  const googleButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: googleButtonScale.value }],
  }));

  const facebookButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: facebookButtonScale.value }],
  }));

  const handleGoogleSignIn = async () => {
    if (isLoadingGoogle) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    googleButtonScale.value = withSequence(
      withSpring(0.95, { damping: 15, stiffness: 200 }),
      withSpring(1, { damping: 15, stiffness: 200 }),
    );

    setIsLoadingGoogle(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Google sign-in error:", error);
      onError?.("Google sign-in failed. Please try again.");
    } finally {
      setIsLoadingGoogle(false);
    }
  };

  const handleFacebookSignIn = async () => {
    if (isLoadingFacebook) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    facebookButtonScale.value = withSequence(
      withSpring(0.95, { damping: 15, stiffness: 200 }),
      withSpring(1, { damping: 15, stiffness: 200 }),
    );

    setIsLoadingFacebook(true);
    try {
      await signInWithFacebook();
    } catch (error) {
      console.error("Facebook sign-in error:", error);
      onError?.("Facebook sign-in failed. Please try again.");
    } finally {
      setIsLoadingFacebook(false);
    }
  };

  if (availableProviders.length === 0) {
    return null;
  }

  const styles = StyleSheet.create({
    container: {
      marginTop: 20,
      gap: 12,
    },
    dividerContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: 16,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: "#E0E0E0",
    },
    dividerText: {
      marginHorizontal: 16,
      color: "#6c757d",
      fontSize: 14,
      fontFamily: "Poppins-Regular",
    },
    googleButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#FFFFFF",
      borderRadius: 4,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: "#DADCE0",
      shadowColor: "rgba(0, 0, 0, 0.08)",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 1,
      shadowRadius: 2,
      elevation: 1,
      minHeight: 40,
    },
    facebookButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#1877F2",
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: "#1877F2",
      shadowColor: "rgba(0, 0, 0, 0.1)",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    buttonText: {
      fontSize: 14,
      fontWeight: "500",
      fontFamily: "Poppins-Regular",
      marginLeft: 12,
      letterSpacing: 0.25,
    },
    googleButtonText: {
      color: "#3C4043",
    },
    facebookButtonText: {
      color: "#FFFFFF",
    },
    iconContainer: {
      width: 18,
      height: 18,
      alignItems: "center",
      justifyContent: "center",
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.dividerContainer}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or continue with</Text>
        <View style={styles.dividerLine} />
      </View>

      {availableProviders.includes("google") && (
        <Animated.View style={googleButtonAnimatedStyle}>
          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleSignIn}
            disabled={isLoadingGoogle}
            activeOpacity={0.7}
          >
            <View style={styles.iconContainer}>
              {isLoadingGoogle ? (
                <ActivityIndicator size="small" color="#3C4043" />
              ) : (
                <Chrome size={18} color="#FF6B35" />
              )}
            </View>
            <Text style={[styles.buttonText, styles.googleButtonText]}>
              {isLoadingGoogle ? "Signing in..." : "Sign in with Google"}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {availableProviders.includes("facebook") && (
        <Animated.View style={facebookButtonAnimatedStyle}>
          <TouchableOpacity
            style={styles.facebookButton}
            onPress={handleFacebookSignIn}
            disabled={isLoadingFacebook}
            activeOpacity={0.7}
          >
            <View style={styles.iconContainer}>
              {isLoadingFacebook ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={{ fontSize: 20 }}>📘</Text>
              )}
            </View>
            <Text style={[styles.buttonText, styles.facebookButtonText]}>
              {isLoadingFacebook ? "Signing in..." : "Continue with Facebook"}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
};

export default OAuthButtons;
