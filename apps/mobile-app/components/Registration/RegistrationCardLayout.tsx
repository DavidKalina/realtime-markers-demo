import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { OAuthButtons } from "@/components/Login/OAuthButtons";
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
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E0E0E0",
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
    backgroundColor: "#E0E0E0",
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: "#6c757d",
    fontFamily: "Poppins-Regular",
  },

  loginLinkContainer: {
    marginTop: 16,
    alignItems: "center",
  },
  loginLinkText: {
    color: "#00697A",
    fontWeight: "600",
    fontSize: 15,
    fontFamily: "Poppins-Regular",
    textDecorationLine: "underline",
  },
});

export default RegistrationCardLayout;
