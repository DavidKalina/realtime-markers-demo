import React from "react";
import { View, TouchableOpacity, Text, StyleSheet, Alert } from "react-native";
import {
  useGoogleOAuth,
  useFacebookOAuth,
  useOAuthAvailability,
  OAuthUser,
} from "../../hooks/useOAuth";

interface OAuthButtonsProps {
  onSuccess?: (user: OAuthUser) => void;
  onError?: (error: Error) => void;
}

export const OAuthButtons: React.FC<OAuthButtonsProps> = ({
  onSuccess,
  onError,
}) => {
  const {
    signInWithGoogle,
    isReady: isGoogleReady,
    isLoading: isGoogleLoading,
  } = useGoogleOAuth();
  const {
    signInWithFacebook,
    isReady: isFacebookReady,
    isLoading: isFacebookLoading,
  } = useFacebookOAuth();
  const { isGoogleAvailable, isFacebookAvailable } = useOAuthAvailability();

  const handleGoogleSignIn = async () => {
    try {
      if (!isGoogleReady) {
        Alert.alert("Error", "Google OAuth is not ready. Please try again.");
        return;
      }

      const result = await signInWithGoogle();
      if (result && onSuccess) {
        onSuccess(result.user);
      }
    } catch (error) {
      console.error("Google sign-in error:", error);
      if (onError) {
        onError(error as Error);
      } else {
        Alert.alert("Error", "Google sign-in failed. Please try again.");
      }
    }
  };

  const handleFacebookSignIn = async () => {
    try {
      if (!isFacebookReady) {
        Alert.alert("Error", "Facebook OAuth is not ready. Please try again.");
        return;
      }

      const result = await signInWithFacebook();
      if (result && onSuccess) {
        onSuccess(result.user);
      }
    } catch (error) {
      console.error("Facebook sign-in error:", error);
      if (onError) {
        onError(error as Error);
      } else {
        Alert.alert("Error", "Facebook sign-in failed. Please try again.");
      }
    }
  };

  // Don't render anything if no OAuth providers are available
  if (!isGoogleAvailable && !isFacebookAvailable) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.buttonContainer}>
        {isGoogleAvailable && (
          <TouchableOpacity
            style={[
              styles.button,
              styles.googleButton,
              !isGoogleReady && styles.disabledButton,
            ]}
            onPress={handleGoogleSignIn}
            disabled={!isGoogleReady || isGoogleLoading}
          >
            <Text style={styles.buttonText}>
              {isGoogleLoading ? "Signing in..." : "Continue with Google"}
            </Text>
          </TouchableOpacity>
        )}

        {isFacebookAvailable && (
          <TouchableOpacity
            style={[
              styles.button,
              styles.facebookButton,
              !isFacebookReady && styles.disabledButton,
            ]}
            onPress={handleFacebookSignIn}
            disabled={!isFacebookReady || isFacebookLoading}
          >
            <Text style={styles.buttonText}>
              {isFacebookLoading ? "Signing in..." : "Continue with Facebook"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 20,
  },
  title: {
    textAlign: "center",
    fontSize: 16,
    color: "#666",
    marginBottom: 20,
  },
  buttonContainer: {
    gap: 12,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  googleButton: {
    backgroundColor: "#4285F4",
  },
  facebookButton: {
    backgroundColor: "#1877F2",
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});
