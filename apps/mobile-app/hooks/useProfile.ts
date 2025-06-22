import { useAuth } from "@/contexts/AuthContext";
import { MapStyleType, useMapStyle } from "@/contexts/MapStyleContext";
import { apiClient, User } from "@/services/ApiClient";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface Cache {
  profile?: CacheEntry<User>;
}

// Global cache instance
const globalCache: Cache = {};

// Request queue to prevent concurrent requests
let requestQueue: Promise<void> = Promise.resolve();
const queueRequest = <T>(request: () => Promise<T>): Promise<T> => {
  const result = requestQueue.then(
    () => request(),
    () => request(),
  );
  requestQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
};

interface UseProfileReturn {
  // Data
  loading: boolean;
  profileData: User | null;
  memberSince: string;
  deleteError: string;
  isDeleting: boolean;
  showDeleteDialog: boolean;
  password: string;

  // Actions
  handleMapStyleChange: (style: MapStyleType) => Promise<void>;
  handleBack: () => void;
  handleLogout: () => void;
  handleDeleteAccount: () => Promise<void>;
  handleCloseDeleteDialog: () => void;
  setShowDeleteDialog: (show: boolean) => void;
  setPassword: (password: string) => void;
}

export const useProfile = (onBack?: () => void): UseProfileReturn => {
  const router = useRouter();
  const { logout } = useAuth();
  const { setMapStyle } = useMapStyle();

  // State
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<User | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [password, setPassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Cache ref to track cache updates
  const cacheRef = useRef(globalCache);

  // Handle map style change
  const handleMapStyleChange = useCallback(
    async (style: MapStyleType) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await setMapStyle(style);
    },
    [setMapStyle],
  );

  // Combined data fetching with caching and request queuing
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchUserData = async () => {
      try {
        // Check cache first
        const now = Date.now();
        const cache = cacheRef.current;

        // Helper function to check if cache is valid
        const isCacheValid = <T>(entry?: CacheEntry<T>) => {
          return entry && now - entry.timestamp < CACHE_TTL;
        };

        // Queue profile request if cache is invalid
        const profilePromise = isCacheValid(cache.profile)
          ? Promise.resolve(cache.profile!.data)
          : queueRequest(async () => {
              const data = await apiClient.auth.getUserProfile();
              if (isMounted) {
                cache.profile = { data, timestamp: now };
                return data;
              }
              return null;
            });

        const [profileResponse] = await Promise.all([profilePromise]);

        if (isMounted) {
          if (profileResponse) setProfileData(profileResponse);
          setLoading(false);
        }
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") {
          console.error("Error fetching user data:", error);
          if (isMounted) {
            setLoading(false);
          }
        }
      }
    };

    fetchUserData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  // Memoize formatted date
  const memberSince = useMemo(() => {
    return profileData?.createdAt
      ? new Date(profileData.createdAt).toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        })
      : "Loading...";
  }, [profileData?.createdAt]);

  // Handle back button
  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onBack) {
      onBack();
    } else {
      router.push("/");
    }
  }, [onBack, router]);

  // Handle logout with haptic feedback
  const handleLogout = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    logout();
    router.replace("/login");
  }, [logout, router]);

  // Handle delete account
  const handleDeleteAccount = async () => {
    if (!password) {
      setDeleteError("Password is required");
      return;
    }

    setIsDeleting(true);
    setDeleteError("");

    try {
      await apiClient.auth.deleteAccount(password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      logout(); // Logout after successful deletion
    } catch (error) {
      console.error("Error deleting account:", error);
      setDeleteError(
        error instanceof Error ? error.message : "Failed to delete account",
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCloseDeleteDialog = useCallback(() => {
    setShowDeleteDialog(false);
    setPassword("");
    setDeleteError("");
  }, []);

  return {
    // Data
    loading,
    profileData,
    memberSince,
    deleteError,
    isDeleting,
    showDeleteDialog,
    password,

    // Actions
    handleMapStyleChange,
    handleBack,
    handleLogout,
    handleDeleteAccount,
    handleCloseDeleteDialog,
    setShowDeleteDialog,
    setPassword,
  };
};
