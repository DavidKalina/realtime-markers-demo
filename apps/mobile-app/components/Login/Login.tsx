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
import ProfileFloatingEmoji from "./ProfileEmoji";
import { styles } from "./styles";

// Define types for our data
interface Profile {
  id: string;
  name: string;
  email: string;
  password: string;
  avatar: string;
  role: string;
  emoji: string;
}

// Test profiles data
const TEST_PROFILES: Profile[] = [
  {
    id: "1",
    name: "Admin User",
    email: "admin@example.com",
    password: "admin123",
    avatar: "https://randomuser.me/api/portraits/men/1.jpg",
    role: "ADMIN",
    emoji: "👑",
  },
  {
    id: "2",
    name: "Mod User",
    email: "moderator@example.com",
    password: "moderator123",
    avatar: "https://randomuser.me/api/portraits/women/2.jpg",
    role: "MODERATOR",
    emoji: "🛡️",
  },
  {
    id: "3",
    name: "Test User 1",
    email: "user1@example.com",
    password: "user123",
    avatar: "https://randomuser.me/api/portraits/men/3.jpg",
    role: "USER",
    emoji: "🙂",
  },
  {
    id: "4",
    name: "Test User 2",
    email: "user2@example.com",
    password: "user123",
    avatar: "https://randomuser.me/api/portraits/women/4.jpg",
    role: "USER",
    emoji: "😎",
  },
  {
    id: "5",
    name: "Unverified User",
    email: "unverified@example.com",
    password: "test123",
    avatar: "https://randomuser.me/api/portraits/men/5.jpg",
    role: "USER",
    emoji: "🤔",
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

  // Helper function to get role color
  const getRoleColor = (role: string) => {
    switch (role.toUpperCase()) {
      case "ADMIN":
        return "#FFD700"; // Gold
      case "MODERATOR":
        return "#4dabf7"; // Blue
      default:
        return "#aaa"; // Grey
    }
  };

  return (
    <AuthWrapper requireAuth={false}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#333" />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoidingView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.formContainer}>
              {/* Profile Selector (Dropdown Trigger) */}
              <View style={styles.profileSelectorContainer}>
                {selectedProfile ? (
                  <View style={styles.selectedProfileContainer}>
                    <Text>{selectedProfile.emoji}</Text>
                    <Text style={{ color: "#fff", fontFamily: "SpaceMono" }}>
                      {selectedProfile.name}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.noProfileContainer}>
                    <View style={styles.placeholderAvatar}>
                      <User size={24} color="#4dabf7" />
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
                    <ChevronUp size={24} color="#4dabf7" />
                  ) : (
                    <ChevronDown size={24} color="#4dabf7" />
                  )}
                </TouchableOpacity>
              </View>

              {/* Profile Dropdown Modal */}
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

              {/* Error Message */}
              {error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* Email Input */}
              <View style={styles.inputContainer}>
                <Mail size={18} color="#4dabf7" style={styles.inputIcon} />
                <TextInput
                  ref={emailInputRef}
                  style={styles.input}
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
                  editable={!selectedProfile} // Disable when profile is selected
                />
              </View>

              {/* Password Input */}
              <View style={styles.inputContainer}>
                <Lock size={18} color="#4dabf7" style={styles.inputIcon} />
                <TextInput
                  ref={passwordInputRef}
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#919191"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  editable={!selectedProfile} // Disable when profile is selected
                />
                <TouchableOpacity onPress={togglePasswordVisibility} style={styles.eyeIcon}>
                  {showPassword ? (
                    <EyeOff size={18} color="#4dabf7" />
                  ) : (
                    <Eye size={18} color="#4dabf7" />
                  )}
                </TouchableOpacity>
              </View>

              {/* Login Button */}
              <TouchableOpacity
                style={styles.loginButton}
                onPress={handleLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#333" size="small" />
                ) : (
                  <Text style={styles.loginButtonText}>Login</Text>
                )}
              </TouchableOpacity>

              {/* Toggle to Manual Input */}
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

              {/* Create Account Link */}
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
