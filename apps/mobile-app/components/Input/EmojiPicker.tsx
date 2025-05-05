import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import Animated from "react-native-reanimated";
import { useEmojis } from "@/hooks/useEmojis";

interface EmojiPickerProps {
  onEmojiSelect?: (emoji: string) => void;
  value: string;
}

const COLUMNS = 9; // Number of emojis per row
const ROWS = 4; // Number of rows per page
const EMOJIS_PER_PAGE = COLUMNS * ROWS;
const EMOJIS_PER_FETCH = EMOJIS_PER_PAGE * 5; // Fetch 5 pages at a time (180)

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CONTAINER_WIDTH = SCREEN_WIDTH - 40; // Assuming 20px padding on each side
const EMOJI_SIZE = CONTAINER_WIDTH / COLUMNS;
const CONTAINER_HEIGHT = EMOJI_SIZE * ROWS;

const EmojiButton = React.memo(({ emoji, isSelected, onPress, breathingStyle }: any) => (
  <Animated.View style={isSelected ? breathingStyle : undefined}>
    <TouchableOpacity
      style={[
        styles.emojiContainer,
        { width: EMOJI_SIZE, height: EMOJI_SIZE },
        isSelected && styles.selectedEmojiContainer,
      ]}
      onPress={() => emoji && onPress(emoji)}
    >
      {emoji && <Text style={[styles.emoji, isSelected && styles.selectedEmoji]}>{emoji}</Text>}
    </TouchableOpacity>
  </Animated.View>
));

const EmojiPage = React.memo(({ emojis, selectedEmoji, onEmojiPress, breathingStyle }: any) => (
  <View style={[styles.page, { width: CONTAINER_WIDTH }]}>
    {Array.from({ length: ROWS }).map((_, rowIndex) => (
      <View key={rowIndex} style={styles.row}>
        {emojis.slice(rowIndex * COLUMNS, (rowIndex + 1) * COLUMNS).map((emojiObj: any) => (
          <EmojiButton
            key={emojiObj.id}
            breathingStyle={breathingStyle}
            emoji={emojiObj.emoji}
            isSelected={emojiObj.emoji === selectedEmoji}
            onPress={onEmojiPress}
          />
        ))}
      </View>
    ))}
  </View>
));

const CustomEmojiPicker: React.FC<EmojiPickerProps> = ({ onEmojiSelect, value }) => {
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(value);
  const [category, setCategory] = useState<number | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const breathingStyle = undefined;

  const { emojis, loading, error, hasMore, loadMore, search, changeCategory, currentSearchTerm } =
    useEmojis(0, EMOJIS_PER_FETCH, category, "");

  useEffect(() => {
    if (value) {
      setSelectedEmoji(value);
    }
  }, [value]);

  const handleEmojiPress = useCallback(
    (emoji: string) => {
      setSelectedEmoji(emoji);
      if (onEmojiSelect) {
        onEmojiSelect(emoji);
      }
    },
    [onEmojiSelect]
  );

  const renderPage = useCallback(
    ({ item: pageEmojis }: any) => (
      <EmojiPage
        emojis={pageEmojis}
        selectedEmoji={selectedEmoji}
        onEmojiPress={handleEmojiPress}
        breathingStyle={breathingStyle}
      />
    ),
    [selectedEmoji, handleEmojiPress, breathingStyle]
  );

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      loadMore();
    }
  };

  const handleSearch = (searchTerm: string) => {
    search(searchTerm);
    if (flatListRef.current) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
    }
  };

  const handleCategoryChange = (newCategoryId: number | null) => {
    changeCategory(newCategoryId);
    if (flatListRef.current) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
    }
    setCategory(newCategoryId);
  };

  const emojiPages = React.useMemo(() => {
    const pages = [];
    for (let i = 0; i < emojis.length; i += EMOJIS_PER_PAGE) {
      pages.push(emojis.slice(i, i + EMOJIS_PER_PAGE));
    }
    return pages;
  }, [emojis]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        {loading && emojis.length === 0 ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator color="#FFF" size="large" />
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={emojiPages}
            renderItem={renderPage}
            keyExtractor={(_, index) => index.toString()}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              loading ? (
                <View style={styles.footerLoader}>
                  <ActivityIndicator color="#FFF" />
                </View>
              ) : null
            }
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  container: {
    backgroundColor: "#2c2c2c",
    borderRadius: 10,
    width: CONTAINER_WIDTH,
    height: CONTAINER_HEIGHT,
    overflow: "hidden",
  },
  loaderContainer: {
    justifyContent: "center",
    alignItems: "center",
    height: CONTAINER_HEIGHT,
  },
  errorContainer: {
    justifyContent: "center",
    alignItems: "center",
    height: CONTAINER_HEIGHT,
  },
  page: {
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
  },
  row: {
    flexDirection: "row",
  },
  emojiContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  selectedEmojiContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 10,
  },
  emoji: {
    fontSize: 24,
  },
  selectedEmoji: {
    fontSize: 28,
  },
  errorText: {
    color: "#FF0000",
    textAlign: "center",
  },
  footerLoader: {
    width: CONTAINER_WIDTH,
    height: CONTAINER_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default React.memo(CustomEmojiPicker);
