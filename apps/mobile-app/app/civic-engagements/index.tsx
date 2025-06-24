import React, { useCallback, useRef } from "react";
import { useRouter } from "expo-router";
import {
  Search as SearchIcon,
  X,
  MessageSquare,
  Users,
} from "lucide-react-native";
import { TextInput } from "react-native";
import * as Haptics from "expo-haptics";
import Screen from "@/components/Layout/Screen";
import Input from "@/components/Input/Input";
import InfiniteScrollFlatList from "@/components/Layout/InfintieScrollFlatList";
import { CivicEngagementItem } from "@/components/CivicEngagement";
import { useCivicEngagements } from "@/hooks/useCivicEngagements";
import useCivicEngagementSearch from "@/hooks/useCivicEngagementSearch";
import { CivicEngagement } from "@/services/ApiClient";
import { AuthWrapper } from "@/components/AuthWrapper";
import { useAuth } from "@/contexts/AuthContext";

type CivicEngagementTab = "my-engagements" | "all-engagements";

const CivicEngagementsListScreen = () => {
  const router = useRouter();
  const searchInputRef = useRef<TextInput>(null);
  const [activeTab, setActiveTab] =
    React.useState<CivicEngagementTab>("my-engagements");
  const { user } = useAuth();

  const { civicEngagements, isLoading, error, hasMore, loadMore, refresh } =
    useCivicEngagements({
      authUserId: user?.id ?? "",
      type: activeTab,
      initialLimit: 20,
    });

  // Use the search hook for backend search functionality
  const {
    searchQuery,
    setSearchQuery,
    civicEngagementResults,
    isLoading: isSearchLoading,
    error: searchError,
    hasSearched,
    clearSearch,
  } = useCivicEngagementSearch({
    initialCivicEngagements: civicEngagements,
  });

  // Determine which data to display and loading state
  const displayData = hasSearched ? civicEngagementResults : civicEngagements;
  const displayLoading = hasSearched ? isSearchLoading : isLoading;
  const displayError = hasSearched ? searchError : error;

  // Tab items configuration
  const tabItems = [
    {
      icon: MessageSquare,
      label: "My Engagements",
      value: "my-engagements" as CivicEngagementTab,
    },
    {
      icon: Users,
      label: "All Engagements",
      value: "all-engagements" as CivicEngagementTab,
    },
  ];

  const handleTabPress = useCallback(
    (tab: CivicEngagementTab) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setActiveTab(tab);
      // Clear search when switching tabs
      clearSearch();
    },
    [clearSearch],
  );

  // Search input handlers
  const handleSearchInput = useCallback(
    (text: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSearchQuery(text);
    },
    [setSearchQuery],
  );

  const handleSearch = useCallback(async () => {
    // Search is handled automatically by the hook
    await refresh();
  }, [refresh]);

  const handleClearSearch = useCallback(() => {
    Haptics.selectionAsync();
    clearSearch();
    searchInputRef.current?.focus();
  }, [clearSearch]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handleCivicEngagementPress = useCallback(
    (civicEngagement: CivicEngagement) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Navigate to civic engagement details
      router.push({
        pathname: "/civic-engagements/[id]" as const,
        params: {
          id: civicEngagement.id,
        },
      });
    },
    [router],
  );

  // Auto-focus the search input when the screen opens
  React.useEffect(() => {
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 500);
  }, []);

  const renderCivicEngagementItem = useCallback(
    (civicEngagement: CivicEngagement) => {
      return (
        <CivicEngagementItem
          civicEngagement={civicEngagement}
          onPress={handleCivicEngagementPress}
          showLocation={true}
          showStatus={true}
        />
      );
    },
    [handleCivicEngagementPress],
  );

  return (
    <AuthWrapper>
      <Screen
        isScrollable={false}
        bannerTitle="Civic Engagements"
        bannerEmoji="💬"
        showBackButton
        onBack={handleBack}
        noAnimation
        tabs={tabItems}
        activeTab={activeTab}
        onTabChange={handleTabPress}
      >
        <Input
          ref={searchInputRef}
          icon={SearchIcon}
          rightIcon={searchQuery !== "" ? X : undefined}
          onRightIconPress={handleClearSearch}
          placeholder={`Search ${activeTab === "my-engagements" ? "your" : "all"} civic engagements...`}
          value={searchQuery}
          onChangeText={handleSearchInput}
          returnKeyType="search"
          onSubmitEditing={handleSearch}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={true}
          loading={displayLoading}
          style={{ marginHorizontal: 16, marginBottom: 16 }}
        />
        <InfiniteScrollFlatList
          data={displayData}
          renderItem={renderCivicEngagementItem}
          fetchMoreData={hasSearched ? () => Promise.resolve() : loadMore}
          onRefresh={hasSearched ? () => Promise.resolve() : refresh}
          isLoading={displayLoading}
          isRefreshing={displayLoading && displayData.length === 0}
          hasMore={hasSearched ? false : hasMore && !displayError}
          error={displayError}
          emptyListMessage={
            searchQuery.trim()
              ? "No civic engagements found matching your search"
              : "No civic engagements found"
          }
          onRetry={hasSearched ? () => {} : () => refresh()}
        />
      </Screen>
    </AuthWrapper>
  );
};

export default CivicEngagementsListScreen;
