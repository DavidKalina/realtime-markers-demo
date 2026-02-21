import { LogOut, Trash2 } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  colors,
  spacing,
  radius,
  fontSize,
  fontWeight,
  fontFamily,
} from "@/theme";
import Card from "../Layout/Card";

interface ActionsSectionProps {
  handleLogout: () => void;
  setShowDeleteDialog: (show: boolean) => void;
}

const ActionsSection: React.FC<ActionsSectionProps> = ({
  handleLogout,
  setShowDeleteDialog,
}) => {
  return (
    <Card delay={1000}>
      <View style={styles.actionsSection}>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <LogOut
            size={18}
            color="#f97583"
            style={{ marginRight: spacing.sm }}
          />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => setShowDeleteDialog(true)}
          activeOpacity={0.8}
        >
          <Trash2
            size={18}
            color={colors.brand.danger}
            style={{ marginRight: spacing.sm }}
          />
          <Text style={styles.deleteText}>Delete Account</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  actionsSection: {
    flexDirection: "row",
    gap: spacing.md,
  },
  logoutButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.border.subtle,
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  logoutText: {
    color: "#f97583",
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    fontFamily: fontFamily.mono,
  },
  deleteButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: "rgba(220, 38, 38, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(220, 38, 38, 0.3)",
  },
  deleteText: {
    color: colors.brand.danger,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    fontFamily: fontFamily.mono,
  },
});

export default ActionsSection;
