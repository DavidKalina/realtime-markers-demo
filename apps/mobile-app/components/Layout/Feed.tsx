import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from "react-native";
import {
  useColors,
  type Colors,
  spacing,
  radius,
  fontSize,
  fontWeight,
  fontFamily,
  lineHeight,
  spring,
} from "@/theme";
import { LucideIcon } from "lucide-react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from "react-native-reanimated";
import Button from "./Button";

export interface FeedItem {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  timestamp: string;
  onPress?: () => void;
  badge?: string | number;
  isRead?: boolean;
}

export interface FeedProps {
  items: FeedItem[];
  onItemPress?: (item: FeedItem) => void;
  onViewAllPress?: () => void;
  emptyState?: {
    icon: LucideIcon;
    title: string;
    description: string;
  };
  maxItems?: number;
  style?: ViewStyle;
}

const FeedItem = React.memo<{
  item: FeedItem;
  onPress?: (item: FeedItem) => void;
}>(({ item, onPress }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const Icon = item.icon;
  const scale = useSharedValue(1);

  const handlePress = () => {
    scale.value = withSpring(0.98, spring.soft);
    setTimeout(() => {
      scale.value = withSpring(1, spring.soft);
    }, 100);

    if (onPress) {
      onPress(item);
    } else if (item.onPress) {
      item.onPress();
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.itemContainer, animatedStyle]}>
      <TouchableOpacity
        style={styles.item}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        <View
          style={[
            styles.itemIconContainer,
            !item.isRead && styles.unreadIconContainer,
          ]}
        >
          <Icon
            size={20}
            color={item.isRead ? colors.text.secondary : colors.accent.primary}
            style={styles.itemIcon}
          />
          {item.badge && (
            <Animated.View
              style={styles.badgeContainer}
              entering={FadeInDown.duration(200).springify()}
            >
              <Text style={styles.badgeText}>{item.badge}</Text>
            </Animated.View>
          )}
        </View>
        <View style={styles.itemContent}>
          <Text
            style={[styles.itemTitle, !item.isRead && styles.unreadItemTitle]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          <Text style={styles.itemDescription} numberOfLines={2}>
            {item.description}
          </Text>
          <Text style={styles.itemTimestamp}>{item.timestamp}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

const EmptyState = React.memo<{
  icon: LucideIcon;
  title: string;
  description: string;
}>(({ icon: Icon, title, description }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Animated.View
      style={styles.emptyStateContainer}
      entering={FadeIn.duration(400).springify()}
    >
      <View style={styles.emptyStateIconContainer}>
        <Icon
          size={40}
          color={colors.accent.primary}
          style={styles.emptyStateIcon}
        />
      </View>
      <Text style={styles.emptyStateTitle}>{title}</Text>
      <Text style={styles.emptyStateDescription}>{description}</Text>
    </Animated.View>
  );
});

const Feed: React.FC<FeedProps> = ({
  items,
  onItemPress,
  onViewAllPress,
  emptyState,
  maxItems = 3,
  style,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const displayItems = items.slice(0, maxItems);
  const hasMore = items.length > maxItems;

  if (items.length === 0 && emptyState) {
    return <EmptyState {...emptyState} />;
  }

  return (
    <Animated.View
      style={[styles.container, style]}
      entering={FadeIn.duration(300)}
    >
      <View style={styles.itemsContainer}>
        {displayItems.map((item) => (
          <FeedItem key={item.id} item={item} onPress={onItemPress} />
        ))}
      </View>
      {hasMore && onViewAllPress && (
        <View style={styles.viewAllContainer}>
          <Button
            title={`View All (${items.length})`}
            onPress={onViewAllPress}
            variant="outline"
            size="small"
            fullWidth
          />
        </View>
      )}
    </Animated.View>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      width: "100%",
      borderRadius: radius.md,
      overflow: "hidden",
      paddingBottom: spacing.sm,
    },
    itemsContainer: {
      width: "100%",
      borderRadius: radius.md,
      overflow: "hidden",
    },
    itemContainer: {
      width: "100%",
      borderBottomWidth: 1,
      borderBottomColor: "rgba(255, 255, 255, 0.06)",
    },
    item: {
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xs,
    },
    itemIconContainer: {
      width: spacing["3xl"],
      height: spacing["3xl"],
      borderRadius: spacing.lg,
      backgroundColor: "rgba(255, 255, 255, 0.03)",
      justifyContent: "center",
      alignItems: "center",
      marginRight: spacing._10,
      position: "relative",
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.04)",
    },
    unreadIconContainer: {
      backgroundColor: "rgba(147, 197, 253, 0.08)",
      borderColor: colors.accent.muted,
    },
    itemIcon: {
      marginRight: 0,
    },
    badgeContainer: {
      position: "absolute",
      top: -3,
      right: -3,
      backgroundColor: colors.accent.primary,
      borderRadius: spacing._6,
      minWidth: spacing.lg,
      height: spacing.lg,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 3,
      borderWidth: 1,
      borderColor: colors.bg.primary,
    },
    badgeText: {
      color: colors.bg.primary,
      fontSize: 10,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.bold,
    },
    itemContent: {
      flex: 1,
      paddingRight: 2,
    },
    itemTitle: {
      color: colors.text.primary,
      fontSize: 13,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.medium,
      marginBottom: 1,
      letterSpacing: 0.1,
    },
    unreadItemTitle: {
      fontWeight: fontWeight.bold,
      color: colors.accent.primary,
    },
    itemDescription: {
      color: colors.text.secondary,
      fontSize: fontSize.xs,
      fontFamily: fontFamily.mono,
      marginBottom: 1,
      lineHeight: 15,
      opacity: 0.8,
    },
    itemTimestamp: {
      color: colors.text.secondary,
      fontSize: 11,
      fontFamily: fontFamily.mono,
      opacity: 0.6,
      letterSpacing: 0.1,
    },
    viewAllContainer: {
      marginTop: spacing.sm,
      marginHorizontal: spacing.xs,
      paddingHorizontal: spacing.xs,
    },
    emptyStateContainer: {
      padding: spacing["3xl"],
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255, 255, 255, 0.02)",
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border.subtle,
      margin: spacing.lg,
    },
    emptyStateIconContainer: {
      width: 80,
      height: 80,
      borderRadius: spacing["4xl"],
      backgroundColor: "rgba(147, 197, 253, 0.1)",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: spacing.xl,
      borderWidth: 1,
      borderColor: colors.accent.border,
    },
    emptyStateIcon: {
      opacity: 0.9,
    },
    emptyStateTitle: {
      color: colors.text.primary,
      fontSize: fontSize.lg,
      fontFamily: fontFamily.mono,
      fontWeight: fontWeight.semibold,
      marginBottom: spacing.sm,
      textAlign: "center",
      letterSpacing: 0.3,
    },
    emptyStateDescription: {
      color: colors.text.secondary,
      fontSize: 15,
      fontFamily: fontFamily.mono,
      textAlign: "center",
      opacity: 0.7,
      lineHeight: lineHeight.relaxed,
      letterSpacing: 0.2,
    },
  });

export default Feed;
