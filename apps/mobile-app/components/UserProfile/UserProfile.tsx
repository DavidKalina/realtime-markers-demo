import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/services/ApiClient";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { ArrowLeft, Calendar, LogOut, Mail, MapPin, Shield, Trash2, User } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

interface UserProfileProps {
  onBack?: () => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ onBack }) => {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<any>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [password, setPassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch user profile data
  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        const data = await apiClient.getUserProfile();
        setProfileData(data);
      } catch (error) {
        console.error('Error fetching profile data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, []);

  // Format date for member since
  const formatMemberSince = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });
  };

  // Animation for header shadow
  const headerShadowOpacity = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#333" />

      {/* Animated Header */}
      <Animated.View
        style={[
          styles.header,
          {
            shadowOpacity: headerShadowOpacity,
            borderBottomColor: headerShadowOpacity.interpolate({
              inputRange: [0, 1],
              outputRange: ["transparent", "#3a3a3a"],
            }),
          },
        ]}
      >
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
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
            useNativeDriver: false,
          })}
        >
          {/* User Header with Avatar */}
          <View style={styles.profileHeaderCard}>
            <View style={styles.profileHeader}>
              {/* Avatar */}
              <View style={styles.avatarOuterContainer}>
                <Text style={styles.avatarText}>{getUserInitials()}</Text>
              </View>

              {/* User Info */}
              <View style={styles.userInfoContainer}>
                <Text style={styles.userName}>{user?.displayName || user?.email}</Text>

                {user?.isVerified && (
                  <View style={styles.verifiedBadge}>
                    <Shield size={12} color="#40c057" />
                    <Text style={styles.verifiedText}>VERIFIED</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Quick Stats */}
            <View style={[styles.statsContainer, { justifyContent: 'center', gap: 32 }]}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{profileData?.scanCount || 0}</Text>
                <Text style={styles.statLabel}>Scans</Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statItem}>
                <Text style={styles.statValue}>{profileData?.saveCount || 0}</Text>
                <Text style={styles.statLabel}>Saved</Text>
              </View>
            </View>
          </View>

          {/* User Details Card */}
          <View style={styles.detailsCard}>
            <Text style={styles.sectionTitle}>Account Information</Text>

            {loading ? (
              <ActivityIndicator size="large" color="#93c5fd" style={{ marginVertical: 20 }} />
            ) : (
              <>
                {/* Email Detail */}
                <View style={styles.detailItem}>
                  <View style={styles.detailIconContainer}>
                    <Mail size={18} color="#93c5fd" />
                  </View>
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Email</Text>
                    <Text style={styles.detailValue}>{profileData?.email || user?.email}</Text>
                  </View>
                </View>

                {/* Role Detail */}
                <View style={styles.detailItem}>
                  <View style={styles.detailIconContainer}>
                    <User size={18} color="#93c5fd" />
                  </View>
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Role</Text>
                    <Text style={styles.detailValue}>{profileData?.role || user?.role || 'User'}</Text>
                  </View>
                </View>

                {/* Member Since */}
                <View style={styles.detailItem}>
                  <View style={styles.detailIconContainer}>
                    <Calendar size={18} color="#93c5fd" />
                  </View>
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Member Since</Text>
                    <Text style={styles.detailValue}>
                      {profileData?.createdAt ? formatMemberSince(profileData.createdAt) : 'Loading...'}
                    </Text>
                  </View>
                </View>

                {/* Bio - if available */}
                {profileData?.bio && (
                  <View style={styles.detailItem}>
                    <View style={styles.detailIconContainer}>
                      <User size={18} color="#93c5fd" />
                    </View>
                    <View style={styles.detailContent}>
                      <Text style={styles.detailLabel}>Bio</Text>
                      <Text style={styles.detailValue}>{profileData.bio}</Text>
                    </View>
                  </View>
                )}
              </>
            )}
          </View>

          {/* Logout and Delete Section */}
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

          {/* App Version */}
          <View style={styles.versionContainer}>
            <Text style={styles.versionText}>App Version 1.0.0</Text>
          </View>
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
          <View style={styles.modalContent}>
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
            {deleteError ? <Text style={styles.errorText}>{deleteError}</Text> : null}
            
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
                  isDeleting && styles.deleteModalButtonDisabled
                ]}
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
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

