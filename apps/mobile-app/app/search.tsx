import React from "react";
import {
  StyleSheet,
  View,
  StatusBar,
  SafeAreaView,
  Text,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CategoryBadges from "@/components/CategoryBadges";
import SearchBar from "@/components/SearchBar";
import SearchResults from "@/components/SearchResults";

import useSearch from "@/hooks/useSearch";
import EmptySearchState from "@/components/EmptySearchState";
import SearchSkeleton from "@/components/SearchSkeleton";

const SearchScreen = () => {
  const {
    searchQuery,
    setSearchQuery,
    categories,
    selectedCategories,
    searchResults,
    isLoading,
    isLoadingMore,
    isRefreshing,
    hasMoreData,
    handleSearch,
    handleLoadMore,
    handleRefresh,
    toggleCategory,
    clearFilters,
  } = useSearch();

  // Determine what to render in the results area
  const renderContent = () => {
    // Initial loading state
    if (isLoading && !isRefreshing && searchResults.length === 0) {
      return <SearchSkeleton />;
    }

    // Empty results after search
    if (!isLoading && searchResults.length === 0) {
      return (
        <EmptySearchState
          searchQuery={searchQuery}
          hasFilters={selectedCategories.length > 0}
          onClearFilters={clearFilters}
        />
      );
    }

    // Results with infinite scrolling
    return (
      <SearchResults
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        searchResults={searchResults}
        hasMoreData={hasMoreData}
        onLoadMore={handleLoadMore}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#ffffff"
            colors={["#ffffff"]}
          />
        }
      />
    );
  };

  // Determine if we should show the filters section
  const showFilters = categories.length > 0;

  // Count active filters
  const activeFilterCount = selectedCategories.length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#222" />
      <View style={styles.container}>
        {/* Header with search bar */}
        <View style={styles.searchHeader}>
          <SearchBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            handleSearch={handleSearch}
          />

          {/* Filter button with counter badge */}
          {showFilters && (
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => {
                // Toggle filter visibility or open filter modal
                // Implementation depends on your UI/UX design
              }}
            >
              <Ionicons name="filter" size={24} color="white" />
              {activeFilterCount > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Filter section title with clear button if filters active */}
        {showFilters && (
          <View style={styles.filterHeader}>
            <Text style={styles.filterTitle}>Categories</Text>
            {activeFilterCount > 0 && (
              <TouchableOpacity onPress={clearFilters}>
                <Text style={styles.clearText}>Clear All</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Category Filters */}
        {showFilters && (
          <View style={styles.categoryWrapper}>
            <CategoryBadges
              categories={categories}
              selectedCategories={selectedCategories}
              onToggleCategory={toggleCategory}
              containerStyle={styles.categoryContainer}
            />
          </View>
        )}

        {/* Results area */}
        <View style={styles.resultsContainer}>{renderContent()}</View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#222",
  },
  container: {
    flex: 1,
    backgroundColor: "#222",
    paddingTop: 16,
  },
  searchHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  filterButton: {
    marginLeft: 8,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
    backgroundColor: "#333",
  },
  filterBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#ff4757",
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  filterBadgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
  },
  filterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  filterTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  clearText: {
    color: "#3498db",
    fontSize: 14,
  },
  categoryWrapper: {
    marginBottom: 16,
  },
  categoryContainer: {
    // No additional horizontal padding needed since it's handled in the ScrollView
  },
  resultsContainer: {
    flex: 1,
  },
});

export default SearchScreen;
