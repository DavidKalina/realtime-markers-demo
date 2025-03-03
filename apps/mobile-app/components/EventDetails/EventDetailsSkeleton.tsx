import { StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { styles } from "../globalStyles";

export const EventDetailsSkeleton = () => {
  return (
    <Animated.View
      style={styles.actionContent}
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(300)}
    >
      <View style={styles.eventHeader}>
        <View style={styles.eventTitleContainer}>
          <View style={[localStyles.skeletonBox, { width: 30, height: 30, borderRadius: 15 }]} />
          <View style={[localStyles.skeletonBox, { width: "70%", height: 24, marginLeft: 10 }]} />
        </View>
        <View style={[localStyles.skeletonBox, { width: 80, height: 24 }]} />
      </View>

      <View style={styles.detailsContainer}>
        {/* Date & Time */}
        <View style={styles.detailRow}>
          <View style={[localStyles.skeletonBox, { width: 100, height: 16 }]} />
          <View style={[localStyles.skeletonBox, { width: "60%", height: 16 }]} />
        </View>

        {/* Location */}
        <View style={styles.detailRow}>
          <View style={[localStyles.skeletonBox, { width: 100, height: 16 }]} />
          <View style={[localStyles.skeletonBox, { width: "50%", height: 16 }]} />
        </View>

        {/* Distance */}
        <View style={styles.detailRow}>
          <View style={[localStyles.skeletonBox, { width: 100, height: 16 }]} />
          <View style={[localStyles.skeletonBox, { width: "30%", height: 16 }]} />
        </View>

        {/* Description */}
        <View style={styles.detailRow}>
          <View style={[localStyles.skeletonBox, { width: 100, height: 16 }]} />
          <View style={localStyles.descriptionSkeleton}>
            <View
              style={[localStyles.skeletonBox, { width: "100%", height: 16, marginBottom: 8 }]}
            />
            <View
              style={[localStyles.skeletonBox, { width: "90%", height: 16, marginBottom: 8 }]}
            />
            <View style={[localStyles.skeletonBox, { width: "80%", height: 16 }]} />
          </View>
        </View>

        {/* Categories */}
        <View style={styles.detailRow}>
          <View style={[localStyles.skeletonBox, { width: 100, height: 16 }]} />
          <View style={styles.categoriesContainer}>
            <View
              style={[
                localStyles.skeletonBox,
                { width: 80, height: 24, borderRadius: 12, marginRight: 8 },
              ]}
            />
            <View
              style={[
                localStyles.skeletonBox,
                { width: 80, height: 24, borderRadius: 12, marginRight: 8 },
              ]}
            />
            <View style={[localStyles.skeletonBox, { width: 80, height: 24, borderRadius: 12 }]} />
          </View>
        </View>
      </View>
    </Animated.View>
  );
};
const localStyles = StyleSheet.create({
  skeletonBox: {
    backgroundColor: "#E1E9EE",
    borderRadius: 4,
    overflow: "hidden",
    marginTop: 2,
    marginBottom: 2,
  },
  descriptionSkeleton: {
    width: "70%",
  },
});
