import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from "react-native";
import { COLORS } from "./ScreenLayout";
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
  const Icon = item.icon;
  const scale = useSharedValue(1);

  const handlePress = () => {
    scale.value = withSpring(0.98, { damping: 10 });
    setTimeout(() => {
      scale.value = withSpring(1, { damping: 10 });
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
            color={item.isRead ? COLORS.textSecondary : COLORS.accent}
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
}>(({ icon: Icon, title, description }) => (
  <Animated.View
    style={styles.emptyStateContainer}
    entering={FadeIn.duration(400).springify()}
  >
    <View style={styles.emptyStateIconContainer}>
      <Icon size={40} color={COLORS.accent} style={styles.emptyStateIcon} />
    </View>
    <Text style={styles.emptyStateTitle}>{title}</Text>
    <Text style={styles.emptyStateDescription}>{description}</Text>
  </Animated.View>
));

const Feed: React.FC<FeedProps> = ({
  items,
  onItemPress,
  onViewAllPress,
  emptyState,
  maxItems = 3,
  style,
}) => {
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

const styles = StyleSheet.create({
  container: {
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    paddingBottom: 8,
  },
  itemsContainer: {
    width: "100%",
    borderRadius: 12,
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
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  itemIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    position: "relative",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
  },
  unreadIconContainer: {
    backgroundColor: "rgba(147, 197, 253, 0.08)",
    borderColor: "rgba(147, 197, 253, 0.15)",
  },
  itemIcon: {
    marginRight: 0,
  },
  badgeContainer: {
    position: "absolute",
    top: -3,
    right: -3,
    backgroundColor: COLORS.accent,
    borderRadius: 6,
    minWidth: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
    borderWidth: 1,
    borderColor: COLORS.background,
  },
  badgeText: {
    color: COLORS.background,
    fontSize: 10,
    fontFamily: "SpaceMono",
    fontWeight: "700",
  },
  itemContent: {
    flex: 1,
    paddingRight: 2,
  },
  itemTitle: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontFamily: "SpaceMono",
    fontWeight: "500",
    marginBottom: 1,
    letterSpacing: 0.1,
  },
  unreadItemTitle: {
    fontWeight: "700",
    color: COLORS.accent,
  },
  itemDescription: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: "SpaceMono",
    marginBottom: 1,
    lineHeight: 15,
    opacity: 0.8,
  },
  itemTimestamp: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontFamily: "SpaceMono",
    opacity: 0.6,
    letterSpacing: 0.1,
  },
  viewAllContainer: {
    marginTop: 8,
    marginHorizontal: 4,
    paddingHorizontal: 4,
  },
  emptyStateContainer: {
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    margin: 16,
  },
  emptyStateIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(147, 197, 253, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.2)",
  },
  emptyStateIcon: {
    opacity: 0.9,
  },
  emptyStateTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontFamily: "SpaceMono",
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
    letterSpacing: 0.3,
  },
  emptyStateDescription: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontFamily: "SpaceMono",
    textAlign: "center",
    opacity: 0.7,
    lineHeight: 22,
    letterSpacing: 0.2,
  },
});

export default Feed;
