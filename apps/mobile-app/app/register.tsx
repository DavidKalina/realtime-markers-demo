import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  StatusBar,
  SafeAreaView,
  ScrollView,
} from "react-native";
import { Lock, Mail, Eye, EyeOff, ArrowLeft, User } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import apiClient from "@/services/ApiClient";
import { styles as loginStyles } from "@/components/Login/styles"; // Reusing the same styles
import { AuthWrapper } from "@/components/AuthWrapper";

const RegisterScreen: React.FC = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailInputRef = useRef<TextInput>(null);
  const displayNameInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);

  useEffect(() => {
    // Auto-focus the display name input when the screen loads
    setTimeout(() => {
      displayNameInputRef.current?.focus();
    }, 500);
  }, []);

  const togglePasswordVisibility = () => {
    Haptics.selectionAsync();
    setShowPassword(!showPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    Haptics.selectionAsync();
    setShowConfirmPassword(!showConfirmPassword);
  };

  const handleRegister = async () => {
    // Basic validation
    if (!displayName.trim()) {
      setError("Display name is required");
      displayNameInputRef.current?.focus();
      return;
    }

    if (!email.trim()) {
      setError("Email is required");
      emailInputRef.current?.focus();
      return;
    }

    if (!password) {
      setError("Password is required");
      passwordInputRef.current?.focus();
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      passwordInputRef.current?.focus();
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      confirmPasswordInputRef.current?.focus();
      return;
    }

    setError(null);
    setIsLoading(true);
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await apiClient.register(email, password, displayName);
      // Navigate to the main app screen on successful registration and login
      router.replace("/");
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error("Registration error:", error);
      setError(
        typeof error === "object" && error !== null && "message" in error
          ? String(error.message)
          : "Failed to register. Please check your information and try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthWrapper requireAuth={false}>
      <SafeAreaView style={loginStyles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#333" />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={loginStyles.keyboardAvoidingView}
        >
          <ScrollView
            contentContainerStyle={loginStyles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={loginStyles.formContainer}>
              {/* App Title or Logo */}
              <Text style={loginStyles.appTitle}>EventFinder</Text>

              {/* Error Message */}
              {error && (
                <View style={loginStyles.errorContainer}>
                  <Text style={loginStyles.errorText}>{error}</Text>
                </View>
              )}

              {/* Display Name Input */}
              <View style={loginStyles.inputContainer}>
                <User size={18} color="#4dabf7" style={loginStyles.inputIcon} />
                <TextInput
                  ref={displayNameInputRef}
                  style={loginStyles.input}
                  placeholder="Display name"
                  placeholderTextColor="#919191"
                  value={displayName}
                  onChangeText={setDisplayName}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => emailInputRef.current?.focus()}
                />
              </View>

              {/* Email Input */}
              <View style={loginStyles.inputContainer}>
                <Mail size={18} color="#4dabf7" style={loginStyles.inputIcon} />
                <TextInput
                  ref={emailInputRef}
                  style={loginStyles.input}
                  placeholder="Email address"
                  placeholderTextColor="#919191"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  keyboardType="email-address"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordInputRef.current?.focus()}
                />
              </View>

              {/* Password Input */}
              <View style={loginStyles.inputContainer}>
                <Lock size={18} color="#4dabf7" style={loginStyles.inputIcon} />
                <TextInput
                  ref={passwordInputRef}
                  style={loginStyles.input}
                  placeholder="Password"
                  placeholderTextColor="#919191"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  returnKeyType="next"
                  onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
                />
                <TouchableOpacity onPress={togglePasswordVisibility} style={loginStyles.eyeIcon}>
                  {showPassword ? (
                    <EyeOff size={18} color="#4dabf7" />
                  ) : (
                    <Eye size={18} color="#4dabf7" />
                  )}
                </TouchableOpacity>
              </View>

              {/* Confirm Password Input */}
              <View style={loginStyles.inputContainer}>
                <Lock size={18} color="#4dabf7" style={loginStyles.inputIcon} />
                <TextInput
                  ref={confirmPasswordInputRef}
                  style={loginStyles.input}
                  placeholder="Confirm password"
                  placeholderTextColor="#919191"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleRegister}
                />
                <TouchableOpacity
                  onPress={toggleConfirmPasswordVisibility}
                  style={loginStyles.eyeIcon}
                >
                  {showConfirmPassword ? (
                    <EyeOff size={18} color="#4dabf7" />
                  ) : (
                    <Eye size={18} color="#4dabf7" />
                  )}
                </TouchableOpacity>
              </View>

              <View style={{ height: 20 }} />

              {/* Register Button */}
              <TouchableOpacity
                style={loginStyles.loginButton}
                onPress={handleRegister}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#333" size="small" />
                ) : (
                  <Text style={loginStyles.loginButtonText}>Create Account</Text>
                )}
              </TouchableOpacity>

              {/* Login Link */}
              <View style={loginStyles.createAccountContainer}>
                <Text style={loginStyles.createAccountText}>Already have an account? </Text>
                <TouchableOpacity onPress={() => router.push("/login")}>
                  <Text style={loginStyles.createAccountLink}>Login</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </AuthWrapper>
  );
};

export default RegisterScreen;
