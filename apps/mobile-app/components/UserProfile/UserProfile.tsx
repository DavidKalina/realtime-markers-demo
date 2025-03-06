import { useAuth } from "@/contexts/AuthContext";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { ArrowLeft, LogOut, Mail, User } from "lucide-react-native";
import React, { useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { styles } from "./styles";

interface UserProfileProps {
  onBack?: () => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ onBack }) => {
  const router = useRouter();

  const { user } = useAuth();

  const { logout } = useAuth();

  // Fetch user profile details

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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#333" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <ArrowLeft size={22} color="#f8f9fa" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>User Profile</Text>
      </View>

      {/* Content Area */}
      <View style={styles.contentArea}>
        <Animated.View entering={FadeIn.duration(300)} style={styles.userContainer}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* User Header with Avatar Placeholder and Username */}
            <View style={styles.userHeaderContainer}>
              <View style={styles.avatarContainer}>
                <Text style={styles.avatarText}>
                  {user?.displayName
                    ? user?.displayName.charAt(0).toUpperCase()
                    : user?.email.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.userTitleWrapper}>
                <Text style={styles.resultTitle}>{user?.displayName || user?.email}</Text>
                {user?.isVerified && (
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>VERIFIED</Text>
                  </View>
                )}
              </View>
            </View>

            {/* User Details */}
            <View style={styles.detailsContainer}>
              <View style={styles.detailSection}>
                <View style={styles.resultDetailsRow}>
                  <Mail size={16} color="#93c5fd" style={{ marginRight: 8 }} />
                  <Text style={styles.detailLabel}>Email</Text>
                </View>
                <Text style={styles.detailValue}>{user?.email}</Text>
              </View>

              <View style={styles.detailSection}>
                <View style={styles.resultDetailsRow}>
                  <User size={16} color="#93c5fd" style={{ marginRight: 8 }} />
                  <Text style={styles.detailLabel}>Role</Text>
                </View>
                <Text style={styles.detailValue}>{user?.role}</Text>
              </View>

              {/* Logout Button */}
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton, { marginTop: 20 }]}
                onPress={handleLogout}
              >
                <LogOut size={16} color="#adb5bd" style={{ marginRight: 8 }} />
                <Text style={styles.cancelButtonText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
};

export default UserProfile;
