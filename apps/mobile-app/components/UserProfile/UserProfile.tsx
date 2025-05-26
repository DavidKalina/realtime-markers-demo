import { useAuth } from "@/contexts/AuthContext";
import { useMapStyle } from "@/contexts/MapStyleContext";
import { useProfile } from "@/hooks/useProfile";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import Banner from "../Layout/Banner";
import ScreenLayout, { COLORS } from "../Layout/ScreenLayout";
import AccountDetailsComponent from "./AccountDetails";
import ActionsSectionComponent from "./ActionsSection";
import DeleteAccountModalComponent from "./DeleteAccountModal";
import PlanSectionComponent from "./PlanSection";

interface UserProfileProps {
  onBack?: () => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ onBack }) => {
  const { user } = useAuth();
  const { currentStyle, isPitched, togglePitch } = useMapStyle();
  const {
    loading,
    profileData,
    planDetails,
    memberSince,
    progressWidth,
    deleteError,
    isDeleting,
    showDeleteDialog,
    password,
    handleMapStyleChange,
    handleBack,
    handleLogout,
    handleDeleteAccount,
    handleCloseDeleteDialog,
    setShowDeleteDialog,
    setPassword,
  } = useProfile(onBack);

  // Animation values
  const scrollY = useSharedValue(0);

  // Scroll handler
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

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

  if (loading) {
    return (
      <ScreenLayout>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#93c5fd" />
          <Text style={styles.loadingText}>Loading Profile...</Text>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        <Banner
          emoji="👤"
          name={user?.displayName || user?.email || ""}
          description={
            profileData?.bio || "View and manage your profile settings"
          }
          onBack={handleBack}
          scrollY={scrollY}
        />

        <PlanSectionComponent
          planDetails={planDetails}
          progressWidth={progressWidth}
        />
        <AccountDetailsComponent
          profileData={profileData}
          user={user}
          memberSince={memberSince}
          mapStyleButtons={mapStyleButtons}
          isPitched={isPitched}
          togglePitch={togglePitch}
        />
        <ActionsSectionComponent
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

      <DeleteAccountModalComponent
        visible={showDeleteDialog}
        password={password}
        setPassword={setPassword}
        deleteError={deleteError}
        isDeleting={isDeleting}
        onClose={handleCloseDeleteDialog}
        onDelete={handleDeleteAccount}
      />
    </ScreenLayout>
  );
};

// Inline styles
const styles = StyleSheet.create({
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

  // Loading state
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
  },

  loadingText: {
    marginTop: 12,
    color: "#a0a0a0",
    fontSize: 14,
    fontFamily: "SpaceMono",
  },
});

export default UserProfile;
