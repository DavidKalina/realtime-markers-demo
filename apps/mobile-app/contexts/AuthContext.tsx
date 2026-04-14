// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { apiClient, User } from "../services/ApiClient";
import { pushNotificationService } from "../services/PushNotificationService";
import {
  eventBroker,
  EventTypes,
  type XPAwardedEvent,
  type LevelUpdateEvent,
} from "../services/EventBroker";
import { invalidateProfileCache } from "../hooks/profileCache";

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
  logout: () => Promise<void>;
  forceLogout: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<boolean>;
  refreshAuth: () => Promise<boolean>; // Rotates tokens + re-fetches user — logs out on failure
  reloadUser: () => Promise<boolean>; // Re-fetches user profile only — never logs out
  patchUser: (updates: Partial<User>) => void; // Locally merge fields into user state (no API call)
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(apiClient.getCurrentUser());
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
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
        const syncedTokens = await apiClient.syncTokensWithStorage();

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
        const title = event.data?.title;
        if (event.data?.action === "level_up" && title) {
          const totalXp = (event.data as unknown as { totalXp?: number })
            ?.totalXp;
          setUser((prev) =>
            prev
              ? {
                  ...prev,
                  currentTier: title,
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

  /**
   * Re-fetch the user profile from the server using the existing access token.
   * Unlike refreshAuth, this never rotates tokens and never logs out on failure.
   * Use this when you just need fresh user data (e.g. after a profile update).
   */
  const reloadUser = async (): Promise<boolean> => {
    try {
      const freshUser = await apiClient.auth.getUserProfile();
      if (freshUser) {
        setUser(freshUser);
        return true;
      }
      return false;
    } catch {
      // Silently fail — don't log out, don't clear user state.
      // The existing user data stays in place.
      console.warn("[Auth] reloadUser failed, keeping existing user data");
      return false;
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

  const patchUser = (updates: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : prev));
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
        reloadUser,
        patchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
