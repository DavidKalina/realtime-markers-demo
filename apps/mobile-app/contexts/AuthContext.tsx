// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import apiClient, { User } from "../services/ApiClient";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  refreshAuth: () => Promise<boolean>; // New method to manually trigger auth refresh
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(apiClient.getCurrentUser());
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(apiClient.isAuthenticated());
  const router = useRouter();

  // In AuthContext.tsx - Enhanced initAuth function

  const initAuth = useCallback(async () => {
    setIsLoading(true);
    console.log("Starting auth initialization");

    try {
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
      });
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  useEffect(() => {
    console.log("Auth state:", {
      user: user?.id ? `User ID: ${user.id}` : "No user",
      isAuthenticated,
      apiClientAuth: apiClient.isAuthenticated(),
    });
  }, [user, isAuthenticated]);

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

  useEffect(() => {
    console.log("Checking navigation:", { user: user?.id, isAuthenticated, isLoading });

    if (!isLoading) {
      if (user?.id && isAuthenticated) {
        router.replace("/");
      } else {
        router.replace("/login");
      }
    }
  }, [user?.id, isAuthenticated, isLoading, router]);

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
        login,
        register,
        logout,
        updateProfile,
        changePassword,
        refreshAuth, // New method exposed to consumers
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
