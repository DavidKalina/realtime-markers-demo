import ScreenLayout, { COLORS } from "@/components/Layout/ScreenLayout";
import { apiClient, ClientGroup, ClientGroupMembership } from "@/services/ApiClient";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Search, Users } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  FlatList,
} from "react-native";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";

export default function GroupMembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [group, setGroup] = useState<ClientGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [members, setMembers] = useState<ClientGroupMembership[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<ClientGroupMembership[]>([]);

  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (router.canGoBack()) {
      router.back();
    }
  }, [router]);

  const loadGroupDetails = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);
      const [groupData, membersData] = await Promise.all([
        apiClient.getGroupById(id),
        apiClient.getGroupMembers(id),
      ]);
      if (isMounted.current) {
        setGroup(groupData);
        setMembers(membersData.members);
        setFilteredMembers(membersData.members);
        setError(null);
      }
    } catch (err) {
      if (isMounted.current) {
        setError("Failed to load group members");
        console.error("Error fetching group:", err);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [id]);

  useEffect(() => {
    loadGroupDetails();
  }, [loadGroupDetails]);

  useEffect(() => {
    if (members.length > 0) {
      const filtered = members.filter((member) =>
        member.user.displayName.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredMembers(filtered);
    }
  }, [searchQuery, members]);

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={handleBack} style={styles.backButton}>
        <ArrowLeft size={20} color={COLORS.textPrimary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Group Members</Text>
    </View>
  );

  const renderSearchBar = () => (
    <View style={styles.searchContainer}>
      <Search size={20} color={COLORS.textSecondary} style={styles.searchIcon} />
      <TextInput
        style={styles.searchInput}
        placeholder="Search members..."
        placeholderTextColor={COLORS.textSecondary}
        value={searchQuery}
        onChangeText={setSearchQuery}
      />
    </View>
  );

  const renderMemberItem = ({ item }: { item: ClientGroupMembership }) => (
    <View style={styles.memberItem}>
      <View style={styles.memberAvatar}>
        <Text style={styles.memberAvatarText}>{item.user.displayName.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{item.user.displayName}</Text>
        <Text style={styles.memberRole}>{item.role}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <ScreenLayout>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Loading Members...</Text>
        </View>
      </ScreenLayout>
    );
  }

  if (error || !group) {
    return (
      <ScreenLayout>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>{error || "Group not found"}</Text>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout>
      {renderHeader()}
      <Animated.View
        style={styles.container}
        entering={FadeInDown.duration(600)}
        layout={LinearTransition.springify()}
      >
        {renderSearchBar()}
        <FlatList
          data={filteredMembers}
          renderItem={renderMemberItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.membersList}
          showsVerticalScrollIndicator={false}
        />
      </Animated.View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: COLORS.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  backButton: {
    padding: 8,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 20,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "SpaceMono",
    fontWeight: "700",
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 12,
    paddingHorizontal: 12,
    marginVertical: 16,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontFamily: "SpaceMono",
    fontSize: 15,
  },
  membersList: {
    paddingBottom: 32,
  },
  memberItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 12,
    marginBottom: 8,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.accent,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  memberAvatarText: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontFamily: "SpaceMono",
    fontWeight: "700",
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: "SpaceMono",
    fontWeight: "600",
    marginBottom: 2,
  },
  memberRole: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "SpaceMono",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: "SpaceMono",
  },
  errorText: {
    color: COLORS.errorText,
    fontSize: 16,
    textAlign: "center",
    fontFamily: "SpaceMono",
  },
});
