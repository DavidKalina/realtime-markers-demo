import { LogOut, Trash2 } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
          <LogOut size={18} color="#f97583" style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => setShowDeleteDialog(true)}
          activeOpacity={0.8}
        >
          <Trash2 size={18} color="#dc2626" style={{ marginRight: 8 }} />
          <Text style={styles.deleteText}>Delete Account</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  actionsSection: {
    flexDirection: "row",
    gap: 12,
  },
  logoutButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  logoutText: {
    color: "#f97583",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SpaceMono",
  },
  deleteButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "rgba(220, 38, 38, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(220, 38, 38, 0.3)",
  },
  deleteText: {
    color: "#dc2626",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SpaceMono",
  },
});

export default ActionsSection;
