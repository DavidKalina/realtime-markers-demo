import { LucideIcon } from "lucide-react-native";
import React from "react";
import {
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import Animated, {
  FadeIn,
  LinearTransition,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import {
  colors,
  spacing,
  radius,
  fontSize,
  fontWeight,
  fontFamily,
  lineHeight,
  spring,
} from "@/theme";
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
      trackColor={{ false: colors.border.medium, true: colors.accent.primary }}
      thumbColor={colors.bg.primary}
      ios_backgroundColor={colors.border.medium}
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
    scale.value = withSequence(
      withTiming(0.95, { duration: 100 }),
      withSpring(1, spring.press),
    );

    if (onPress) {
      onPress(item);
    } else if (item.onPress) {
      item.onPress();
    }
  };

  const ListItemComponent = animated ? Animated.View : View;

  return (
    <ListItemComponent
      style={[styles.itemContainer]}
      layout={LinearTransition.springify()
        .damping(spring.firm.damping)
        .stiffness(spring.firm.stiffness)}
      entering={
        animated ? FadeIn.duration(300).delay(delay + index * 50) : undefined
      }
    >
      <TouchableOpacity
        style={[styles.item, item.isActive && styles.activeItem]}
        onPress={handlePress}
        activeOpacity={1}
      >
        {Icon && (
          <View style={styles.itemIconContainer}>
            <Icon
              size={18}
              color={
                item.isActive ? colors.accent.primary : colors.text.secondary
              }
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
      <Icon
        size={40}
        color={colors.accent.primary}
        style={styles.emptyStateIcon}
      />
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
  activeItem: {
    // Remove background color, keep only the text color change
  },
  itemIconContainer: {
    width: spacing["3xl"],
    height: spacing["3xl"],
    borderRadius: spacing.lg,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing._10,
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
    color: colors.text.primary,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.medium,
    marginBottom: 1,
    letterSpacing: 0.1,
  },
  activeItemTitle: {
    color: colors.accent.primary,
    fontWeight: fontWeight.bold,
  },
  itemDescription: {
    color: colors.text.secondary,
    fontSize: fontSize.xs,
    fontFamily: fontFamily.mono,
    marginBottom: 1,
    lineHeight: 15,
    opacity: 0.8,
  },
  badgeContainer: {
    backgroundColor: colors.accent.primary,
    borderRadius: spacing._6,
    minWidth: spacing.lg,
    height: spacing.lg,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xs,
    marginLeft: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  badgeText: {
    color: colors.bg.primary,
    fontSize: 10,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.bold,
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
    borderRadius: radius.xl,
    margin: spacing.lg,
  },
  emptyStateIconContainer: {
    width: 60,
    height: 60,
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
    fontSize: fontSize.md,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.sm,
    textAlign: "center",
    letterSpacing: 0.3,
  },
  emptyStateDescription: {
    color: colors.text.secondary,
    fontSize: fontSize.xs,
    fontFamily: fontFamily.mono,
    textAlign: "center",
    opacity: 0.7,
    lineHeight: lineHeight.relaxed,
    letterSpacing: 0.2,
  },
  switchContainer: {
    height: spacing.xl,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: spacing.sm,
  } as ViewStyle,
  switch: {
    transform: [{ scale: Platform.select({ ios: 0.7, android: 0.8 }) }],
  } as ViewStyle,
});

export default List;
