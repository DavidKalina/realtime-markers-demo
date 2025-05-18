import { useState, useEffect, useCallback, useRef } from "react";
import { apiClient, Emoji } from "@/services/ApiClient";

const useEmojis = (
  initialPage: number = 1,
  limit: number = 100,
  initialCategoryId: number | null = null,
  initialSearchTerm: string = "",
) => {
  const [emojis, setEmojis] = useState<Emoji[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [page, setPage] = useState<number>(initialPage);
  const [searchTerm, setSearchTerm] = useState<string>(initialSearchTerm);
  const [categoryId, setCategoryId] = useState<number | null>(
    initialCategoryId,
  );
  const lastEmojiId = useRef<number | null>(null);

  const fetchEmojis = useCallback(
    async (isNewSearch: boolean) => {
      setLoading(true);
      setError(null);

      try {
        const params = {
          search_query: searchTerm,
          category_id: categoryId,
          limit: limit,
          last_emoji_id: isNewSearch ? null : lastEmojiId.current,
        };

        const data = await apiClient.getEmojis(params);

        if (data && data.length > 0) {
          setEmojis((prev) => (isNewSearch ? data : [...prev, ...data]));
          setHasMore(data.length === limit);
          lastEmojiId.current = data[data.length - 1].id;
        } else {
          setHasMore(false);
        }
      } catch (err: any) {
        console.error("Error in fetchEmojis:", err);
        setError(err.message || "Error fetching emojis");
      } finally {
        setLoading(false);
      }
    },
    [searchTerm, categoryId, limit],
  );

  useEffect(() => {
    fetchEmojis(true);
  }, [fetchEmojis]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchEmojis(false);
      setPage((prevPage) => prevPage + 1);
    }
  }, [loading, hasMore, fetchEmojis]);

  const search = useCallback((newSearchTerm: string) => {
    setSearchTerm(newSearchTerm);
    setPage(0);
    setEmojis([]);
    setHasMore(true);
    lastEmojiId.current = null;
  }, []);

  const changeCategory = useCallback((newCategoryId: number | null) => {
    setCategoryId(newCategoryId);
    setPage(0);
    setEmojis([]);
    setHasMore(true);
    lastEmojiId.current = null;
  }, []);

  const createEmoji = useCallback(
    async (emojiData: {
      emoji: string;
      name: string;
      category_id?: number | null;
      keywords: string[];
      rank?: number;
    }) => {
      try {
        const newEmoji = await apiClient.createEmoji(emojiData);
        setEmojis((prev) => [newEmoji, ...prev]);
        return newEmoji;
      } catch (err: any) {
        setError(err.message || "Error creating emoji");
        throw err;
      }
    },
    [],
  );

  const updateEmoji = useCallback(
    async (id: number, emojiData: Partial<Emoji>) => {
      try {
        const updatedEmoji = await apiClient.updateEmoji(id, emojiData);
        setEmojis((prev) =>
          prev.map((emoji) => (emoji.id === id ? updatedEmoji : emoji)),
        );
        return updatedEmoji;
      } catch (err: any) {
        setError(err.message || "Error updating emoji");
        throw err;
      }
    },
    [],
  );

  const deleteEmoji = useCallback(async (id: number) => {
    try {
      await apiClient.deleteEmoji(id);
      setEmojis((prev) => prev.filter((emoji) => emoji.id !== id));
    } catch (err: any) {
      setError(err.message || "Error deleting emoji");
      throw err;
    }
  }, []);

  return {
    emojis,
    loading,
    error,
    hasMore,
    loadMore,
    search,
    changeCategory,
    createEmoji,
    updateEmoji,
    deleteEmoji,
    currentPage: page,
    currentSearchTerm: searchTerm,
    currentCategoryId: categoryId,
  };
};

export { useEmojis };
