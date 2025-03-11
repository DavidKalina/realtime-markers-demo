import apiClient from "@/services/ApiClient";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Eye, EyeOff, Lock, Mail, ChevronDown, ChevronUp, User } from "lucide-react-native";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
  FlatList,
} from "react-native";
import { AuthWrapper } from "../AuthWrapper";
import { styles } from "./styles"; // Import the updated light styles
import MapMojiHeader from "../AnimationHeader";
import AnimatedGlobeBackground from "../Background"; // Using the light-themed globe background

// Define types for our data
interface Profile {
  id: string;
  name: string;
  email: string;
  password: string;
  role: string;
  emoji: string;
}

// Test profiles data (unchanged)
const TEST_PROFILES: Profile[] = [
  {
    id: "073f24d8-14a2-4ed7-a6c2-a28e980a4b02",
    email: "david@example.com",
    password: "password123!",
    name: "David K",
    role: "ADMIN",
    emoji: "☕",
  },
  {
    id: "074f24d8-14a2-4ed7-a6c2-a28e980a4b01",
    email: "josh@example.com",
    password: "password123!",
    name: "Josh K",
    role: "ADMIN",
    emoji: "🏎️",
  },
  {
    id: "35c1bd3d-70b9-4ec3-8a3c-f16e045a6813",
    email: "james@example.com",
    password: "password123!",
    name: "James H.",
    role: "ADMIN",
    emoji: "🛹",
  },
  {
    id: "4fe1d170-2895-4355-8f6d-0218889170dc",
    email: "jared@example.com",
    password: "password123!",
    name: "Jared B.",
    role: "ADMIN",
    emoji: "👨‍💻",
  },
  {
    id: "9ebdc75b-c023-4c3e-a72c-d4d300f3e13b",
    email: "garrett@example.com",
    password: "password123!",
    name: "Garret L.",
    role: "ADMIN",
    emoji: "💪",
  },
];

const Login: React.FC = () => {
  const router = useRouter();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);

  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

  const handleSelectProfile = (profile: Profile) => {
    Haptics.selectionAsync();
    setSelectedProfile(profile);
    setEmail(profile.email);
    setPassword(profile.password);
    setError(null);
    setIsDropdownOpen(false);
  };

  const toggleDropdown = () => {
    Haptics.selectionAsync();
    setIsDropdownOpen(!isDropdownOpen);
  };

  const togglePasswordVisibility = () => {
    Haptics.selectionAsync();
    setShowPassword(!showPassword);
  };

  const handleLogin = async () => {
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
      router.replace("/");
    } catch (error: any) {
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
    router.push("/register");
  };

  // Helper function to get role color - adjusted for light theme
  const getRoleColor = (role: string) => {
    switch (role.toUpperCase()) {
      case "ADMIN":
        return "#e6bc00"; // Darker gold for better contrast
      case "MODERATOR":
        return "#1a8fe3"; // Darker blue for better contrast
      default:
        return "#666"; // Darker gray for better contrast
    }
  };

  const renderProfileItem = ({ item }: { item: Profile }) => {
    return (
      <TouchableOpacity
        onPress={() => handleSelectProfile(item)}
        style={styles.profileDropdownItem}
        activeOpacity={0.7}
      >
        <Text style={styles.profileEmojiSmall}>{item.emoji}</Text>
        <Text style={styles.profileDropdownName}>{item.name}</Text>
        <Text style={[styles.profileDropdownRole, { color: getRoleColor(item.role) }]}>
          {item.role}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <AuthWrapper requireAuth={false}>
      <SafeAreaView style={styles.container}>
        <AnimatedGlobeBackground />
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.headerContainer}>
          <MapMojiHeader />
        </View>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoidingView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.formContainer}>
              <TouchableOpacity style={styles.profileSelectorContainer} onPress={toggleDropdown}>
                {selectedProfile ? (
                  <View style={styles.selectedProfileContainer}>
                    <Text>{selectedProfile.emoji}</Text>
                    <Text style={{ color: "#333", fontFamily: "SpaceMono" }}>
                      {selectedProfile.name}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.noProfileContainer}>
                    <View style={styles.placeholderAvatar}>
                      <User size={14} color="#4dabf7" />
                    </View>
                    <Text style={styles.selectProfileText}>Select a profile</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.dropdownTrigger}
                  onPress={toggleDropdown}
                  activeOpacity={0.7}
                >
                  {isDropdownOpen ? (
                    <ChevronUp size={14} color="#4dabf7" />
                  ) : (
                    <ChevronDown size={14} color="#4dabf7" />
                  )}
                </TouchableOpacity>
              </TouchableOpacity>

              <Modal
                visible={isDropdownOpen}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsDropdownOpen(false)}
              >
                <TouchableOpacity
                  style={styles.modalOverlay}
                  activeOpacity={1}
                  onPress={() => setIsDropdownOpen(false)}
                >
                  <View style={styles.dropdownContainer}>
                    <FlatList
                      data={TEST_PROFILES}
                      renderItem={renderProfileItem}
                      keyExtractor={(item) => item.id}
                      showsVerticalScrollIndicator={false}
                      style={styles.profileList}
                    />
                  </View>
                </TouchableOpacity>
              </Modal>

              {error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <View style={styles.inputContainer}>
                <Mail size={18} color="#4dabf7" style={styles.inputIcon} />
                <TextInput
                  ref={emailInputRef}
                  style={styles.input}
                  placeholder="Email address"
                  placeholderTextColor="#999"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  keyboardType="email-address"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordInputRef.current?.focus()}
                  editable={!selectedProfile}
                />
              </View>

              {/* Password Input */}
              <View style={styles.inputContainer}>
                <Lock size={18} color="#4dabf7" style={styles.inputIcon} />
                <TextInput
                  ref={passwordInputRef}
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#999"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  editable={!selectedProfile}
                />
                <TouchableOpacity onPress={togglePasswordVisibility} style={styles.eyeIcon}>
                  {showPassword ? (
                    <EyeOff size={18} color="#4dabf7" />
                  ) : (
                    <Eye size={18} color="#4dabf7" />
                  )}
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.loginButton}
                onPress={handleLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.loginButtonText}>Login</Text>
                )}
              </TouchableOpacity>

              {selectedProfile && (
                <TouchableOpacity
                  onPress={() => {
                    setSelectedProfile(null);
                    setEmail("");
                    setPassword("");
                  }}
                  style={styles.toggleManualButton}
                >
                  <Text style={styles.toggleManualText}>Use different credentials</Text>
                </TouchableOpacity>
              )}

              <View style={styles.createAccountContainer}>
                <Text style={styles.createAccountText}>Don't have an account? </Text>
                <TouchableOpacity onPress={handleCreateAccount}>
                  <Text style={styles.createAccountLink}>Create one</Text>
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
