import React from "react";
import { View, StyleSheet } from "react-native";
import { Users } from "lucide-react-native";
import SectionHeader from "@/components/Layout/SectionHeader";
import GroupMembership from "@/components/GroupMembership/GroupMembership";

interface GroupMembersSectionProps {
  groupId: string;
  isOwner: boolean;
  onMembershipChange: () => void;
  onViewAllPress: () => void;
}

export const GroupMembersSection: React.FC<GroupMembersSectionProps> = ({
  groupId,
  isOwner,
  onMembershipChange,
  onViewAllPress,
}) => {
  return (
    <View style={styles.section}>
      <SectionHeader
        icon={Users}
        title="Members"
        actionText="View All"
        onActionPress={onViewAllPress}
      />
      <GroupMembership
        groupId={groupId}
        isOwner={isOwner}
        isAdmin={false}
        onMembershipChange={onMembershipChange}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
});
