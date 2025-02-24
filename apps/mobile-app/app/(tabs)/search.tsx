import React from "react";
import { StyleSheet, View, StatusBar, SafeAreaView } from "react-native";
import CategoryBadges from "@/components/CategoryBadges";
import SearchBar from "@/components/SearchBar";
import SearchResults from "@/components/SearchResults";
import useSearch from "@/hooks/useSearch";

const SearchScreen = () => {
  const {
    searchQuery,
    setSearchQuery,
    categories,
    selectedCategories,
    searchResults,
    isLoading,
    handleSearch,
    toggleCategory,
  } = useSearch();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#222" />
      <View style={styles.container}>
        {/* Search Bar */}
        <SearchBar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          handleSearch={handleSearch}
        />

        {/* Category Filters */}
        <CategoryBadges
          categories={categories}
          selectedCategories={selectedCategories}
          onToggleCategory={toggleCategory}
          containerStyle={styles.categoryContainer}
        />

        {/* Results */}
        <SearchResults isLoading={isLoading} searchResults={searchResults} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#222", // Even darker background for the safe area
  },
  container: {
    flex: 1,
    backgroundColor: "#222", // Dark background that matches your theme
    paddingTop: 16, // Reduced from 60 as SafeAreaView handles some of this padding
  },
  categoryContainer: {
    marginBottom: 16,
    paddingHorizontal: 16, // Match the padding of the search results
  },
});

export default SearchScreen;
