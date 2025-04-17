// src/components/AuthWrapper.tsx
import { Redirect } from "expo-router";
import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { LoadingOverlay } from "./Loading/LoadingOverlay";

interface AuthWrapperProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

export const AuthWrapper: React.FC<AuthWrapperProps> = ({ children, requireAuth = true }) => {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { hasCompletedOnboarding } = useOnboarding();

  // Show loading overlay during authentication transitions
  if (isAuthLoading) {
    return <LoadingOverlay
      message="Loading..."
      subMessage={requireAuth ? "Checking authentication..." : "Redirecting..."}
    />;
  }

  // If authentication is required but user is not authenticated, redirect to login
  if (requireAuth && !isAuthenticated) {
    return <Redirect href="/login" />;
  }

  // If user is authenticated but on a non-auth page (like login), redirect to home
  if (!requireAuth && isAuthenticated) {
    return <Redirect href="/" />;
  }

  // If user is authenticated but hasn't completed onboarding, redirect to onboarding
  if (isAuthenticated && !hasCompletedOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  // Otherwise render children
  return <>{children}</>;
};
