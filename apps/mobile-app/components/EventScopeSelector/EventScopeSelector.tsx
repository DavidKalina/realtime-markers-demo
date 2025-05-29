import React, { useMemo } from "react";
import { StyleSheet, Text, View, ActivityIndicator } from "react-native";
import { Users, Globe } from "lucide-react-native";
import { COLORS } from "@/components/Layout/ScreenLayout";
import { useEventScope } from "@/hooks/useEventScope";
import { Select, SelectOption } from "@/components/Select/Select";

// Create wrapper components for the icons to match the expected type
const UsersIcon: React.FC<{ size: number; color: string }> = ({
  size,
  color,
}) => <Users size={size} color={color} />;

const GlobeIcon: React.FC<{ size: number; color: string }> = ({
  size,
  color,
}) => <Globe size={size} color={color} />;

export type EventScope = "FRIENDS" | "GROUP";

interface EventScopeSelectorProps {
  onScopeChange: (scope: EventScope, groupId?: string) => void;
  selectedScope: EventScope;
  selectedGroupId?: string;
  initialScope?: EventScope;
  initialGroupId?: string;
}

export const EventScopeSelector: React.FC<EventScopeSelectorProps> = ({
  onScopeChange,
  selectedScope,
  selectedGroupId,
  initialScope,
  initialGroupId,
}) => {
  const {
    ownedGroups,
    isLoading,
    error,
    handleScopeChange: handleInternalScopeChange,
  } = useEventScope({
    initialScope,
    initialGroupId,
  });

  const handleScopeChange = (scope: EventScope, groupId?: string) => {
    handleInternalScopeChange(scope, groupId);
    onScopeChange(scope, groupId);
  };

  // Create scope options
  const scopeOptions = useMemo<SelectOption[]>(
    () => [
      {
        id: "FRIENDS",
        label: "Private Event",
        description: "Share with selected friends",
        icon: UsersIcon,
      },
      ...(ownedGroups.length > 0
        ? [
            {
              id: "GROUP",
              label: "Group Event",
              description:
                ownedGroups.length === 1
                  ? `Share with ${ownedGroups[0].name}`
                  : `Share with ${ownedGroups.length} groups`,
              icon: GlobeIcon,
            },
          ]
        : []),
    ],
    [ownedGroups],
  );

  // Create group options if needed
  const groupOptions = useMemo<SelectOption[]>(() => {
    if (selectedScope !== "GROUP" || ownedGroups.length <= 1) return [];

    return ownedGroups.map((group) => ({
      id: group.id,
      label: group.name,
      description: "Group event",
    }));
  }, [selectedScope, ownedGroups]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.sectionLabel}>Event Scope</Text>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={COLORS.accent} />
          <Text style={styles.loadingText}>Loading groups...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.sectionLabel}>Event Scope</Text>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Event Scope</Text>

      <Select
        value={scopeOptions.find((opt) => opt.id === selectedScope)}
        options={scopeOptions}
        onChange={(option) => handleScopeChange(option.id as EventScope)}
        placeholder="Select event scope"
        label="Event Type"
      />

      {selectedScope === "GROUP" && ownedGroups.length > 1 && (
        <View style={styles.groupSelector}>
          <Select
            value={groupOptions.find((opt) => opt.id === selectedGroupId)}
            options={groupOptions}
            onChange={(option) => handleScopeChange("GROUP", option.id)}
            placeholder="Select a group"
            label="Select Group"
          />
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
  groupSelector: {
    marginTop: 12,
  },
  loadingContainer: {
    padding: 16,
    alignItems: "center",
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
  },
  loadingText: {
    marginTop: 8,
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "SpaceMono",
  },
  errorContainer: {
    padding: 16,
    backgroundColor: "rgba(255, 0, 0, 0.1)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 0, 0, 0.2)",
  },
  errorText: {
    color: "#ff6b6b",
    fontSize: 14,
    fontFamily: "SpaceMono",
  },
});

export default EventScopeSelector;