// Inline styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#333",
  },

  // Header styles
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "transparent",
    backgroundColor: "#333",
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0,
    shadowRadius: 3,
    elevation: 0,
  },

  backButton: {
    padding: 8,
    borderRadius: 20,
    marginRight: 12,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
    flex: 1,
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
    backgroundColor: "#3a3a3a",
    borderRadius: 16,
    marginTop: 16,
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },

  headerGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 120,
  },

  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
  },

  avatarOuterContainer: {
    padding: 2,
    borderRadius: 36,
    width: 40,
    height: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },

  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },

  avatarText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    fontFamily: "SpaceMono",
  },

  userInfoContainer: {
    marginLeft: 16,
    flex: 1,
  },

  userName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
    marginBottom: 6,
  },

  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(64, 192, 87, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "rgba(64, 192, 87, 0.3)",
  },

  verifiedText: {
    color: "#40c057",
    fontSize: 10,
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
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },

  statItem: {
    alignItems: "center",
  },

  statValue: {
    color: "#93c5fd",
    fontFamily: "SpaceMono",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
  },

  statLabel: {
    color: "#adb5bd",
    fontFamily: "SpaceMono",
    fontSize: 12,
  },

  statDivider: {
    width: 1,
    height: "80%",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },

  // Details card
  detailsCard: {
    backgroundColor: "#3a3a3a",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#93c5fd",
    fontFamily: "SpaceMono",
    marginBottom: 16,
  },

  detailItem: {
    flexDirection: "row",
    marginBottom: 16,
  },

  detailIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },

  detailContent: {
    flex: 1,
    justifyContent: "center",
  },

  detailLabel: {
    fontSize: 13,
    color: "#adb5bd",
    fontFamily: "SpaceMono",
    marginBottom: 4,
  },

  detailValue: {
    fontSize: 15,
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
  },

  // Logout and Delete Section
  actionsSection: {
    backgroundColor: "#3a3a3a",
    borderRadius: 16,
    padding: 8,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    gap: 8,
  },

  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "rgba(249, 117, 131, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(249, 117, 131, 0.3)",
  },

  logoutText: {
    color: "#f97583",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SpaceMono",
  },

  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "rgba(220, 38, 38, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(220, 38, 38, 0.3)",
  },

  deleteText: {
    color: "#dc2626",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SpaceMono",
  },

  // Version info
  versionContainer: {
    alignItems: "center",
    marginVertical: 16,
  },

  versionText: {
    color: "#6c757d",
    fontSize: 12,
    fontFamily: "SpaceMono",
  },

  dialogText: {
    color: "#f8f9fa",
    fontSize: 16,
    marginBottom: 16,
    fontFamily: "SpaceMono",
  },

  dialogSubText: {
    color: "#adb5bd",
    fontSize: 14,
    marginBottom: 12,
    fontFamily: "SpaceMono",
  },

  passwordInput: {
    backgroundColor: "#333",
    borderRadius: 8,
    padding: 12,
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },

  errorText: {
    color: "#dc2626",
    fontSize: 14,
    marginTop: 8,
    fontFamily: "SpaceMono",
  },

  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  modalContent: {
    backgroundColor: '#3a3a3a',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#f8f9fa',
    marginBottom: 16,
    fontFamily: 'SpaceMono',
  },

  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 24,
  },

  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },

  cancelButtonText: {
    color: '#f8f9fa',
    fontSize: 16,
    fontFamily: 'SpaceMono',
  },

  deleteModalButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#dc2626',
  },

  deleteModalButtonDisabled: {
    opacity: 0.5,
  },

  deleteModalButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'SpaceMono',
  },
});

export default UserProfile;
