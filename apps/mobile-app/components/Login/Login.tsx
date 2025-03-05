import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Keyboard,
  StatusBar,
  SafeAreaView,
  ScrollView,
} from "react-native";
import { Lock, Mail, Eye, EyeOff, ArrowLeft } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import apiClient from "@/services/ApiClient";
import { styles as loginStyles } from "./styles";
import { AuthWrapper } from "../AuthWrapper";

const Login: React.FC = () => {
  const router = useRouter();
  const [email, setEmail] = useState("davidtest@email.com");
  const [password, setPassword] = useState("poopy123!");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

  useEffect(() => {
    // Auto-focus the email input when the screen loads
    setTimeout(() => {
      emailInputRef.current?.focus();
    }, 500);
  }, []);

  const togglePasswordVisibility = () => {
    Haptics.selectionAsync();
    setShowPassword(!showPassword);
  };

  const handleLogin = async () => {
    // Basic validation
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

    setError(null);
    setIsLoading(true);
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await apiClient.login(email, password);
      // Navigate to the main app screen on successful login
      router.replace("/");
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error("Login error:", error);
      setError(
        typeof error === "object" && error !== null && "message" in error
          ? String(error.message)
          : "Failed to login. Please check your credentials and try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAccount = () => {
    Haptics.selectionAsync();
    // Navigate to registration screen
    router.push("/register");
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
              <Text style={loginStyles.welcomeText}>Welcome back</Text>

              {/* Error Message */}
              {error && (
                <View style={loginStyles.errorContainer}>
                  <Text style={loginStyles.errorText}>{error}</Text>
                </View>
              )}

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
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity onPress={togglePasswordVisibility} style={loginStyles.eyeIcon}>
                  {showPassword ? (
                    <EyeOff size={18} color="#4dabf7" />
                  ) : (
                    <Eye size={18} color="#4dabf7" />
                  )}
                </TouchableOpacity>
              </View>

              {/* Login Button */}
              <TouchableOpacity
                style={loginStyles.loginButton}
                onPress={handleLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#333" size="small" />
                ) : (
                  <Text style={loginStyles.loginButtonText}>Login</Text>
                )}
              </TouchableOpacity>

              {/* Create Account Link */}
              <View style={loginStyles.createAccountContainer}>
                <Text style={loginStyles.createAccountText}>Don't have an account? </Text>
                <TouchableOpacity onPress={handleCreateAccount}>
                  <Text style={loginStyles.createAccountLink}>Create one</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </AuthWrapper>
  );
};

export default Login;
