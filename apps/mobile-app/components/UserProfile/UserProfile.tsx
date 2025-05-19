import { useAuth } from "@/contexts/AuthContext";
import { MapStyleType, useMapStyle } from "@/contexts/MapStyleContext";
import { apiClient, PlanType, User } from "@/services/ApiClient";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Calendar,
  ChevronRight,
  Crown,
  LogOut,
  Mail,
  Moon,
  Shield,
  Trash2,
  Users,
  User as UserIcon,
  Zap,
} from "lucide-react-native";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  BounceIn,
  BounceOut,
  FadeInDown,
  LinearTransition,
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import Card from "../Layout/Card";
import Header from "../Layout/Header";
import ScreenLayout from "../Layout/ScreenLayout";

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

// Memoized Profile Header
const ProfileHeader = React.memo(
  ({
    user,
    userInitials,
    profileData,
  }: {
    user: User | null;
    userInitials: string;
    profileData: User | null;
  }) => (
    <Card delay={100}>
      <View style={styles.profileHeader}>
        <View style={styles.avatarOuterContainer}>
          <Text style={styles.avatarText}>{userInitials}</Text>
        </View>
        <View style={styles.userInfoContainer}>
          <Text style={styles.userName}>
            {user?.displayName || user?.email}
          </Text>
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
    </Card>
  ),
);

// Memoized Plan Section
const PlanSection = React.memo(
  ({
    planDetails,
    progressWidth,
  }: {
    planDetails: {
      planType: PlanType;
      weeklyScanCount: number;
      scanLimit: number;
      remainingScans: number;
      lastReset: Date | null;
    } | null;
    progressWidth: number;
  }) => (
    <Card delay={350}>
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
                width: `${progressWidth}%`,
              },
            ]}
          />
        </View>
        <Text style={styles.usageNote}>
          {planDetails?.remainingScans || 0} scans remaining this week
        </Text>
      </View>
    </Card>
  ),
);

// Memoized Account Details
interface AccountDetailsProps {
  loading: boolean;
  profileData: User | null;
  user: User | null;
  memberSince: string;
  mapStyleButtons: JSX.Element;
  isPitched: boolean;
  togglePitch: () => Promise<void>;
}

const AccountDetails = React.memo(
  ({
    loading,
    profileData,
    user,
    memberSince,
    mapStyleButtons,
    isPitched,
    togglePitch,
  }: AccountDetailsProps) => (
    <Card delay={400}>
      <Text style={styles.sectionTitle}>Account Information</Text>
      {loading ? (
        <ActivityIndicator
          size="large"
          color="#93c5fd"
          style={{ marginVertical: 20 }}
        />
      ) : (
        <Animated.View layout={LinearTransition.springify()}>
          <Animated.View
            entering={FadeInDown.duration(600).delay(500).springify()}
            style={styles.detailItem}
          >
            <View style={styles.detailIconContainer}>
              <Mail size={18} color="#93c5fd" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Email</Text>
              <Text style={styles.detailValue}>
                {profileData?.email || user?.email}
              </Text>
            </View>
          </Animated.View>
          <Animated.View
            entering={FadeInDown.duration(600).delay(600).springify()}
            style={styles.detailItem}
          >
            <View style={styles.detailIconContainer}>
              <UserIcon size={18} color="#93c5fd" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Role</Text>
              <Text style={styles.detailValue}>
                {profileData?.role || user?.role || "User"}
              </Text>
            </View>
          </Animated.View>
          <Animated.View
            entering={FadeInDown.duration(600).delay(700).springify()}
            style={styles.detailItem}
          >
            <View style={styles.detailIconContainer}>
              <Calendar size={18} color="#93c5fd" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Member Since</Text>
              <Text style={styles.detailValue}>{memberSince}</Text>
            </View>
          </Animated.View>
          {profileData?.friendCode && (
            <Animated.View
              entering={FadeInDown.duration(600).delay(800).springify()}
              style={styles.detailItem}
            >
              <View style={styles.detailIconContainer}>
                <Users size={18} color="#93c5fd" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Friend Code</Text>
                <Text style={styles.detailValue}>{profileData.friendCode}</Text>
              </View>
            </Animated.View>
          )}
          {profileData?.bio && (
            <Animated.View
              entering={FadeInDown.duration(600).delay(900).springify()}
              style={styles.detailItem}
            >
              <View style={styles.detailIconContainer}>
                <UserIcon size={18} color="#93c5fd" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Bio</Text>
                <Text style={styles.detailValue}>{profileData.bio}</Text>
              </View>
            </Animated.View>
          )}
          <Animated.View
            entering={FadeInDown.duration(600).delay(900).springify()}
            style={styles.detailItem}
          >
            <View style={styles.detailIconContainer}>
              <Moon size={18} color="#93c5fd" />
            </View>
            <View style={[styles.detailContent, { gap: 8 }]}>
              <Text style={styles.detailLabel}>Map Style</Text>
              {mapStyleButtons}
              <TouchableOpacity
                style={[
                  styles.mapStyleButton,
                  isPitched && styles.mapStyleButtonActive,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  togglePitch();
                }}
              >
                <Text
                  style={[
                    styles.mapStyleButtonText,
                    isPitched && styles.mapStyleButtonTextActive,
                  ]}
                >
                  {isPitched ? "3D View" : "2D View"}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      )}
    </Card>
  ),
);

