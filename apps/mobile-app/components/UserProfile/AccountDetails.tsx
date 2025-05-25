import { User } from "@/services/ApiClient";
import {
  Calendar,
  Mail,
  Moon,
  User as UserIcon,
  Users,
} from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { LinearTransition } from "react-native-reanimated";
import Card from "../Layout/Card";
import DetailItem from "../Layout/DetailItem";

interface AccountDetailsProps {
  profileData: User | null;
  user: User | null;
  memberSince: string;
  mapStyleButtons: JSX.Element;
  isPitched: boolean;
  togglePitch: () => Promise<void>;
}

const AccountDetails: React.FC<AccountDetailsProps> = ({
  profileData,
  user,
  memberSince,
  mapStyleButtons,
  isPitched,
  togglePitch,
}) => {
  return (
    <Card delay={400}>
      <Text style={styles.sectionTitle}>Account Information</Text>
      <Animated.View layout={LinearTransition.springify()}>
        <DetailItem
          icon={<Mail size={18} color="#93c5fd" />}
          label="Email"
          value={profileData?.email || user?.email || ""}
          animated
          delay={500}
        />

        <DetailItem
          icon={<UserIcon size={18} color="#93c5fd" />}
          label="Role"
          value={profileData?.role || user?.role || "User"}
          animated
          delay={600}
        />

        <DetailItem
          icon={<Calendar size={18} color="#93c5fd" />}
          label="Member Since"
          value={memberSince}
          animated
          delay={700}
        />

        {profileData?.friendCode && (
          <DetailItem
            icon={<Users size={18} color="#93c5fd" />}
            label="Friend Code"
            value={profileData.friendCode}
            animated
            delay={800}
          />
        )}

        {profileData?.bio && (
          <DetailItem
            icon={<UserIcon size={18} color="#93c5fd" />}
            label="Bio"
            value={profileData.bio}
            animated
            delay={900}
          />
        )}

        <DetailItem
          icon={<Moon size={18} color="#93c5fd" />}
          label="Map Style"
          value=""
          animated
          delay={900}
          style={styles.mapStyleContainer}
        >
          <View style={styles.mapStyleContent}>
            {mapStyleButtons}
            <TouchableOpacity
              style={[
                styles.mapStyleButton,
                isPitched && styles.mapStyleButtonActive,
              ]}
              onPress={togglePitch}
            >
              <Text
                style={[
                  styles.mapStyleButtonText,
                  isPitched && styles.mapStyleButtonTextActive,
                ]}
              >
                {isPitched ? "3D View" : "2D View"}
              </Text>
            </TouchableOpacity>
          </View>
        </DetailItem>
      </Animated.View>
    </Card>
  );
};

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f8f9fa",
    fontFamily: "SpaceMono",
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  mapStyleContainer: {
    marginBottom: 0,
  },
  mapStyleContent: {
    gap: 8,
  },
  mapStyleButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    minHeight: 32,
  },
  mapStyleButtonActive: {
    backgroundColor: "rgba(147, 197, 253, 0.15)",
    borderColor: "rgba(147, 197, 253, 0.3)",
  },
  mapStyleButtonText: {
    fontSize: 12,
    fontFamily: "SpaceMono",
    fontWeight: "600",
    color: "#a0a0a0",
  },
  mapStyleButtonTextActive: {
    color: "#93c5fd",
  },
});

export default AccountDetails;
