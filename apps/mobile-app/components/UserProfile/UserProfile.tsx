import { useAuth } from "@/contexts/AuthContext";
import { MapStyleType, useMapStyle } from "@/contexts/MapStyleContext";
import { apiClient, PlanType } from "@/services/ApiClient";
import * as Haptics from "expo-haptics";
import {
  ArrowLeft,
  Calendar,
  LogOut,
  Mail,
  Moon,
  Shield,
  Trash2,
  User,
  Crown,
  Zap,
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  BounceIn,
  BounceOut,
  Extrapolation,
  interpolate,
  LinearTransition,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  FadeInDown,
} from "react-native-reanimated";
import { initStripe, useStripe } from "@stripe/stripe-react-native";
import { useRouter } from "expo-router";

// Initialize Stripe
initStripe({
  publishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
  merchantIdentifier: "merchant.com.mapmoji.app",
});

interface UserProfileProps {
  onBack?: () => void;
}

// Unified color theme matching ClusterEventsView
const COLORS = {
  background: "#1a1a1a",
  cardBackground: "#2a2a2a",
  textPrimary: "#f8f9fa",
  textSecondary: "#a0a0a0",
  accent: "#93c5fd",
  divider: "rgba(255, 255, 255, 0.08)",
  buttonBackground: "rgba(255, 255, 255, 0.05)",
  buttonBorder: "rgba(255, 255, 255, 0.1)",
  success: {
    background: "rgba(64, 192, 87, 0.12)",
    border: "rgba(64, 192, 87, 0.2)",
    text: "#40c057",
  },
  error: {
    background: "rgba(220, 38, 38, 0.1)",
    border: "rgba(220, 38, 38, 0.3)",
    text: "#dc2626",
  },
};

