import { LucideIcon } from "lucide-react-native";
import React from "react";
import {
  Pressable,
  StyleSheet,
  View,
  ViewStyle,
  TextStyle,
} from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Banner from "./Banner";
import Button from "./Button";
import ScreenContent from "./ScreenContent";
import { colors, spacing, radius } from "@/theme";
import ScreenLayout from "./ScreenLayout";
import SectionHeader from "./SectionHeader";
import Tabs from "./Tabs";

export interface Section {
  title?: string;
  content: React.ReactNode;
  onPress?: () => void;
  icon: LucideIcon;
  actionButton?: {
    label: string;
    onPress: () => void;
    variant?:
      | "primary"
      | "secondary"
      | "outline"
      | "ghost"
      | "warning"
      | "error";
  };
}

export interface TabItem<T extends string> {
  icon: React.ElementType;
  label: string;
  value: T;
}

export interface ScreenProps<T extends string = string> {
  // Banner props
  bannerTitle?: string;
  bannerDescription?: string;
  bannerEmoji?: string;
  showBackButton?: boolean;
  onBack?: () => void;
  extendBannerToStatusBar?: boolean;

  // Tabs props
  tabs?: TabItem<T>[];
  activeTab?: T;
  onTabChange?: (tab: T) => void;

  // Content props
  sections?: Section[];
  children?: React.ReactNode;

  // Footer props
  footerButtons?: {
    label: string;
    onPress: () => void;
    variant?:
      | "primary"
      | "secondary"
      | "outline"
      | "ghost"
      | "warning"
      | "error";
    style?: ViewStyle;
    textStyle?: TextStyle;
    loading?: boolean;
  }[];

  // Fixed bottom content (rendered between scroll area and footer)
  bottomContent?: React.ReactNode;

  // Style props
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  noSafeArea?: boolean;
  noAnimation?: boolean;

  // Add new prop for scrollable content
  isScrollable?: boolean;

  // Add new prop for footer safe area
  footerSafeArea?: boolean;
}

const Screen = <T extends string>({
  bannerTitle,
  showBackButton = true,
  onBack,
  tabs,
  activeTab,
  onTabChange,
  sections = [],
  children,
  footerButtons = [],
  bottomContent,
  style,
  contentStyle,
  noSafeArea,
  noAnimation,
  isScrollable = true,
  extendBannerToStatusBar = true,
  footerSafeArea = false,
}: ScreenProps<T>) => {
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const handleBack = () => {
    if (onBack) {
      onBack();
    }
  };

  const mainContainerStyle = [
    styles.mainContainer,
    footerButtons.length > 0 && !noSafeArea && { marginBottom: -insets.bottom },
  ];

  const renderContent = () => (
    <ScreenContent>
      <View
        style={[
          styles.contentContainer,
          !isScrollable && styles.contentWrapper,
          footerButtons.length > 0 && styles.contentWithFooter,
        ]}
      >
        {children}

        {sections.map((section, index) => (
          <View key={index} style={styles.section}>
            <View style={styles.sectionHeader}>
              {section.title && (
                <SectionHeader title={section.title} icon={section.icon} />
              )}
              {section.actionButton && (
                <Button
                  title={section.actionButton.label}
                  onPress={section.actionButton.onPress}
                  variant={section.actionButton.variant || "ghost"}
                  size="small"
                />
              )}
            </View>
            <Pressable onPress={section.onPress} style={styles.card}>
              {section.content}
            </Pressable>
          </View>
        ))}
      </View>
      {tabs && activeTab && onTabChange && (
        <View style={styles.tabsWrapper}>
          <Tabs items={tabs} activeTab={activeTab} onTabPress={onTabChange} />
        </View>
      )}
    </ScreenContent>
  );

  const BANNER_HEIGHT = extendBannerToStatusBar ? 44 : 90;

  return (
    <ScreenLayout
      style={style}
      contentStyle={contentStyle}
      noSafeArea={noSafeArea}
      noAnimation={noAnimation}
      extendBannerToStatusBar={extendBannerToStatusBar}
    >
      <View style={mainContainerStyle}>
        {(bannerTitle || showBackButton) && (
          <View style={styles.fixedBannerWrapper}>
            <Banner
              name={bannerTitle || ""}
              onBack={handleBack}
              scrollY={scrollY}
              extendToStatusBar={extendBannerToStatusBar}
            />
          </View>
        )}
        {isScrollable ? (
          <Animated.ScrollView
            showsVerticalScrollIndicator={false}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingTop: BANNER_HEIGHT },
              footerButtons.length > 0 && styles.scrollContentWithFooter,
              bottomContent &&
                footerButtons.length === 0 &&
                styles.scrollContentWithBottomContent,
            ]}
          >
            {renderContent()}
          </Animated.ScrollView>
        ) : (
          <View
            style={[
              styles.container,
              { paddingTop: BANNER_HEIGHT },
              footerButtons.length > 0 && styles.nonScrollableContentWithFooter,
              bottomContent &&
                footerButtons.length === 0 &&
                styles.nonScrollableContentWithBottomContent,
            ]}
          >
            {renderContent()}
          </View>
        )}
        {bottomContent && (
          <View
            style={
              footerButtons.length > 0
                ? styles.bottomContentWrapper
                : styles.fixedBottomContent
            }
          >
            {bottomContent}
          </View>
        )}
        {footerButtons.length > 0 && (
          <View
            style={[
              bottomContent ? styles.flexFooter : styles.fixedFooter,
              { paddingBottom: footerSafeArea ? insets.bottom + 8 : 8 },
            ]}
          >
            {footerButtons.map((button, index) => (
              <Button
                key={index}
                title={button.label}
                onPress={button.onPress}
                variant={button.variant || "primary"}
                size="small"
                style={
                  button.style
                    ? ([
                        styles.footerButton,
                        button.style,
                      ] as unknown as ViewStyle)
                    : styles.footerButton
                }
                textStyle={button.textStyle}
                loading={button.loading}
              />
            ))}
          </View>
        )}
      </View>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    position: "relative",
  },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  scrollContentWithFooter: {
    paddingBottom: 120,
  },
  scrollContentWithBottomContent: {},
  contentContainer: {
    flex: 1,
    paddingVertical: spacing.lg,
  },
  contentWithFooter: {
    paddingBottom: spacing["2xl"], // Add padding when footer is present
  },
  contentWrapper: {
    flex: 1,
    minHeight: 0,
  },
  section: {
    marginBottom: spacing["2xl"],
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
    marginLeft: spacing.xs,
  },
  card: {
    borderRadius: radius.md,
  },
  fixedFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bg.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.medium,
    flexDirection: "row",
    gap: spacing.sm,
  },
  bottomContentWrapper: {
    paddingBottom: spacing.lg,
  },
  fixedBottomContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bg.primary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.medium,
  },
  flexFooter: {
    backgroundColor: colors.bg.primary,
    flexDirection: "row",
  },
  footerButton: {
    // Remove default flex: 1 to allow custom flex values from EventDetails
  },
  tabsWrapper: {
    marginTop: 0,
    marginBottom: 0,
  },
  fixedBannerWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  nonScrollableContentWithFooter: {
    paddingBottom: 120,
  },
  nonScrollableContentWithBottomContent: {},
});

export default Screen;
