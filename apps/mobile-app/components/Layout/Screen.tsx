import React from "react";
import ScreenLayout from "./ScreenLayout";
import Banner from "./Banner";
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import { View, StyleSheet, ViewStyle } from "react-native";
import Button from "./Button";
import SectionHeader from "./SectionHeader";
import Card from "./Card";
import { LucideIcon } from "lucide-react-native";
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

  return (
    <ScreenLayout
      style={style}
      contentStyle={contentStyle}
      noSafeArea={noSafeArea}
      noAnimation={noAnimation}
    >
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
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

        {tabs && activeTab && onTabChange && (
          <View style={styles.tabsContainer}>
            <Tabs items={tabs} activeTab={activeTab} onTabPress={onTabChange} />
          </View>
        )}

        <View style={styles.contentContainer}>
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
              <Card onPress={section.onPress} style={styles.card}>
                {section.content}
              </Card>
            </View>
          ))}

          {footerButtons.length > 0 && (
            <View style={styles.footer}>
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
      </Animated.ScrollView>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  contentContainer: {
    paddingTop: 24,
  },
  tabsContainer: {
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
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
  footer: {
    marginTop: 24,
    marginHorizontal: 16,
    flexDirection: "row",
    gap: 12,
  },
  footerButton: {
    flex: 1,
  },
});

export default Screen;
