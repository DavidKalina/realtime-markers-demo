import { LucideIcon } from "lucide-react-native";
import React, { useCallback, useMemo } from "react";
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  View,
  ViewStyle,
  TextStyle,
} from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Banner from "./Banner";
import Button from "./Button";
import ScreenContent from "./ScreenContent";
import { useColors, spacing, radius, type Colors } from "@/theme";
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
  showBackButton,
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
  const router = useRouter();
  const resolvedShowBackButton = showBackButton ?? router.canGoBack();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const bottomContentHeight = useSharedValue(0);

  const onBottomContentLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    bottomContentHeight.value = withTiming(h, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });
  }, []);

  const bottomPaddingStyle = useAnimatedStyle(() => ({
    paddingBottom: bottomContentHeight.value,
  }));

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
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
          !isScrollable ? styles.contentWrapper : undefined,
          footerButtons.length > 0 ? styles.contentWithFooter : undefined,
          bottomContent && footerButtons.length === 0
            ? { paddingBottom: 0 }
            : undefined,
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
        {resolvedShowBackButton && (
          <View style={styles.fixedBannerWrapper}>
            <Banner
              onBack={handleBack}
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
              resolvedShowBackButton && { paddingTop: BANNER_HEIGHT },
              footerButtons.length > 0 && styles.scrollContentWithFooter,
            ]}
          >
            {renderContent()}
            {bottomContent && footerButtons.length === 0 && (
              <Animated.View style={bottomPaddingStyle} />
            )}
          </Animated.ScrollView>
        ) : (
          <Animated.View
            style={[
              styles.container,
              resolvedShowBackButton
                ? { paddingTop: BANNER_HEIGHT }
                : undefined,
              footerButtons.length > 0
                ? styles.nonScrollableContentWithFooter
                : undefined,
              bottomContent && footerButtons.length === 0
                ? bottomPaddingStyle
                : undefined,
            ]}
          >
            {renderContent()}
          </Animated.View>
        )}
        {bottomContent && (
          <View
            onLayout={onBottomContentLayout}
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

const createStyles = (colors: Colors) =>
  StyleSheet.create({
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
  });

export default Screen;
