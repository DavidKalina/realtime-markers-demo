import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import {
  User,
  Settings,
  Map,
  MapPin,
  Mail,
  Calendar,
  LucideIcon,
} from "lucide-react-native";
import { COLORS } from "../Layout/ScreenLayout";
import List, { StyledSwitch } from "../Layout/List";

interface Section {
  title: string;
  icon: LucideIcon;
  content: React.ReactNode;
  actionButton?: {
    label: string;
    onPress: () => void;
    variant: "primary";
  };
}

interface ProfileSectionProps {
  user?: {
    email?: string;
  };
  memberSince: string;
  profileData?: {
    bio?: string;
  };
  mapSettings: {
    isPitched: boolean;
    useLightStyle: boolean;
    useDarkStyle: boolean;
    useStreetStyle: boolean;
  };
  onMapSettingChange: (
    key: "isPitched" | "useLightStyle" | "useDarkStyle" | "useStreetStyle",
  ) => (value: boolean) => void;
}

const ProfileSection = ({
  user,
  memberSince,
  profileData,
  mapSettings,
  onMapSettingChange,
}: ProfileSectionProps): Section[] => {
  const sections: Section[] = [
    {
      title: "Account Settings",
      icon: Settings,
      content: (
        <List
          items={[
            {
              id: "email",
              icon: Mail,
              title: "Email",
              description: user?.email || "No email set",
            },
            {
              id: "memberSince",
              icon: Calendar,
              title: "Member Since",
              description: memberSince,
            },
            {
              id: "bio",
              icon: User,
              title: "Bio",
              description: profileData?.bio || "No bio set",
            },
          ]}
          scrollable={false}
          onItemPress={(item) => console.log("Account item pressed:", item)}
        />
      ),
    },
    {
      title: "Map Settings",
      icon: Map,
      content: (
        <List
          items={[
            {
              id: "mapStyle",
              icon: Map,
              title: "Map Style",
              description: "Choose your preferred map style",
              rightElement: (
                <View style={styles.mapStyleButtons}>
                  <TouchableOpacity
                    style={[
                      styles.mapStyleButton,
                      mapSettings.useLightStyle && styles.mapStyleButtonActive,
                    ]}
                    onPress={() => {
                      onMapSettingChange("useLightStyle")(true);
                      onMapSettingChange("useDarkStyle")(false);
                      onMapSettingChange("useStreetStyle")(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.mapStyleButtonText,
                        mapSettings.useLightStyle &&
                          styles.mapStyleButtonTextActive,
                      ]}
                    >
                      Light
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.mapStyleButton,
                      mapSettings.useDarkStyle && styles.mapStyleButtonActive,
                    ]}
                    onPress={() => {
                      onMapSettingChange("useLightStyle")(false);
                      onMapSettingChange("useDarkStyle")(true);
                      onMapSettingChange("useStreetStyle")(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.mapStyleButtonText,
                        mapSettings.useDarkStyle &&
                          styles.mapStyleButtonTextActive,
                      ]}
                    >
                      Dark
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.mapStyleButton,
                      mapSettings.useStreetStyle && styles.mapStyleButtonActive,
                    ]}
                    onPress={() => {
                      onMapSettingChange("useLightStyle")(false);
                      onMapSettingChange("useDarkStyle")(false);
                      onMapSettingChange("useStreetStyle")(true);
                    }}
                  >
                    <Text
                      style={[
                        styles.mapStyleButtonText,
                        mapSettings.useStreetStyle &&
                          styles.mapStyleButtonTextActive,
                      ]}
                    >
                      Colorful
                    </Text>
                  </TouchableOpacity>
                </View>
              ),
            },
            {
              id: "mapPitch",
              icon: MapPin,
              title: "Map Pitch",
              description: "Enable 3D building view",
              rightElement: (
                <StyledSwitch
                  value={mapSettings.isPitched}
                  onValueChange={onMapSettingChange("isPitched")}
                />
              ),
              isActive: mapSettings.isPitched,
            },
          ]}
          scrollable={false}
          onItemPress={(item) => console.log("Map setting pressed:", item)}
        />
      ),
    },
  ];

  return sections;
};

const styles = StyleSheet.create({
  mapStyleButtons: {
    flexDirection: "row",
    gap: 4,
  },
  mapStyleButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.buttonBackground,
    borderWidth: 1,
    borderColor: COLORS.buttonBorder,
    minHeight: 28,
  },
  mapStyleButtonActive: {
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    borderColor: "rgba(147, 197, 253, 0.3)",
  },
  mapStyleButtonText: {
    fontSize: 11,
    fontFamily: "SpaceMono",
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  mapStyleButtonTextActive: {
    color: COLORS.accent,
  },
});

export default ProfileSection;
