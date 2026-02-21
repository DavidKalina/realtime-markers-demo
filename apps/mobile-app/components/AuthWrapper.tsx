// src/components/AuthWrapper.tsx
import { Redirect, usePathname } from "expo-router";
import React, { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useSplashScreen } from "@/contexts/SplashScreenContext";

interface AuthWrapperProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

export const AuthWrapper: React.FC<AuthWrapperProps> = ({
  children,
  requireAuth = true,
}) => {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { hasCompletedOnboarding, isLoading: isOnboardingLoading } =
    useOnboarding();
  const { registerLoadingState, unregisterLoadingState } = useSplashScreen();
  const pathname = usePathname();

  // Register auth loading state with the splash screen context
  useEffect(() => {
    if (isAuthLoading || isOnboardingLoading) {
      registerLoadingState("auth", true);
    } else {
      unregisterLoadingState("auth");
    }

    // Cleanup on unmount
    return () => {
      unregisterLoadingState("auth");
    };
  }, [
    isAuthLoading,
    isOnboardingLoading,
    registerLoadingState,
    unregisterLoadingState,
  ]);

  // Show loading state while auth or onboarding state is loading
  if (isAuthLoading || isOnboardingLoading) {
    return null; // Let the splash screen handle the loading state
  }

  // If authentication is required but user is not authenticated, redirect to login
  if (requireAuth && !isAuthenticated) {
    return <Redirect href="/login" />;
  }

  // If user is authenticated but on a non-auth page (like login/register), redirect to home
  if (!requireAuth && isAuthenticated) {
    return <Redirect href="/" />;
  }

  // If authenticated and hasn't completed onboarding, redirect to onboarding
  // (but not if already on the onboarding screen)
  if (requireAuth && isAuthenticated && !hasCompletedOnboarding && pathname !== "/onboarding") {
    return <Redirect href="/onboarding" />;
  }

  // Otherwise render children
  return <>{children}</>;
};
