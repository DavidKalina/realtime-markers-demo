import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  ScrollView,
  Switch,
  Platform,
  RefreshControl,
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

export interface ListItem {
  id: string;
  icon?: LucideIcon;
  title: string;
  description?: string;
  badge?: string | number;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  isActive?: boolean;
}

export interface ListProps {
  items: ListItem[];
  onItemPress?: (item: ListItem) => void;
  onViewAllPress?: () => void;
  emptyState?: {
    icon: LucideIcon;
    title: string;
    description: string;
  };
  maxItems?: number;
  style?: ViewStyle;
  scrollable?: boolean;
  animated?: boolean;
  delay?: number;
  refreshing?: boolean;
  onRefresh?: () => void;
}

export const StyledSwitch = React.memo<{
  value: boolean;
  onValueChange: (value: boolean) => void;
}>(({ value, onValueChange }) => (
  <View style={styles.switchContainer as ViewStyle}>
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: "rgba(255, 255, 255, 0.1)", true: COLORS.accent }}
      thumbColor={COLORS.background}
      ios_backgroundColor="rgba(255, 255, 255, 0.1)"
      style={styles.switch as ViewStyle}
    />
  </View>
));

const ListItem = React.memo<{
  item: ListItem;
  onPress?: (item: ListItem) => void;
  animated: boolean;
  delay: number;
  index: number;
}>(({ item, onPress, animated, delay, index }) => {
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

  const ListItemComponent = animated ? Animated.View : View;

  return (
    <ListItemComponent
      style={[styles.itemContainer, animatedStyle]}
      entering={
        animated
          ? FadeInDown.duration(400)
              .delay(delay + index * 100)
              .springify()
          : undefined
      }
    >
      <TouchableOpacity
        style={[styles.item, item.isActive && styles.activeItem]}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        {Icon && (
          <View style={styles.itemIconContainer}>
            <Icon
              size={18}
              color={item.isActive ? COLORS.accent : COLORS.textSecondary}
              style={styles.itemIcon}
            />
          </View>
        )}
        <View style={styles.itemContent}>
          <Text
            style={[styles.itemTitle, item.isActive && styles.activeItemTitle]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          {item.description && (
            <Text style={styles.itemDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}
        </View>
        {item.badge && (
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>{item.badge}</Text>
          </View>
        )}
        {item.rightElement}
      </TouchableOpacity>
    </ListItemComponent>
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

const List: React.FC<ListProps> = ({
  items,
  onItemPress,
  onViewAllPress,
  emptyState,
  maxItems,
  style,
  scrollable = true,
  animated = true,
  delay = 0,
  refreshing = false,
  onRefresh,
}) => {
  const displayItems = maxItems ? items.slice(0, maxItems) : items;
  const hasMore = maxItems ? items?.length > maxItems : false;

  if (items?.length === 0 && emptyState) {
    return <EmptyState {...emptyState} />;
  }

  const content = (
    <>
      <View style={styles.itemsContainer}>
        {displayItems?.map((item, index) => (
          <ListItem
            key={item.id}
            item={item}
            onPress={onItemPress}
            animated={animated}
            delay={delay}
            index={index}
          />
        ))}
      </View>
      {hasMore && onViewAllPress && (
        <View style={styles.viewAllContainer}>
          <Button
            title={`View All (${items?.length})`}
            onPress={onViewAllPress}
            variant="outline"
            size="small"
            fullWidth
          />
        </View>
      )}
    </>
  );

  if (scrollable) {
    return (
      <ScrollView
        style={[styles.container, style]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          ) : undefined
        }
      >
        {content}
      </ScrollView>
    );
  }

  return <View style={[styles.container, style]}>{content}</View>;
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  scrollContent: {
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
  activeItem: {
    // Remove background color, keep only the text color change
  },
  itemIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
  },
  itemIcon: {
    marginRight: 0,
  },
  itemContent: {
    flex: 1,
    paddingRight: 2,
  },
  itemTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontFamily: "SpaceMono",
    fontWeight: "500",
    marginBottom: 1,
    letterSpacing: 0.1,
  },
  activeItemTitle: {
    color: COLORS.accent,
    fontWeight: "700",
  },
  itemDescription: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: "SpaceMono",
    marginBottom: 1,
    lineHeight: 15,
    opacity: 0.8,
  },
  badgeContainer: {
    backgroundColor: COLORS.accent,
    borderRadius: 6,
    minWidth: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  badgeText: {
    color: COLORS.background,
    fontSize: 10,
    fontFamily: "SpaceMono",
    fontWeight: "700",
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
    borderRadius: 16,
    margin: 16,
  },
  emptyStateIconContainer: {
    width: 60,
    height: 60,
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
    fontSize: 16,
    fontFamily: "SpaceMono",
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
    letterSpacing: 0.3,
  },
  emptyStateDescription: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: "SpaceMono",
    textAlign: "center",
    opacity: 0.7,
    lineHeight: 22,
    letterSpacing: 0.2,
  },
  switchContainer: {
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  } as ViewStyle,
  switch: {
    transform: [{ scale: Platform.select({ ios: 0.7, android: 0.8 }) }],
  } as ViewStyle,
});

export default List;
