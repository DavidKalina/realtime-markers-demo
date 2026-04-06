import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronDown, ChevronUp, LogOut, MapPin, RotateCcw } from "lucide-react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { router } from "expo-router";
import DeleteAccountModal from "./DeleteAccountModal";
import {
  fontFamily,
  fontSize,
  fontWeight,
  radius,
  spacing,
  useColors,
  type Colors,
} from "@/theme";

interface SettingsSectionProps {
  email: string;
  bio?: string | null;
  homeSet: boolean;
  comfortRadius: number | null;
  onUpdateHome: () => void;
  onLogout: () => void;
  onDeleteAccount: (password: string) => Promise<void>;
}

export function SettingsSection({
  email,
  bio,
  homeSet,
  comfortRadius,
  onUpdateHome,
  onLogout,
  onDeleteAccount,
}: SettingsSectionProps) {
  const colors = useColors();
  const s = styles(colors);
  const [expanded, setExpanded] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    setDeleteError("");
    try {
      await onDeleteAccount(deletePassword);
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete account");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <View style={s.container}>
      <Pressable
        style={s.header}
        onPress={() => setExpanded(!expanded)}
      >
        <Text style={s.sectionLabel}>Settings</Text>
        {expanded ? (
          <ChevronUp size={16} color={colors.text.secondary} />
        ) : (
          <ChevronDown size={16} color={colors.text.secondary} />
        )}
      </Pressable>

      {expanded && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={s.content}
        >
          {/* Account */}
          <View style={s.section}>
            <Text style={s.label}>ACCOUNT</Text>
            <Text style={s.value}>{email}</Text>
            {bio && <Text style={s.bio}>{bio}</Text>}
          </View>

          {/* Home base */}
          <View style={s.section}>
            <Text style={s.label}>HOME BASE</Text>
            <Pressable style={s.homeRow} onPress={onUpdateHome}>
              <MapPin size={14} color={homeSet ? colors.accent.primary : colors.text.secondary} />
              <Text style={[s.homeText, homeSet && s.homeTextSet]}>
                {homeSet
                  ? `Set (${comfortRadius != null ? Number(comfortRadius).toFixed(1) : "?"} mi radius)`
                  : "Tap to set your home location"}
              </Text>
            </Pressable>
          </View>

          {/* Dev tools */}
          {__DEV__ && (
            <View style={s.section}>
              <Text style={s.label}>DEV TOOLS</Text>
              <Pressable
                style={s.actionButton}
                onPress={() => router.push("/onboarding")}
              >
                <RotateCcw size={14} color={colors.text.secondary} />
                <Text style={s.value}>Redo Onboarding</Text>
              </Pressable>
            </View>
          )}

          {/* Actions */}
          <View style={[s.section, s.actionsSection]}>
            <Pressable style={s.actionButton} onPress={onLogout}>
              <LogOut size={14} color="#fca5a5" />
              <Text style={s.actionTextRed}>Sign Out</Text>
            </Pressable>
            <Pressable
              style={s.actionButton}
              onPress={() => setDeleteModalVisible(true)}
            >
              <Text style={s.actionTextRed}>Delete Account</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}

      <DeleteAccountModal
        visible={deleteModalVisible}
        password={deletePassword}
        setPassword={setDeletePassword}
        deleteError={deleteError}
        isDeleting={isDeleting}
        onClose={() => {
          setDeleteModalVisible(false);
          setDeletePassword("");
          setDeleteError("");
        }}
        onDelete={handleDelete}
      />
    </View>
  );
}

const styles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      borderTopWidth: 1,
      borderTopColor: colors.border.default,
      paddingTop: spacing.lg,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: spacing.sm,
    },
    sectionLabel: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      fontWeight: fontWeight.bold,
      color: colors.text.secondary,
      letterSpacing: 0.5,
    },
    content: {
      gap: spacing["2xl"],
      marginTop: spacing.lg,
    },
    section: {
      gap: spacing.sm,
    },
    label: {
      fontFamily: fontFamily.mono,
      fontSize: 11,
      fontWeight: fontWeight.bold,
      color: colors.text.secondary,
      letterSpacing: 0.5,
    },
    value: {
      fontFamily: fontFamily.mono,
      fontSize: fontSize.sm,
      color: colors.text.primary,
    },
    bio: {
      fontFamily: fontFamily.mono,
      fontSize: fontSize.sm,
      color: colors.text.secondary,
      lineHeight: 20,
    },
    homeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    homeText: {
      fontFamily: fontFamily.mono,
      fontSize: fontSize.sm,
      color: colors.text.secondary,
    },
    homeTextSet: {
      color: colors.accent.primary,
    },
    actionsSection: {
      borderTopWidth: 1,
      borderTopColor: colors.border.default,
      paddingTop: spacing.lg,
      gap: spacing.md,
    },
    actionButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    actionTextRed: {
      fontFamily: fontFamily.mono,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      color: "#fca5a5",
    },
  });
