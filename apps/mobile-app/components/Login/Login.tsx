import AnimatedMapBackground from "@/components/Background";
import { useMapStyle } from "@/contexts/MapStyleContext";
import apiClient from "@/services/ApiClient";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { ChevronDown, ChevronUp, Eye, EyeOff, Lock, Mail, User } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  FadeInDown
} from "react-native-reanimated";
import MapMojiHeader from "../AnimationHeader";
import { AuthWrapper } from "../AuthWrapper";

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
];

const Login: React.FC = () => {
  const router = useRouter();
  const { mapStyle } = useMapStyle();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const isMounted = useRef(true);

  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const buttonScale = useSharedValue(1);

  const buttonAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: buttonScale.value }],
    };
  });

  // Cleanup effect
  useEffect(() => {
    return () => {
      isMounted.current = false;
      // Ensure modal is closed on unmount
      setIsDropdownOpen(false);
    };
  }, []);

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

  const getRoleColor = (role: string) => {
    switch (role.toUpperCase()) {
      case "ADMIN":
        return "#ffcc00";
      case "MODERATOR":
        return "#4dabf7";
      default:
        return "#adb5bd";
    }
  };

  const renderProfileItem = ({ item }: { item: Profile }) => {
    return (
      <TouchableOpacity
        onPress={() => handleSelectProfile(item)}
        style={styles.profileDropdownItem}
        activeOpacity={0.7}
      >
        <View style={styles.profileEmojiContainer}>
          <Text style={styles.profileEmojiSmall}>{item.emoji}</Text>
        </View>
        <Text style={styles.profileDropdownName}>{item.name}</Text>
        <Text style={[styles.profileDropdownRole, { color: getRoleColor(item.role) }]}>
          {item.role}
        </Text>
      </TouchableOpacity>
    );
  };

  const handleLoginPress = async () => {
    if (isLoading) return;

    // Trigger haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Animate button press
    buttonScale.value = withSequence(
      withSpring(0.95, { damping: 15, stiffness: 200 }),
      withSpring(1, { damping: 15, stiffness: 200 })
    );

    // Delay the login action until after animation
    setTimeout(() => {
      Keyboard.dismiss();
      handleLogin();
    }, 150);
  };

  return (
    <AuthWrapper requireAuth={false}>
      <SafeAreaView style={styles.container}>
        <AnimatedMapBackground settings={{ styleURL: mapStyle }} />
        <StatusBar barStyle="light-content" backgroundColor="#333" />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoidingView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View
              entering={FadeInDown.duration(600).delay(100).springify()}
              style={styles.contentContainer}
            >
              <MapMojiHeader />

              <Animated.View
                entering={FadeInDown.duration(600).delay(300).springify()}
                layout={LinearTransition.springify()}
                style={styles.formContainer}
              >
                <Animated.View layout={LinearTransition.springify()} style={styles.formCard}>
                  <TouchableOpacity
                    style={styles.profileSelectorContainer}
                    onPress={toggleDropdown}
                    activeOpacity={0.7}
                  >
                    {selectedProfile ? (
                      <View style={styles.selectedProfileContainer}>
                        <View style={styles.selectedProfileEmojiContainer}>
                          <Text style={styles.profileEmojiLarge}>{selectedProfile.emoji}</Text>
                        </View>
                        <Text style={styles.selectedProfileName}>{selectedProfile.name}</Text>
                      </View>
                    ) : (
                      <View style={styles.noProfileContainer}>
                        <View style={styles.placeholderAvatar}>
                          <User size={14} color="#93c5fd" />
                        </View>
                        <Text style={styles.selectProfileText}>Select a profile</Text>
                      </View>
                    )}

                    <View style={styles.dropdownTrigger}>
                      {isDropdownOpen ? (
                        <ChevronUp size={14} color="#93c5fd" />
                      ) : (
                        <ChevronDown size={14} color="#93c5fd" />
                      )}
                    </View>
                  </TouchableOpacity>

                  {error && (
                    <View style={styles.errorContainer}>
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  )}

                  <View style={{ gap: 16 }}>
                    <View style={styles.inputContainer}>
                      <Mail size={18} color="#93c5fd" style={styles.inputIcon} />
                      <TextInput
                        ref={emailInputRef}
                        style={styles.input}
                        placeholder="Email address"
                        placeholderTextColor="#808080"
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

                    <View style={styles.inputContainer}>
                      <Lock size={18} color="#93c5fd" style={styles.inputIcon} />
                      <TextInput
                        ref={passwordInputRef}
                        style={styles.input}
                        placeholder="Password"
                        placeholderTextColor="#808080"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        returnKeyType="done"
                        onSubmitEditing={handleLogin}
                      />
                      <TouchableOpacity onPress={togglePasswordVisibility} style={styles.eyeIcon}>
                        {showPassword ? (
                          <EyeOff size={18} color="#93c5fd" />
                        ) : (
                          <Eye size={18} color="#93c5fd" />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.loginButtonContainer}>
                    <TouchableOpacity
                      onPress={handleLoginPress}
                      disabled={isLoading}
                      activeOpacity={0.7}
                      style={[styles.loginButton, buttonAnimatedStyle]}
                    >
                      {isLoading ? (
                        <ActivityIndicator size="small" color="#000" />
                      ) : (
                        <Text style={styles.loginButtonText}>Login</Text>
                      )}
                    </TouchableOpacity>
                  </View>

                  <View style={styles.createAccountContainer}>
                    <Text style={styles.createAccountText}>Don't have an account? </Text>
                    <TouchableOpacity onPress={handleCreateAccount}>
                      <Text style={styles.createAccountLink}>Create one</Text>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              </Animated.View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>

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
      </SafeAreaView>
    </AuthWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },

  keyboardAvoidingView: {
    flex: 1,
    zIndex: 2,
  },

  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },

  contentContainer: {
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },

  formContainer: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    zIndex: 2,
  },

  formCard: {
    width: "100%",
    borderRadius: 16,
    padding: 20,
    backgroundColor: "rgba(58, 58, 58, 0.75)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
    position: "relative",
    overflow: "hidden",
  },

  formGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  errorContainer: {
    backgroundColor: "rgba(255, 70, 70, 0.2)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 70, 70, 0.3)",
  },

  errorText: {
    color: "#ff7675",
    fontSize: 14,
    fontFamily: "SpaceMono",
  },

  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(45, 45, 45, 0.8)",
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 12,
    height: 55,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },

  inputIcon: {
    marginRight: 10,
  },

  input: {
    flex: 1,
    height: "100%",
    color: "#f8f9fa",
    fontSize: 16,
    fontFamily: "SpaceMono",
  },

  eyeIcon: {
    padding: 8,
  },

  loginButton: {
    borderRadius: 12,
    height: 55,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 20,
    shadowColor: "#4dabf7",
    backgroundColor: "#4dabf7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    overflow: "hidden",
  },

  loginButtonText: {
    color: "black",
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "SpaceMono",
  },

  toggleManualButton: {
    alignSelf: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
  },

  toggleManualText: {
    color: "#adb5bd",
    fontSize: 14,
    textDecorationLine: "underline",
    fontFamily: "SpaceMono",
  },

  createAccountContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 16,
  },

  createAccountText: {
    color: "#adb5bd",
    fontSize: 14,
    fontFamily: "SpaceMono",
  },

  createAccountLink: {
    color: "#93c5fd",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SpaceMono",
  },

  profileSelectorContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(45, 45, 45, 0.8)",
    borderRadius: 12,
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    height: 55,
    zIndex: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },

  selectedProfileContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  selectedProfileEmojiContainer: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.3)",
  },

  profileEmojiLarge: {
    fontSize: 18,
  },

  selectedProfileName: {
    color: "#f8f9fa",
    fontSize: 15,
    fontWeight: "500",
    fontFamily: "SpaceMono",
  },

  noProfileContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  placeholderAvatar: {
    width: 24,
    height: 24,
    borderRadius: 23,
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.3)",
  },

  selectProfileText: {
    color: "#adb5bd",
    fontSize: 15,
    fontFamily: "SpaceMono",
  },

  dropdownTrigger: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(147, 197, 253, 0.15)",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    zIndex: 10,
  },

  dropdownContainer: {
    width: "90%",
    maxWidth: 400,
    maxHeight: 300,
    backgroundColor: "#3a3a3a",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },

  profileList: {
    width: "100%",
    paddingVertical: 4,
  },

  profileDropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },

  profileEmojiContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.3)",
  },

  profileEmojiSmall: {
    fontSize: 18,
  },

  profileDropdownName: {
    color: "#f8f9fa",
    fontSize: 15,
    fontFamily: "SpaceMono",
    flex: 1,
  },

  profileDropdownRole: {
    fontSize: 12,
    fontFamily: "SpaceMono",
    fontWeight: "600",
    textTransform: "uppercase",
  },

  loginButtonContainer: {
    marginTop: 20,
  },
});

export default Login;
