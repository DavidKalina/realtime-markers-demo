import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import apiClient, { User } from "../services/ApiClient";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Add the onboarding keys
const HAS_COMPLETED_ONBOARDING = "hasCompletedOnboarding";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasCompletedOnboarding: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  refreshAuth: () => Promise<boolean>;
  completeOnboarding: () => Promise<void>; // New method to mark onboarding as complete
  resetOnboarding: () => Promise<void>; // Method to reset onboarding (for testing)
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(apiClient.getCurrentUser());
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(apiClient.isAuthenticated());
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const router = useRouter();

  // Function to check if onboarding is completed
  const checkOnboardingStatus = useCallback(async () => {
    try {
      const onboardingStatus = await AsyncStorage.getItem(HAS_COMPLETED_ONBOARDING);
      setHasCompletedOnboarding(onboardingStatus === "true");
      console.log(
        "Onboarding status:",
        onboardingStatus === "true" ? "Completed" : "Not completed"
      );
      return onboardingStatus === "true";
    } catch (error) {
      console.error("Error checking onboarding status:", error);
      return false;
    }
  }, []);

  // Mark onboarding as complete
  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem(HAS_COMPLETED_ONBOARDING, "true");
      setHasCompletedOnboarding(true);
      console.log("Onboarding marked as complete");
    } catch (error) {
      console.error("Error marking onboarding as complete:", error);
    }
  };

  // Reset onboarding status (useful for testing)
  const resetOnboarding = async () => {
    try {
      await AsyncStorage.removeItem(HAS_COMPLETED_ONBOARDING);
      setHasCompletedOnboarding(false);
      console.log("Onboarding status reset");
    } catch (error) {
      console.error("Error resetting onboarding status:", error);
    }
  };

  const initAuth = useCallback(async () => {
    setIsLoading(true);
    console.log("Starting auth initialization");

    try {
      // Check onboarding status first
      const onboardingCompleted = await checkOnboardingStatus();

      // Sync tokens from storage
      await apiClient.syncTokensWithStorage();

      // Check if we have tokens to work with
      const accessToken = await AsyncStorage.getItem("accessToken");
      const refreshToken = await AsyncStorage.getItem("refreshToken");

      if (accessToken && refreshToken) {
        try {
          // Try to get user profile to validate token
          console.log("Validating token by requesting user profile");
          const userProfile = await apiClient.getUserProfile();
          console.log("Token is valid, user profile received");

          // Make sure we have the user object correctly set
          if (userProfile) {
            await AsyncStorage.setItem("user", JSON.stringify(userProfile));
            setUser(userProfile);
            setIsAuthenticated(true);
          }
        } catch (profileError: any) {
          console.log(`Token validation failed: ${profileError.message || "Unknown error"}`);

          // Only attempt token refresh if we have a refresh token
          if (refreshToken) {
            console.log("Attempting token refresh");
            const refreshed = await apiClient.refreshTokens();

            if (refreshed) {
              console.log("Token refresh successful, fetching user profile again");
              try {
                const userProfile = await apiClient.getUserProfile();
                console.log("User profile fetch after refresh successful");

                await AsyncStorage.setItem("user", JSON.stringify(userProfile));
                setUser(userProfile);
                setIsAuthenticated(true);
              } catch (secondProfileError) {
                console.error(
                  "Failed to get user profile after token refresh:",
                  secondProfileError
                );
                await apiClient.clearAuthState();
                setUser(null);
                setIsAuthenticated(false);
              }
            } else {
              console.log("Token refresh failed, clearing auth state");
              await apiClient.clearAuthState();
              setUser(null);
              setIsAuthenticated(false);
            }
          } else {
            console.log("No refresh token available, clearing auth state");
            await apiClient.clearAuthState();
            setUser(null);
            setIsAuthenticated(false);
          }
        }
      } else {
        console.log("No tokens found in storage, user is not authenticated");
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error("Auth initialization error:", error);
      // On any error during initialization, clear auth state and redirect to login
      await apiClient.clearAuthState();
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      console.log("Auth initialization complete:", {
        isAuthenticated: apiClient.isAuthenticated(),
        hasUser: !!apiClient.getCurrentUser(),
        hasCompletedOnboarding,
      });
      setIsLoading(false);
    }
  }, [checkOnboardingStatus, hasCompletedOnboarding]);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  useEffect(() => {
    console.log("Auth state:", {
      user: user?.id ? `User ID: ${user.id}` : "No user",
      isAuthenticated,
      apiClientAuth: apiClient.isAuthenticated(),
      hasCompletedOnboarding,
    });
  }, [user, isAuthenticated, hasCompletedOnboarding]);

  useEffect(() => {
    // Listen for auth state changes from the API client
    const authListener = (isAuth: boolean) => {
      setIsAuthenticated(isAuth);
      setUser(apiClient.getCurrentUser());
    };

    apiClient.addAuthListener(authListener);

    return () => {
      apiClient.removeAuthListener(authListener);
    };
  }, []);

  // Updated navigation logic to check both authentication and onboarding status
  useEffect(() => {
    console.log("Checking navigation:", {
      user: user?.id,
      isAuthenticated,
      isLoading,
      hasCompletedOnboarding,
    });

    if (!isLoading) {
      if (user?.id && isAuthenticated) {
        // User is authenticated
        if (hasCompletedOnboarding) {
          // If onboarding is complete, go to main app
          router.replace("/");
        } else {
          // If authenticated but needs onboarding, go to onboarding
          router.replace("/onboarding");
        }
      } else {
        // Not authenticated - check onboarding status
        if (hasCompletedOnboarding) {
          // Onboarding is done, go to login
          router.replace("/login");
        } else {
          // Onboarding not done, go to onboarding
          router.replace("/onboarding");
        }
      }
    }
  }, [user?.id, isAuthenticated, isLoading, hasCompletedOnboarding, router]);

  // New method to manually refresh authentication
  const refreshAuth = async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      // Check if refresh token exists
      const refreshToken = await AsyncStorage.getItem("refreshToken");
      if (!refreshToken) {
        return false;
      }

      // Try to refresh the token
      const success = await apiClient.refreshTokens();

      if (success) {
        // If successful, update the user and authentication state
        setUser(apiClient.getCurrentUser());
        setIsAuthenticated(true);
        return true;
      } else {
        // If refresh fails, clear authentication
        setUser(null);
        setIsAuthenticated(false);
        return false;
      }
    } catch (error) {
      console.error("Error refreshing authentication:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      await apiClient.login(email, password);
      setUser(apiClient.getCurrentUser());
      setIsAuthenticated(true);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string, displayName?: string) => {
    setIsLoading(true);
    try {
      // First register the user
      await apiClient.register(email, password, displayName);

      // Then log them in separately
      await login(email, password);
    } catch (error) {
      console.error("Registration error:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await apiClient.logout();
      setUser(null);
      setIsAuthenticated(false);
      // Note: We don't reset onboarding status on logout
      // as we want returning users to skip onboarding
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<User>) => {
    setIsLoading(true);
    try {
      const updatedUser = await apiClient.updateUserProfile(updates);
      setUser(updatedUser);
    } finally {
      setIsLoading(false);
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    setIsLoading(true);
    try {
      return await apiClient.changePassword(currentPassword, newPassword);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        hasCompletedOnboarding,
        login,
        register,
        logout,
        updateProfile,
        changePassword,
        refreshAuth,
        completeOnboarding,
        resetOnboarding,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