// Add display name for better debugging
AccountDetails.displayName = "AccountDetails";

// Memoized Actions Section
const ActionsSection = React.memo(
  ({
    handleLogout,
    setShowDeleteDialog,
  }: {
    handleLogout: () => void;
    setShowDeleteDialog: (show: boolean) => void;
  }) => (
    <Card delay={1000}>
      <View style={styles.actionsSection}>
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
      </View>
    </Card>
  ),
);

const FriendsSection = () => {
  const router = useRouter();

  return (
    <Card delay={450}>
      <Pressable
        style={styles.friendsCard}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push("/friends");
        }}
      >
        <View style={styles.friendsContent}>
          <Users size={24} color={COLORS.textPrimary} />
          <View style={styles.friendsTextContainer}>
            <Text style={styles.friendsTitle}>Friends</Text>
            <Text style={styles.friendsSubtitle}>
              View and manage your friends
            </Text>
          </View>
          <ChevronRight size={24} color={COLORS.textPrimary} />
        </View>
      </Pressable>
    </Card>
  );
};

// Add GroupsSection component after FriendsSection
const GroupsSection = () => {
  const router = useRouter();

  return (
    <Card delay={475}>
      <Pressable
        style={styles.friendsCard}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push("/create-group");
        }}
      >
        <View style={styles.friendsContent}>
          <Users size={24} color={COLORS.textPrimary} />
          <View style={styles.friendsTextContainer}>
            <Text style={styles.friendsTitle}>Create Group</Text>
            <Text style={styles.friendsSubtitle}>Start a new community</Text>
          </View>
          <ChevronRight size={24} color={COLORS.textPrimary} />
        </View>
      </Pressable>
    </Card>
  );
};

