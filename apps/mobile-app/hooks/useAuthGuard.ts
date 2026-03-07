import { useEffect } from "react";
import { useSegments, useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboarding } from "@/contexts/OnboardingContext";

const GUEST_SCREENS = [
  "login",
  "register",
  "forgot-password",
  "reset-password",
];
const PUBLIC_SCREENS = ["onboarding", "+not-found"];

/**
 * Centralized auth guard for the root layout.
 * Replaces per-screen <AuthWrapper> usage with a single redirect handler.
 *
 * - Unauthenticated users on protected screens → redirect to /login
 * - Authenticated users on guest screens → redirect to /
 * - Authenticated users who haven't onboarded → redirect to /onboarding
 */
export function useAuthGuard() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { hasCompletedOnboarding, isLoading: isOnboardingLoading } =
    useOnboarding();
  const segments = useSegments();
  const router = useRouter();

  // Handle auth redirects
  useEffect(() => {
    if (isAuthLoading || isOnboardingLoading) return;

    const firstSegment = segments[0] || "index";
    const isGuestScreen = GUEST_SCREENS.includes(firstSegment);
    const isPublicScreen = PUBLIC_SCREENS.includes(firstSegment);

    if (!isAuthenticated && !isGuestScreen && !isPublicScreen) {
      router.replace("/login");
    } else if (isAuthenticated && isGuestScreen) {
      router.replace("/spaces");
    } else if (
      isAuthenticated &&
      !hasCompletedOnboarding &&
      firstSegment !== "onboarding"
    ) {
      router.replace("/onboarding");
    }
  }, [
    isAuthenticated,
    hasCompletedOnboarding,
    segments,
    isAuthLoading,
    isOnboardingLoading,
    router,
  ]);
}
