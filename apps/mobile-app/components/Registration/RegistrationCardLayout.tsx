import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { OAuthButtons } from "@/components/Login/OAuthButtons";
import { COLORS } from "@/components/Layout/ScreenLayout";
import { useRouter } from "expo-router";

interface RegistrationCardLayoutProps {
  children: React.ReactNode;
  onOAuthError: (error: Error) => void;
}

const RegistrationCardLayout: React.FC<RegistrationCardLayoutProps> = ({
  children,
  onOAuthError,
}) => {
  const router = useRouter();
  return (
    <View style={styles.formCard}>
      <View style={styles.stepContent}>{children}</View>
      <View style={styles.dividerContainer}>
        <View style={styles.divider} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.divider} />
      </View>
      <OAuthButtons onError={onOAuthError} />
      <TouchableOpacity
        style={styles.loginLinkContainer}
        onPress={() => router.replace("/login")}
      >
        <Text style={styles.loginLinkText}>Back to Login</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  formCard: {
    width: "100%",
    borderRadius: 20,
    padding: 24,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.divider,
    minHeight: 420, // adjust as needed for your tallest step
    justifyContent: "space-between",
  },
  stepContent: {
    flexGrow: 1,
    justifyContent: "flex-start",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.divider,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: COLORS.textSecondary,
    fontFamily: "SpaceMono",
  },

  loginLinkContainer: {
    marginTop: 16,
    alignItems: "center",
  },
  loginLinkText: {
    color: COLORS.accent,
    fontWeight: "600",
    fontSize: 15,
    fontFamily: "SpaceMono",
    textDecorationLine: "underline",
  },
});

export default RegistrationCardLayout;
