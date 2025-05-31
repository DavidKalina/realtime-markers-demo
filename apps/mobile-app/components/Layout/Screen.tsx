import { LucideIcon } from "lucide-react-native";
import React from "react";
import { Pressable, StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import Banner from "./Banner";
import Button from "./Button";
import ScreenContent from "./ScreenContent";
import ScreenLayout, { COLORS } from "./ScreenLayout";
import SectionHeader from "./SectionHeader";
import Tabs from "./Tabs";

export interface Section {
  title: string;
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
  bannerDescription,
  bannerEmoji,
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
}: ScreenProps<T>) => {
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

  const renderContent = () => (
    <ScreenContent>
      {tabs && activeTab && onTabChange && (
        <Tabs items={tabs} activeTab={activeTab} onTabPress={onTabChange} />
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
              <SectionHeader title={section.title} icon={section.icon} />
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

  return (
    <ScreenLayout
      style={style}
      contentStyle={contentStyle}
      noSafeArea={noSafeArea}
      noAnimation={noAnimation}
    >
      <View style={styles.mainContainer}>
        {isScrollable ? (
          <Animated.ScrollView
            showsVerticalScrollIndicator={false}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              footerButtons.length > 0 && styles.scrollContentWithFooter,
            ]}
          >
            {(bannerTitle || showBackButton) && (
              <Banner
                name={bannerTitle || ""}
                description={bannerDescription}
                emoji={bannerEmoji}
                onBack={handleBack}
                scrollY={scrollY}
              />
            )}
            {renderContent()}
          </Animated.ScrollView>
        ) : (
          <View style={styles.container}>
            {(bannerTitle || showBackButton) && (
              <Banner
                name={bannerTitle || ""}
                description={bannerDescription}
                emoji={bannerEmoji}
                onBack={handleBack}
                scrollY={scrollY}
              />
            )}
            {renderContent()}
          </View>
        )}

        {footerButtons.length > 0 && (
          <View style={styles.fixedFooter}>
            {footerButtons.map((button, index) => (
              <Button
                key={index}
                title={button.label}
                onPress={button.onPress}
                variant={button.variant || "primary"}
                style={styles.footerButton}
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
    paddingBottom: 100, // Add padding to account for fixed footer
  },
  contentContainer: {
    flex: 1,
    paddingTop: 24,
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
    backgroundColor: COLORS.background,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    flexDirection: "row",
    gap: 12,
  },
  footerButton: {
    flex: 1,
  },
});

export default Screen;
