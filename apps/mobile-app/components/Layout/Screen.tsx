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
import ScreenLayout from "./ScreenLayout";
import SectionHeader from "./SectionHeader";
import Tabs from "./Tabs";

// Updated color scheme to match register/login screens
const newColors = {
  background: "#00697A",
  text: "#FFFFFF",
  accent: "#FDB813",
  cardBackground: "#FFFFFF",
  cardText: "#000000",
  cardTextSecondary: "#6c757d",
  buttonBackground: "#FFFFFF",
  buttonText: "#00697A",
  buttonBorder: "#DDDDDD",
  inputBackground: "#F5F5F5",
  errorBackground: "#FFCDD2",
  errorText: "#B71C1C",
  errorBorder: "#EF9A9A",
  divider: "#E0E0E0",
  activityIndicator: "#00697A",
};

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

  // Style props
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  noSafeArea?: boolean;
  noAnimation?: boolean;

  // Add new prop for scrollable content
  isScrollable?: boolean;
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
  style,
  contentStyle,
  noSafeArea,
  noAnimation,
  isScrollable = true,
  extendBannerToStatusBar = true,
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
      {tabs && activeTab && onTabChange && (
        <View style={styles.tabsWrapper}>
          <Tabs items={tabs} activeTab={activeTab} onTabPress={onTabChange} />
        </View>
      )}

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
            ]}
          >
            {renderContent()}
          </Animated.ScrollView>
        ) : (
          <View style={[styles.container, { paddingTop: BANNER_HEIGHT }]}>
            {renderContent()}
          </View>
        )}
        {footerButtons.length > 0 && (
          <View
            style={[
              styles.fixedFooter,
              { paddingBottom: Math.max(insets.bottom, 16) },
            ]}
          >
            {footerButtons.map((button, index) => (
              <Button
                key={index}
                title={button.label}
                onPress={button.onPress}
                variant={button.variant || "primary"}
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
    paddingBottom: 120, // Add padding to account for fixed footer
  },
  contentContainer: {
    flex: 1,
    paddingVertical: 16,
  },
  contentWithFooter: {
    paddingBottom: 24, // Add padding when footer is present
  },
  contentWrapper: {
    flex: 1,
    minHeight: 0,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    marginLeft: 4,
  },
  card: {
    borderRadius: 12,
  },
  fixedFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: newColors.background, // Updated to teal background
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)", // Updated for better contrast on teal
    flexDirection: "row",
    gap: 12,
  },
  footerButton: {
    // Remove default flex: 1 to allow custom flex values from EventDetails
  },
  tabsWrapper: {
    marginHorizontal: -16,
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
});

export default Screen;
