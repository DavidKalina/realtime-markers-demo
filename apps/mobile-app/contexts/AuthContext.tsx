// src/contexts/AuthContext.tsx
import { useFilterStore } from "@/stores/useFilterStore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import { apiClient, User } from "../services/ApiClient";
import { oAuthService } from "../services/OAuthService";
import { pushNotificationService } from "../services/PushNotificationService";
import {
  eventBroker,
  EventTypes,
  type XPAwardedEvent,
  type LevelUpdateEvent,
} from "../services/EventBroker";
import { invalidateProfileCache } from "../hooks/useProfile";

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
  const { fetchFilters } = useFilterStore();

  // Re-register push token if permission was already granted (no prompt).
  // The actual permission prompt is deferred to a contextual moment (e.g. first scan).
  const setupPushNotifications = async (userId: string) => {
    try {
      await pushNotificationService.registerIfAlreadyGranted(userId);
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

              // Load active itinerary if user is walking one
              const { useActiveItineraryStore } =
                await import("@/stores/useActiveItineraryStore");
              useActiveItineraryStore.getState().loadActive();

              // Sync filters and active filter IDs
              await fetchFilters();
            }
          } catch {
            // Profile fetch failed, auth state will be cleared by ApiClient
            setUser(null);
            setIsAuthenticated(false);
          }
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
      } catch {
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

  // Listen for real-time XP and level updates from WebSocket
  useEffect(() => {
    const unsubXP = eventBroker.on<XPAwardedEvent>(
      EventTypes.XP_AWARDED,
      (event) => {
        // The event payload includes totalXp from the server
        const totalXp = (event.data as unknown as { totalXp?: number })
          ?.totalXp;
        if (totalXp != null) {
          setUser((prev) => (prev ? { ...prev, totalXp } : prev));
          invalidateProfileCache();
        }
      },
    );
    const unsubLevel = eventBroker.on<LevelUpdateEvent>(
      EventTypes.LEVEL_UPDATE,
      (event) => {
        if (event.data?.action === "level_up" && event.data?.title) {
          const totalXp = (event.data as unknown as { totalXp?: number })
            ?.totalXp;
          setUser((prev) =>
            prev
              ? {
                  ...prev,
                  currentTier: event.data.title,
                  ...(totalXp != null ? { totalXp } : {}),
                }
              : prev,
          );
          invalidateProfileCache();
        }
      },
    );

    return () => {
      unsubXP();
      unsubLevel();
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
        // Re-fetch user profile from server to get latest data (e.g. onboardingProfile)
        const freshUser = await apiClient.auth.getUserProfile();
        setUser(freshUser);
        setIsAuthenticated(true);

        // Setup push notifications after successful refresh
        if (freshUser?.id) {
          await setupPushNotifications(freshUser.id);
        }

        return true;
      }
      setUser(null);
      setIsAuthenticated(false);
      return false;
    } catch {
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
      await oAuthService.signInWithGoogle();

      // Get the user from the API client to ensure authentication state is properly set up
      const user = apiClient.getCurrentUser();
      if (!user) {
        throw new Error("Failed to get user from API client after OAuth");
      }

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
      await oAuthService.signInWithFacebook();

      // Get the user from the API client to ensure authentication state is properly set up
      const user = apiClient.getCurrentUser();
      if (!user) {
        throw new Error("Failed to get user from API client after OAuth");
      }

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
