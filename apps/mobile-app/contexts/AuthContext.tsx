// src/contexts/AuthContext.tsx
import { useFilterStore } from "@/stores/useFilterStore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import { apiClient, User, Filter } from "../services/ApiClient";
import { oAuthService } from "../services/OAuthService";
import { pushNotificationService } from "../services/PushNotificationService";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
  ) => Promise<void>;
  // OAuth methods
  signInWithGoogle: () => Promise<void>;
  signInWithFacebook: () => Promise<void>;
  getAvailableOAuthProviders: () => Array<"google" | "facebook">;
  logout: () => Promise<void>;
  forceLogout: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<boolean>;
  refreshAuth: () => Promise<boolean>; // New method to manually trigger auth refresh
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(apiClient.getCurrentUser());
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(
    apiClient.isAuthenticated(),
  );
  const { fetchFilters, applyFilters } = useFilterStore();

  // Setup push notifications after successful authentication
  const setupPushNotifications = async (userId: string) => {
    try {
      console.log("🔔 Setting up push notifications for user:", userId);
      const success =
        await pushNotificationService.setupPushNotifications(userId);
      if (success) {
        console.log("✅ Push notifications setup completed");
      } else {
        console.log("⚠️ Push notifications setup failed or permissions denied");
      }
    } catch (error) {
      console.error("❌ Error setting up push notifications:", error);
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      setIsLoading(true);

      try {
        // Sync tokens from storage and handle refresh if needed
        const syncedTokens = await apiClient.auth.syncTokens();

        if (syncedTokens?.accessToken) {
          try {
            // Try to get user profile to validate token
            const userProfile = await apiClient.auth.getUserProfile();

            if (userProfile) {
              setUser(userProfile);
              setIsAuthenticated(true);

              // Setup push notifications after successful authentication
              await setupPushNotifications(userProfile.id);

              // Sync filters and active filter IDs
              await fetchFilters();
              const storedFilters =
                await AsyncStorage.getItem("@active_filters");
              if (storedFilters) {
                const activeIds = JSON.parse(storedFilters);
                await applyFilters(activeIds);
              } else {
                // If no stored filters, fetch and apply the oldest filter
                const filters = await apiClient.filters.getFilters();
                if (filters.length > 0) {
                  const oldestFilter = filters.sort(
                    (a: Filter, b: Filter) =>
                      new Date(a.createdAt).getTime() -
                      new Date(b.createdAt).getTime(),
                  )[0];
                  await applyFilters([oldestFilter.id]);
                }
              }
            }
          } catch (error) {
            // Profile fetch failed, auth state will be cleared by ApiClient
            setUser(null);
            setIsAuthenticated(false);
          }
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
      } catch (error) {
        // Auth initialization failed, auth state will be cleared by ApiClient
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Remove debug logging effect
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

  // Reset loading state when auth state changes
  useEffect(() => {
    if (user?.id && isAuthenticated) {
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [user?.id, isAuthenticated]);

  const refreshAuth = async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      const success = await apiClient.refreshAuthTokens();
      if (success) {
        const currentUser = apiClient.getCurrentUser();
        setUser(currentUser);
        setIsAuthenticated(true);

        // Setup push notifications after successful refresh
        if (currentUser?.id) {
          await setupPushNotifications(currentUser.id);
        }

        return true;
      }
      setUser(null);
      setIsAuthenticated(false);
      return false;
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const loggedInUser = await apiClient.auth.login(email, password);
      setUser(loggedInUser);
      setIsAuthenticated(true);

      // Setup push notifications after successful login
      await setupPushNotifications(loggedInUser.id);
    } catch (error) {
      // Auth state will be cleared by ApiClient
      setUser(null);
      setIsAuthenticated(false);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
  ) => {
    setIsLoading(true);
    try {
      await apiClient.auth.register(email, password, firstName, lastName);
      const loggedInUser = await apiClient.auth.login(email, password);
      setUser(loggedInUser);
      setIsAuthenticated(true);

      // Setup push notifications after successful registration and login
      await setupPushNotifications(loggedInUser.id);
    } catch (error) {
      // Auth state will be cleared by ApiClient
      setUser(null);
      setIsAuthenticated(false);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await apiClient.auth.logout();
      setUser(null);
      setIsAuthenticated(false);
      await new Promise((resolve) => setTimeout(resolve, 500));
    } finally {
      setIsLoading(false);
    }
  };

  const forceLogout = async () => {
    setIsLoading(true);
    try {
      await apiClient.clearAuthState();
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<User>) => {
    setIsLoading(true);
    try {
      const updatedUser = await apiClient.auth.updateUserProfile(updates);
      setUser(updatedUser);
    } catch (error) {
      // Auth state will be cleared by ApiClient if needed
      setUser(null);
      setIsAuthenticated(false);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const changePassword = async (
    currentPassword: string,
    newPassword: string,
  ) => {
    setIsLoading(true);
    try {
      return await apiClient.auth.changePassword(currentPassword, newPassword);
    } catch (error) {
      // Auth state will be cleared by ApiClient if needed
      setUser(null);
      setIsAuthenticated(false);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setIsLoading(true);
    try {
      const oAuthResponse = await oAuthService.signInWithGoogle();
      // Map OAuthUser to User type with required properties
      const user: User = {
        ...oAuthResponse.user,
        role: "USER", // Default role for OAuth users
        isVerified: true, // OAuth users are typically verified
      };
      setUser(user);
      setIsAuthenticated(true);

      // Setup push notifications after successful OAuth login
      await setupPushNotifications(user.id);
    } catch (error) {
      // Auth state will be cleared by ApiClient
      setUser(null);
      setIsAuthenticated(false);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithFacebook = async () => {
    setIsLoading(true);
    try {
      const oAuthResponse = await oAuthService.signInWithFacebook();
      // Map OAuthUser to User type with required properties
      const user: User = {
        ...oAuthResponse.user,
        role: "USER", // Default role for OAuth users
        isVerified: true, // OAuth users are typically verified
      };
      setUser(user);
      setIsAuthenticated(true);

      // Setup push notifications after successful OAuth login
      await setupPushNotifications(user.id);
    } catch (error) {
      // Auth state will be cleared by ApiClient
      setUser(null);
      setIsAuthenticated(false);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const getAvailableOAuthProviders = () => {
    return oAuthService.getAvailableProviders();
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
        forceLogout,
        updateProfile,
        changePassword,
        refreshAuth,
        signInWithGoogle,
        signInWithFacebook,
        getAvailableOAuthProviders,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
