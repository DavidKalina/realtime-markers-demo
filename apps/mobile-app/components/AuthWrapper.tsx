// src/components/AuthWrapper.tsx
import React from "react";
import { Redirect } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingOverlay } from "./Loading/LoadingOverlay";

interface AuthWrapperProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

export const AuthWrapper: React.FC<AuthWrapperProps> = ({ children, requireAuth = true }) => {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading overlay during authentication transitions
  if (isLoading) {
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

  // Otherwise render children
  return <>{children}</>;
};
