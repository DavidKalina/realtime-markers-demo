import { useAuth } from "@/contexts/AuthContext";
import { MapStyleType, useMapStyle } from "@/contexts/MapStyleContext";
import { apiClient, PlanType, User } from "@/services/ApiClient";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";

interface UseProfileReturn {
  // Data
  loading: boolean;
  profileData: User | null;
  planDetails: {
    planType: PlanType;
    weeklyScanCount: number;
    scanLimit: number;
    remainingScans: number;
    lastReset: Date | null;
  } | null;
  memberSince: string;
  progressWidth: number;
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
  const { paymentStatus } = useLocalSearchParams<{ paymentStatus?: string }>();

  // State
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<User | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [password, setPassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [planDetails, setPlanDetails] = useState<{
    planType: PlanType;
    weeklyScanCount: number;
    scanLimit: number;
    remainingScans: number;
    lastReset: Date | null;
  } | null>(null);

  // Handle map style change
  const handleMapStyleChange = useCallback(
    async (style: MapStyleType) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await setMapStyle(style);
    },
    [setMapStyle],
  );

  // Combined data fetching with caching
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchUserData = async () => {
      try {
        // Fetch both profile and plan details in parallel
        const [profileResponse, planResponse] = await Promise.all([
          apiClient.auth.getUserProfile(),
          apiClient.plans.getPlanDetails(),
        ]);

        if (isMounted) {
          setProfileData(profileResponse);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setPlanDetails(planResponse as any);
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

  // Handle payment status with local state update
  useEffect(() => {
    if (paymentStatus === "success" && planDetails) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Update plan details locally instead of refetching
      setPlanDetails((prev) =>
        prev
          ? {
              ...prev,
              planType: PlanType.PRO,
              scanLimit: 100, // Assuming PRO plan has 100 scans
              remainingScans: 100 - (prev.weeklyScanCount || 0),
            }
          : null,
      );
    } else if (paymentStatus === "cancel") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }, [paymentStatus]);

  // Memoize formatted date
  const memberSince = useMemo(() => {
    return profileData?.createdAt
      ? new Date(profileData.createdAt).toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        })
      : "Loading...";
  }, [profileData?.createdAt]);

  // Memoize progress bar width
  const progressWidth = useMemo(() => {
    return Math.min(
      ((planDetails?.weeklyScanCount || 0) / (planDetails?.scanLimit || 10)) *
        100,
      100,
    );
  }, [planDetails?.weeklyScanCount, planDetails?.scanLimit]);

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
    planDetails,
    memberSince,
    progressWidth,
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
