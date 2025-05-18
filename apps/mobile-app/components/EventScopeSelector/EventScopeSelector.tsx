import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { Users, Globe } from "lucide-react-native";
import { apiClient, ClientGroup } from "@/services/ApiClient";
import { COLORS } from "@/components/Layout/ScreenLayout";

export type EventScope = "FRIENDS" | "GROUP";

interface EventScopeSelectorProps {
  onScopeChange: (scope: EventScope, groupId?: string) => void;
  selectedScope: EventScope;
  selectedGroupId?: string;
}

export const EventScopeSelector: React.FC<EventScopeSelectorProps> = ({
  onScopeChange,
  selectedScope,
  selectedGroupId,
}) => {
  const [userGroups, setUserGroups] = useState<ClientGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUserGroups = async () => {
      try {
        const response = await apiClient.getUserGroups();
        setUserGroups(response.groups);
      } catch (error) {
        console.error("Error fetching user groups:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserGroups();
  }, []);

  const ownedGroups = userGroups.filter(
    (group) => group.ownerId === apiClient.getCurrentUser()?.id,
  );

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Event Scope</Text>

      <View style={styles.optionsContainer}>
        {/* Friends Option */}
        <TouchableOpacity
          style={[
            styles.option,
            selectedScope === "FRIENDS" && styles.selectedOption,
          ]}
          onPress={() => onScopeChange("FRIENDS")}
        >
          <View style={styles.optionContent}>
            <Users
              size={20}
              color={
                selectedScope === "FRIENDS"
                  ? COLORS.accent
                  : COLORS.textSecondary
              }
            />
            <View style={styles.optionTextContainer}>
              <Text
                style={[
                  styles.optionTitle,
                  selectedScope === "FRIENDS" && styles.selectedText,
                ]}
              >
                Private Event
              </Text>
              <Text
                style={[
                  styles.optionDescription,
                  selectedScope === "FRIENDS" && styles.selectedText,
                ]}
              >
                Share with selected friends
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Group Option */}
        {ownedGroups.length > 0 && (
          <TouchableOpacity
            style={[
              styles.option,
              selectedScope === "GROUP" && styles.selectedOption,
            ]}
            onPress={() => onScopeChange("GROUP", ownedGroups[0].id)}
          >
            <View style={styles.optionContent}>
              <Globe
                size={20}
                color={
                  selectedScope === "GROUP"
                    ? COLORS.accent
                    : COLORS.textSecondary
                }
              />
              <View style={styles.optionTextContainer}>
                <Text
                  style={[
                    styles.optionTitle,
                    selectedScope === "GROUP" && styles.selectedText,
                  ]}
                >
                  Group Event
                </Text>
                <Text
                  style={[
                    styles.optionDescription,
                    selectedScope === "GROUP" && styles.selectedText,
                  ]}
                >
                  {ownedGroups.length === 1
                    ? `Share with ${ownedGroups[0].name}`
                    : `Share with ${ownedGroups.length} groups`}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Group Selection Dropdown (if multiple groups) */}
      {selectedScope === "GROUP" && ownedGroups.length > 1 && (
        <View style={styles.groupSelector}>
          {ownedGroups.map((group) => (
            <TouchableOpacity
              key={group.id}
              style={[
                styles.groupOption,
                selectedGroupId === group.id && styles.selectedGroupOption,
              ]}
              onPress={() => onScopeChange("GROUP", group.id)}
            >
              <Text
                style={[
                  styles.groupOptionText,
                  selectedGroupId === group.id && styles.selectedText,
                ]}
              >
                {group.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    marginBottom: 12,
  },
  optionsContainer: {
    gap: 12,
  },
  option: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  selectedOption: {
    borderColor: COLORS.accent,
    backgroundColor: "rgba(147, 197, 253, 0.1)",
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  optionTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontFamily: "SpaceMono",
  },
  selectedText: {
    color: COLORS.accent,
  },
  groupSelector: {
    marginTop: 12,
    gap: 8,
  },
  groupOption: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  selectedGroupOption: {
    borderColor: COLORS.accent,
    backgroundColor: "rgba(147, 197, 253, 0.1)",
  },
  groupOptionText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
  },
});

export default EventScopeSelector;