const UserProfile: React.FC<UserProfileProps> = ({ onBack }) => {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { currentStyle, setMapStyle, isPitched, togglePitch } = useMapStyle();
  const { paymentStatus } = useLocalSearchParams<{ paymentStatus?: string }>();
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<User | null>(null);
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

  // Track mounted state
  const isMountedRef = useRef(true);

  // Animation values with cleanup
  const scrollY = useSharedValue(0);

  // Scroll handler
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      scrollY.value = 0;
      isMountedRef.current = false;
    };
  }, []);

  // Handle map style change
  const handleMapStyleChange = useCallback(
    async (style: MapStyleType) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await setMapStyle(style);
    },
    [setMapStyle],
  );

  // Combined data fetching with caching
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchUserData = async () => {
      try {
        // Fetch both profile and plan details in parallel
        const [profileResponse, planResponse] = await Promise.all([
          apiClient.auth.getUserProfile(),
          apiClient.plans.getPlanDetails(),
        ]);

        if (isMounted) {
          setProfileData(profileResponse);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setPlanDetails(planResponse as any);
          setLoading(false);
        }
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") {
          console.error("Error fetching user data:", error);
          if (isMounted) {
            setLoading(false);
          }
        }
      }
    };

    fetchUserData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  // Handle payment status with local state update
  useEffect(() => {
    if (paymentStatus === "success" && planDetails) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Update plan details locally instead of refetching
      setPlanDetails((prev) =>
        prev
          ? {
              ...prev,
              planType: PlanType.PRO,
              scanLimit: 100, // Assuming PRO plan has 100 scans
              remainingScans: 100 - (prev.weeklyScanCount || 0),
            }
          : null,
      );
    } else if (paymentStatus === "cancel") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }, [paymentStatus]);

  // Memoize expensive calculations
  const userInitials = useMemo(() => {
    if (user?.displayName) {
      const nameParts = user.displayName.split(" ");
      if (nameParts.length > 1) {
        return `${nameParts[0].charAt(0)}${nameParts[1].charAt(0)}`.toUpperCase();
      }
      return user.displayName.charAt(0).toUpperCase();
    }
    return user?.email.charAt(0).toUpperCase() || "?";
  }, [user?.displayName, user?.email]);

  // Memoize formatted date
  const memberSince = useMemo(() => {
    return profileData?.createdAt
      ? new Date(profileData.createdAt).toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        })
      : "Loading...";
  }, [profileData?.createdAt]);

  // Memoize progress bar width
  const progressWidth = useMemo(() => {
    return Math.min(
      ((planDetails?.weeklyScanCount || 0) / (planDetails?.scanLimit || 10)) *
        100,
      100,
    );
  }, [planDetails?.weeklyScanCount, planDetails?.scanLimit]);

  // Memoize map style buttons to prevent unnecessary re-renders
  const mapStyleButtons = useMemo(
    () => (
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
    ),
    [currentStyle, handleMapStyleChange],
  );

  // Handle back button
  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onBack) {
      onBack();
    } else {
      router.push("/");
    }
  };

  // Handle logout with haptic feedback
  const handleLogout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    logout();
    router.replace("/login");
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
      await apiClient.auth.deleteAccount(password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      logout(); // Logout after successful deletion
    } catch (error) {
      console.error("Error deleting account:", error);
      setDeleteError(
        error instanceof Error ? error.message : "Failed to delete account",
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <ScreenLayout>
      <Header title="Profile" onBack={handleBack} />

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        <ProfileHeader
          user={user}
          userInitials={userInitials}
          profileData={profileData}
        />
        <PlanSection planDetails={planDetails} progressWidth={progressWidth} />
        <FriendsSection />
        <GroupsSection />
        <AccountDetails
          loading={loading}
          profileData={profileData}
          user={user}
          memberSince={memberSince}
          mapStyleButtons={mapStyleButtons}
          isPitched={isPitched}
          togglePitch={togglePitch}
        />
        <ActionsSection
          handleLogout={handleLogout}
          setShowDeleteDialog={setShowDeleteDialog}
        />
        <Animated.View
          entering={FadeInDown.duration(600).delay(1100).springify()}
          style={styles.versionContainer}
        >
          <Text style={styles.versionText}>App Version 1.0.0</Text>
        </Animated.View>
      </Animated.ScrollView>

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
            entering={BounceIn.duration(500)
              .springify()
              .damping(15)
              .stiffness(200)}
            layout={LinearTransition.springify()}
            style={styles.modalContent}
          >
            <Text style={styles.modalTitle}>Delete Account</Text>
            <Text style={styles.dialogText}>
              Are you sure you want to delete your account? This action cannot
              be undone.
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
                entering={BounceIn.duration(500)
                  .springify()
                  .damping(15)
                  .stiffness(200)}
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
                style={[
                  styles.deleteModalButton,
                  isDeleting && styles.deleteModalButtonDisabled,
                ]}
                onPress={handleDeleteAccount}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.deleteModalButtonText}>
                    Delete Account
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenLayout>
  );
};

// Inline styles
const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },

  // Profile header styles
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

  // Details section
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

  // Plan section styles
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

  friendsCard: {
    borderRadius: 12,
    padding: 16,
  },

  friendsContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  friendsTextContainer: {
    flex: 1,
    marginLeft: 16,
  },

  friendsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    marginBottom: 4,
  },

  friendsSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: "SpaceMono",
  },
});

export default UserProfile;
