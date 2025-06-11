import AnimatedMapBackground from "@/components/Background";
import { useAuth } from "@/contexts/AuthContext";
import { useMapStyle } from "@/contexts/MapStyleContext";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
} from "lucide-react-native";
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
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import MapMojiHeader from "../AnimationHeader";
import { AuthWrapper } from "../AuthWrapper";
import Input from "../Input/Input";
import { COLORS } from "../Layout/ScreenLayout";

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
  const { login } = useAuth();
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
      await login(email, password);
      // Keep loading state until navigation completes
      // The AuthWrapper will handle the navigation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error("Login error:", error);
      setError(
        typeof error === "object" && error !== null && "message" in error
          ? String(error.message)
          : "Failed to login. Please check your credentials and try again.",
      );
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
        return "#f59e0b";
      case "MODERATOR":
        return "#3b82f6";
      default:
        return "#64748b";
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
        <Text
          style={[
            styles.profileDropdownRole,
            { color: getRoleColor(item.role) },
          ]}
        >
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
      withSpring(1, { damping: 15, stiffness: 200 }),
    );

    // Delay the login action until after animation
    setTimeout(() => {
      Keyboard.dismiss();
      handleLogin();
    }, 150);
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
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
      borderRadius: 20,
      padding: 20,
      backgroundColor: COLORS.cardBackground,
      borderWidth: 1,
      borderColor: COLORS.divider,
      shadowColor: "rgba(0, 0, 0, 0.1)",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 8,
      position: "relative",
      overflow: "hidden",
    },

    errorContainer: {
      backgroundColor: COLORS.errorBackground,
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: COLORS.errorBorder,
    },

    errorText: {
      color: COLORS.errorText,
      fontSize: 14,
      fontFamily: "SpaceMono",
    },

    inputContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: COLORS.cardBackground,
      borderRadius: 12,
      marginBottom: 16,
      paddingHorizontal: 12,
      height: 55,
      borderWidth: 1,
      borderColor: COLORS.buttonBorder,
    },

    inputIcon: {
      marginRight: 10,
    },

    input: {
      flex: 1,
      height: "100%",
      color: COLORS.textPrimary,
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
      backgroundColor: "rgba(245, 158, 11, 0.1)",
      borderWidth: 1,
      borderColor: "rgba(245, 158, 11, 0.2)",
    },

    loginButtonText: {
      color: COLORS.accent,
      fontSize: 16,
      fontWeight: "600",
      fontFamily: "SpaceMono",
      letterSpacing: 0.5,
    },

    createAccountContainer: {
      flexDirection: "row",
      justifyContent: "center",
      marginTop: 16,
    },

    createAccountText: {
      color: COLORS.textSecondary,
      fontSize: 14,
      fontFamily: "SpaceMono",
    },

    createAccountLink: {
      color: COLORS.accent,
      fontSize: 14,
      fontWeight: "600",
      fontFamily: "SpaceMono",
    },

    profileSelectorContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: COLORS.cardBackgroundAlt,
      borderRadius: 12,
      marginBottom: 16,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: COLORS.buttonBorder,
      height: 55,
      zIndex: 4,
    },

    selectedProfileContainer: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },

    selectedProfileEmojiContainer: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: "rgba(245, 158, 11, 0.1)",
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
      borderWidth: 1,
      borderColor: "rgba(245, 158, 11, 0.2)",
    },

    profileEmojiLarge: {
      fontSize: 20,
    },

    selectedProfileName: {
      color: COLORS.textPrimary,
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
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: COLORS.buttonBackground,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
      borderWidth: 1,
      borderColor: COLORS.buttonBorder,
    },

    selectProfileText: {
      color: COLORS.textSecondary,
      fontSize: 15,
      fontFamily: "SpaceMono",
    },

    dropdownTrigger: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: COLORS.buttonBackground,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: COLORS.buttonBorder,
    },

    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.75)",
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
      zIndex: 10,
    },

    dropdownContainer: {
      width: "90%",
      maxWidth: 400,
      maxHeight: 300,
      backgroundColor: COLORS.cardBackground,
      borderRadius: 20,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: COLORS.divider,
      shadowColor: "rgba(0, 0, 0, 0.1)",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 8,
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
      borderBottomColor: COLORS.divider,
    },

    profileEmojiContainer: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: COLORS.buttonBackground,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
      borderWidth: 1,
      borderColor: COLORS.buttonBorder,
    },

    profileEmojiSmall: {
      fontSize: 20,
    },

    profileDropdownName: {
      color: COLORS.textPrimary,
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

  return (
    <AuthWrapper requireAuth={false}>
      <SafeAreaView style={styles.container}>
        <AnimatedMapBackground settings={{ styleURL: mapStyle }} />
        <StatusBar
          barStyle="light-content"
          backgroundColor={COLORS.background}
        />

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
                <Animated.View
                  layout={LinearTransition.springify()}
                  style={styles.formCard}
                >
                  <TouchableOpacity
                    style={styles.profileSelectorContainer}
                    onPress={toggleDropdown}
                    activeOpacity={0.7}
                  >
                    {selectedProfile ? (
                      <View style={styles.selectedProfileContainer}>
                        <View style={styles.selectedProfileEmojiContainer}>
                          <Text style={styles.profileEmojiLarge}>
                            {selectedProfile.emoji}
                          </Text>
                        </View>
                        <Text style={styles.selectedProfileName}>
                          {selectedProfile.name}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.noProfileContainer}>
                        <View style={styles.placeholderAvatar}>
                          <User size={14} color="#93c5fd" />
                        </View>
                        <Text style={styles.selectProfileText}>
                          Select a profile
                        </Text>
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
                    <Input
                      ref={emailInputRef}
                      icon={Mail}
                      placeholder="Email address"
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      autoComplete="email"
                      autoCorrect={false}
                      keyboardType="email-address"
                      returnKeyType="next"
                      onSubmitEditing={() => passwordInputRef.current?.focus()}
                      delay={300}
                    />

                    <Input
                      ref={passwordInputRef}
                      icon={Lock}
                      rightIcon={showPassword ? EyeOff : Eye}
                      onRightIconPress={togglePasswordVisibility}
                      placeholder="Password"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      returnKeyType="done"
                      onSubmitEditing={handleLogin}
                      delay={400}
                    />
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
                    <Text style={styles.createAccountText}>
                      Don't have an account?{" "}
                    </Text>
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

export default Login;