const UserProfile: React.FC<UserProfileProps> = ({ onBack }) => {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { currentStyle, setMapStyle } = useMapStyle();
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<any>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [password, setPassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [planDetails, setPlanDetails] = useState<{
    planType: PlanType;
    weeklyScanCount: number;
    scanLimit: number;
    remainingScans: number;
    lastReset: Date | null;
  } | null>(null);

  // Animation values
  const scrollY = useSharedValue(0);

  // Scroll handler
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // Animated styles
  const headerStyle = useAnimatedStyle(() => {
    const shadowOpacity = interpolate(scrollY.value, [0, 50], [0, 0.2], Extrapolation.CLAMP);

    const borderOpacity = interpolate(scrollY.value, [0, 50], [0, 1], Extrapolation.CLAMP);

    return {
      shadowOpacity,
      borderBottomColor: `rgba(58, 58, 58, ${borderOpacity})`,
    };
  });

  // Fetch user profile data
  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        const data = await apiClient.getUserProfile();
        setProfileData(data);
      } catch (error) {
        console.error("Error fetching profile data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, []);

  // Fetch plan details
  useEffect(() => {
    const fetchPlanDetails = async () => {
      try {
        const details = await apiClient.getPlanDetails();
        setPlanDetails(details);
      } catch (error) {
        console.error("Error fetching plan details:", error);
      }
    };

    fetchPlanDetails();
  }, []);

  // Format date for member since
  const formatMemberSince = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  };

  // Handle back button
  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  // Handle logout with haptic feedback
  const handleLogout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    logout();
    router.replace("/login");
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (user?.displayName) {
      const nameParts = user.displayName.split(" ");
      if (nameParts.length > 1) {
        return `${nameParts[0].charAt(0)}${nameParts[1].charAt(0)}`.toUpperCase();
      }
      return user.displayName.charAt(0).toUpperCase();
    }
    return user?.email.charAt(0).toUpperCase() || "?";
  };

  // Handle delete account
  const handleDeleteAccount = async () => {
    if (!password) {
      setDeleteError("Password is required");
      return;
    }

    setIsDeleting(true);
    setDeleteError("");

    try {
      await apiClient.deleteAccount(password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      logout(); // Logout after successful deletion
    } catch (error: any) {
      console.error("Error deleting account:", error);
      setDeleteError(error.message || "Failed to delete account");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle map style change
  const handleMapStyleChange = async (style: MapStyleType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setMapStyle(style);
  };

  // Handle plan upgrade
  const handleUpgradePlan = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const { clientSecret } = await apiClient.createStripeCheckoutSession();

      // Navigate to the checkout screen with the client secret
      router.push({
        pathname: "/checkout" as never,
        params: { sessionId: clientSecret },
      });
    } catch (error) {
      console.error("Error creating checkout session:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#333" />

      {/* Animated Header */}
      <Animated.View style={[styles.header, headerStyle]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
          <ArrowLeft size={22} color="#f8f9fa" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
      </Animated.View>

      {/* Content Area */}
      <View style={styles.contentArea}>
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
        >
          {/* User Header with Avatar */}
          <Animated.View
            entering={FadeInDown.duration(600).delay(100).springify()}
            layout={LinearTransition.springify()}
            style={styles.profileHeaderCard}
          >
            <View style={styles.profileHeader}>
              <View style={styles.avatarOuterContainer}>
                <Text style={styles.avatarText}>{getUserInitials()}</Text>
              </View>

              <View style={styles.userInfoContainer}>
                <Text style={styles.userName}>{user?.displayName || user?.email}</Text>

                {user?.isVerified && (
                  <Animated.View
                    entering={FadeInDown.duration(600).delay(200).springify()}
                    style={styles.verifiedBadge}
                  >
                    <Shield size={12} color="#40c057" />
                    <Text style={styles.verifiedText}>VERIFIED</Text>
                  </Animated.View>
                )}
              </View>
            </View>

            <Animated.View
              entering={FadeInDown.duration(600).delay(300).springify()}
              style={[styles.statsContainer, { justifyContent: "center", gap: 32 }]}
            >
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{profileData?.scanCount || 0}</Text>
                <Text style={styles.statLabel}>Scans</Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statItem}>
                <Text style={styles.statValue}>{profileData?.saveCount || 0}</Text>
                <Text style={styles.statLabel}>Saved</Text>
              </View>
            </Animated.View>
          </Animated.View>

          {/* Plan Section */}
          <Animated.View
            entering={FadeInDown.duration(600).delay(350).springify()}
            layout={LinearTransition.springify()}
            style={styles.planCard}
          >
            <View style={styles.planHeader}>
              <View style={styles.planBadge}>
                {planDetails?.planType === PlanType.PRO ? (
                  <Crown size={16} color="#fbbf24" />
                ) : (
                  <Zap size={16} color="#93c5fd" />
                )}
                <Text
                  style={[
                    styles.planBadgeText,
                    planDetails?.planType === PlanType.PRO && styles.planBadgeTextPro,
                  ]}
                >
                  {planDetails?.planType || "FREE"}
                </Text>
              </View>
              {planDetails?.planType === PlanType.FREE && (
                <TouchableOpacity
                  style={styles.upgradeButton}
                  onPress={handleUpgradePlan}
                  activeOpacity={0.8}
                >
                  <Crown size={16} color="#fbbf24" style={{ marginRight: 4 }} />
                  <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.usageContainer}>
              <View style={styles.usageHeader}>
                <Text style={styles.usageLabel}>Weekly Scans</Text>
                <Text style={styles.usageCount}>
                  {planDetails?.weeklyScanCount || 0} / {planDetails?.scanLimit || 10}
                </Text>
              </View>
              <View style={styles.progressBarContainer}>
                <View
                  style={[
                    styles.progressBar,
                    {
                      width: `${Math.min(
                        ((planDetails?.weeklyScanCount || 0) / (planDetails?.scanLimit || 10)) *
                          100,
                        100
                      )}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.usageNote}>
                {planDetails?.remainingScans || 0} scans remaining this week
              </Text>
            </View>
          </Animated.View>

          {/* User Details Card */}
          <Animated.View
            entering={FadeInDown.duration(600).delay(400).springify()}
            layout={LinearTransition.springify()}
            style={styles.detailsCard}
          >
            <Text style={styles.sectionTitle}>Account Information</Text>

            {loading ? (
              <ActivityIndicator size="large" color="#93c5fd" style={{ marginVertical: 20 }} />
            ) : (
              <Animated.View layout={LinearTransition.springify()}>
                {/* Email Detail */}
                <Animated.View
                  entering={FadeInDown.duration(600).delay(500).springify()}
                  style={styles.detailItem}
                >
                  <View style={styles.detailIconContainer}>
                    <Mail size={18} color="#93c5fd" />
                  </View>
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Email</Text>
                    <Text style={styles.detailValue}>{profileData?.email || user?.email}</Text>
                  </View>
                </Animated.View>

                {/* Role Detail */}
                <Animated.View
                  entering={FadeInDown.duration(600).delay(600).springify()}
                  style={styles.detailItem}
                >
                  <View style={styles.detailIconContainer}>
                    <User size={18} color="#93c5fd" />
                  </View>
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Role</Text>
                    <Text style={styles.detailValue}>
                      {profileData?.role || user?.role || "User"}
                    </Text>
                  </View>
                </Animated.View>

                {/* Member Since */}
                <Animated.View
                  entering={FadeInDown.duration(600).delay(700).springify()}
                  style={styles.detailItem}
                >
                  <View style={styles.detailIconContainer}>
                    <Calendar size={18} color="#93c5fd" />
                  </View>
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Member Since</Text>
                    <Text style={styles.detailValue}>
                      {profileData?.createdAt
                        ? formatMemberSince(profileData.createdAt)
                        : "Loading..."}
                    </Text>
                  </View>
                </Animated.View>

                {/* Bio - if available */}
                {profileData?.bio && (
                  <Animated.View
                    entering={FadeInDown.duration(600).delay(800).springify()}
                    style={styles.detailItem}
                  >
                    <View style={styles.detailIconContainer}>
                      <User size={18} color="#93c5fd" />
                    </View>
                    <View style={styles.detailContent}>
                      <Text style={styles.detailLabel}>Bio</Text>
                      <Text style={styles.detailValue}>{profileData.bio}</Text>
                    </View>
                  </Animated.View>
                )}

                {/* Map Style */}
                <Animated.View
                  entering={FadeInDown.duration(600).delay(900).springify()}
                  style={styles.detailItem}
                >
                  <View style={styles.detailIconContainer}>
                    <Moon size={18} color="#93c5fd" />
                  </View>
                  <View style={[styles.detailContent, { gap: 8 }]}>
                    <Text style={styles.detailLabel}>Map Style</Text>
                    <View style={styles.mapStyleButtons}>
                      <TouchableOpacity
                        style={[
                          styles.mapStyleButton,
                          currentStyle === "light" && styles.mapStyleButtonActive,
                        ]}
                        onPress={() => handleMapStyleChange("light")}
                      >
                        <Text
                          style={[
                            styles.mapStyleButtonText,
                            currentStyle === "light" && styles.mapStyleButtonTextActive,
                          ]}
                        >
                          Light
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.mapStyleButton,
                          currentStyle === "dark" && styles.mapStyleButtonActive,
                        ]}
                        onPress={() => handleMapStyleChange("dark")}
                      >
                        <Text
                          style={[
                            styles.mapStyleButtonText,
                            currentStyle === "dark" && styles.mapStyleButtonTextActive,
                          ]}
                        >
                          Dark
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.mapStyleButton,
                          currentStyle === "street" && styles.mapStyleButtonActive,
                        ]}
                        onPress={() => handleMapStyleChange("street")}
                      >
                        <Text
                          style={[
                            styles.mapStyleButtonText,
                            currentStyle === "street" && styles.mapStyleButtonTextActive,
                          ]}
                        >
                          Colorful
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </Animated.View>
              </Animated.View>
            )}
          </Animated.View>

          {/* Logout and Delete Section */}
          <Animated.View
            entering={FadeInDown.duration(600).delay(1000).springify()}
            style={styles.actionsSection}
          >
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
              activeOpacity={0.8}
            >
              <LogOut size={18} color="#f97583" style={{ marginRight: 8 }} />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                setShowDeleteDialog(true);
              }}
              activeOpacity={0.8}
            >
              <Trash2 size={18} color="#dc2626" style={{ marginRight: 8 }} />
              <Text style={styles.deleteText}>Delete Account</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* App Version */}
          <Animated.View
            entering={FadeInDown.duration(600).delay(1100).springify()}
            style={styles.versionContainer}
          >
            <Text style={styles.versionText}>App Version 1.0.0</Text>
          </Animated.View>
        </Animated.ScrollView>
      </View>

      {/* Delete Account Modal */}
      <Modal
        visible={showDeleteDialog}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowDeleteDialog(false);
          setPassword("");
          setDeleteError("");
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalContainer}
        >
          <Animated.View
            entering={BounceIn.duration(500).springify().damping(15).stiffness(200)}
            layout={LinearTransition.springify()}
            style={styles.modalContent}
          >
            <Text style={styles.modalTitle}>Delete Account</Text>
            <Text style={styles.dialogText}>
              Are you sure you want to delete your account? This action cannot be undone.
            </Text>
            <Text style={styles.dialogSubText}>
              Please enter your password to confirm deletion:
            </Text>
            <TextInput
              style={styles.passwordInput}
              secureTextEntry
              placeholder="Enter your password"
              placeholderTextColor="#666"
              value={password}
              onChangeText={setPassword}
            />
            {deleteError ? (
              <Animated.View
                entering={BounceIn.duration(500).springify().damping(15).stiffness(200)}
                exiting={BounceOut.duration(300)}
              >
                <Text style={styles.errorText}>{deleteError}</Text>
              </Animated.View>
            ) : null}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowDeleteDialog(false);
                  setPassword("");
                  setDeleteError("");
                }}
                disabled={isDeleting}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.deleteModalButton, isDeleting && styles.deleteModalButtonDisabled]}
                onPress={handleDeleteAccount}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.deleteModalButtonText}>Delete Account</Text>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

// Inline styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Header styles
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    backgroundColor: COLORS.background,
    zIndex: 10,
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.buttonBackground,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
    marginRight: 12,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    flex: 1,
    letterSpacing: 0.5,
  },

  // Content area
  contentArea: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },

  // Profile header card
  profileHeaderCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 20,
    marginTop: 12,
    marginBottom: 12,
    overflow: "hidden",
    shadowColor: "rgba(0, 0, 0, 0.5)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },

  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
  },

  avatarOuterContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.buttonBackground,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },

  avatarText: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
  },

  userInfoContainer: {
    marginLeft: 16,
    flex: 1,
  },

  userName: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    marginBottom: 8,
    letterSpacing: 0.5,
  },

  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.success.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: COLORS.success.border,
  },

  verifiedText: {
    color: COLORS.success.text,
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "SpaceMono",
    marginLeft: 4,
  },

  // Stats section
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },

  statItem: {
    alignItems: "center",
  },

  statValue: {
    color: COLORS.accent,
    fontFamily: "SpaceMono",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },

  statLabel: {
    color: COLORS.textSecondary,
    fontFamily: "SpaceMono",
    fontSize: 13,
  },

  statDivider: {
    width: 1,
    height: "80%",
    backgroundColor: COLORS.divider,
  },

  // Details card
  detailsCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: "rgba(0, 0, 0, 0.5)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    marginBottom: 20,
    letterSpacing: 0.5,
  },

  detailItem: {
    flexDirection: "row",
    marginBottom: 20,
  },

  detailIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.buttonBackground,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },

  detailContent: {
    flex: 1,
    justifyContent: "center",
  },

  detailLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: "SpaceMono",
    marginBottom: 4,
  },

  detailValue: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    lineHeight: 20,
  },

  // Map style buttons
  mapStyleButtons: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
  },

  mapStyleButton: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.buttonBackground,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
    minHeight: 32,
  },

  mapStyleButtonActive: {
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    borderColor: "rgba(147, 197, 253, 0.3)",
  },

  mapStyleButtonText: {
    fontSize: 12,
    fontFamily: "SpaceMono",
    fontWeight: "600",
    color: COLORS.textSecondary,
  },

  mapStyleButtonTextActive: {
    color: COLORS.accent,
  },

  // Actions section
  actionsSection: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
    shadowColor: "rgba(0, 0, 0, 0.5)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: COLORS.divider,
    flexDirection: "row",
    gap: 12,
  },

  logoutButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.buttonBackground,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },

  logoutText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SpaceMono",
  },

  deleteButton: {
    width: "auto",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: COLORS.error.background,
    borderWidth: 1,
    borderColor: COLORS.error.border,
  },

  deleteText: {
    color: COLORS.error.text,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SpaceMono",
  },

  // Version info
  versionContainer: {
    alignItems: "center",
    marginVertical: 16,
  },

  versionText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: "SpaceMono",
  },

  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  modalContent: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 20,
    padding: 20,
    width: "100%",
    maxWidth: 400,
    borderWidth: 1,
    borderColor: COLORS.divider,
    shadowColor: "rgba(0, 0, 0, 0.5)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 16,
    fontFamily: "SpaceMono",
    letterSpacing: 0.5,
  },

  dialogText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    marginBottom: 16,
    fontFamily: "SpaceMono",
    lineHeight: 20,
  },

  dialogSubText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginBottom: 12,
    fontFamily: "SpaceMono",
    lineHeight: 18,
  },

  passwordInput: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 12,
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },

  errorText: {
    color: COLORS.error.text,
    fontSize: 13,
    marginTop: 8,
    fontFamily: "SpaceMono",
  },

  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 24,
  },

  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: COLORS.buttonBackground,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
  },

  cancelButtonText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },

  deleteModalButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: COLORS.error.background,
    borderWidth: 1,
    borderColor: COLORS.error.border,
  },

  deleteModalButtonDisabled: {
    opacity: 0.5,
  },

  deleteModalButtonText: {
    color: COLORS.error.text,
    fontSize: 14,
    fontFamily: "SpaceMono",
    fontWeight: "600",
  },

  planCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: "rgba(0, 0, 0, 0.5)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },

  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },

  planBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.buttonBackground,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
    gap: 6,
  },

  planBadgeText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SpaceMono",
  },

  planBadgeTextPro: {
    color: "#fbbf24",
  },

  upgradeButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(251, 191, 36, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.3)",
  },

  upgradeButtonText: {
    color: "#fbbf24",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SpaceMono",
  },

  usageContainer: {
    gap: 8,
  },

  usageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  usageLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "SpaceMono",
  },

  usageCount: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SpaceMono",
  },

  progressBarContainer: {
    height: 8,
    backgroundColor: COLORS.buttonBackground,
    borderRadius: 4,
    overflow: "hidden",
  },

  progressBar: {
    height: "100%",
    backgroundColor: COLORS.accent,
    borderRadius: 4,
  },

  usageNote: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: "SpaceMono",
    marginTop: 4,
  },
});

export default UserProfile;
