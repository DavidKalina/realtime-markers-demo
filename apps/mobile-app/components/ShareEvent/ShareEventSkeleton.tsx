import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { styles } from "../globalStyles";
import { StyleSheet, View } from "react-native";

export const ShareEventSkeleton = () => {
  return (
    <Animated.View
      style={styles.actionContent}
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(300)}
    >
      {/* Event Preview Card Skeleton */}
      <View style={styles.compactEventInfo}>
        <View style={styles.eventHeaderRow}>
          <View style={[localStyles.skeletonBox, { width: 30, height: 30, borderRadius: 15 }]} />
          <View style={styles.eventTextContainer}>
            <View
              style={[localStyles.skeletonBox, { width: "70%", height: 18, marginBottom: 8 }]}
            />
            <View style={[localStyles.skeletonBox, { width: "90%", height: 16 }]} />
          </View>
        </View>

        {/* Map Button Skeleton */}
        <View style={[styles.mapButton, localStyles.skeletonBox, { width: "100%", height: 40 }]} />
      </View>

      {/* Search Container Skeleton */}
      <View style={styles.searchContainer}>
        <View
          style={[styles.searchInput, localStyles.skeletonBox, { width: "100%", height: 40 }]}
        />
      </View>

      {/* Section Title Skeleton */}
      <View style={[localStyles.skeletonBox, { width: 180, height: 16, marginVertical: 12 }]} />

      {/* Contacts List Skeleton */}
      <View style={styles.contactsContainer}>
        {[...Array(8)].map((_, index) => (
          <View key={index} style={[styles.contactItem, { marginBottom: 8 }]}>
            <View style={[styles.contactAvatarPlaceholder, localStyles.skeletonBox]} />
            <View style={styles.contactInfo}>
              <View
                style={[localStyles.skeletonBox, { width: "60%", height: 16, marginBottom: 4 }]}
              />
              <View style={[localStyles.skeletonBox, { width: "40%", height: 14 }]} />
            </View>
            <View style={styles.checkboxContainer}>
              <View style={[styles.checkbox, localStyles.skeletonBox]} />
            </View>
          </View>
        ))}
      </View>

      {/* Custom Message Input Skeleton */}
      <View style={styles.customMessageContainer}>
        <View
          style={[
            styles.customMessageInput,
            localStyles.skeletonBox,
            { width: "100%", height: 80 },
          ]}
        />
      </View>

      {/* Footer Buttons Skeleton */}
      <View style={styles.footer}>
        <View style={[styles.shareButton, localStyles.skeletonBox, { width: "48%", height: 45 }]} />
        <View style={[styles.emailButton, localStyles.skeletonBox, { width: "48%", height: 45 }]} />
      </View>
    </Animated.View>
  );
};

const localStyles = StyleSheet.create({
  skeletonBox: {
    backgroundColor: "#E1E9EE",
    borderRadius: 4,
    overflow: "hidden",
  },
});
