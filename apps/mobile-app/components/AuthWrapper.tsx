// src/components/AuthWrapper.tsx
import { Redirect } from "expo-router";
import React, { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
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
  const { registerLoadingState, unregisterLoadingState } = useSplashScreen();

  // Register auth loading state with the splash screen context
  useEffect(() => {
    if (isAuthLoading) {
      registerLoadingState("auth", true);
    } else {
      unregisterLoadingState("auth");
    }

    // Cleanup on unmount
    return () => {
      unregisterLoadingState("auth");
    };
  }, [isAuthLoading, registerLoadingState, unregisterLoadingState]);

  // If authentication is required but user is not authenticated, redirect to login
  if (requireAuth && !isAuthenticated && !isAuthLoading) {
    return <Redirect href="/login" />;
  }

  // If user is authenticated but on a non-auth page (like login), redirect to home
  if (!requireAuth && isAuthenticated && !isAuthLoading) {
    return <Redirect href="/" />;
  }

  // Show loading state or render children
  if (isAuthLoading) {
    return null; // Let the splash screen handle the loading state
  }

  // Otherwise render children
  return <>{children}</>;
};
