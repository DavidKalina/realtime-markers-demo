// src/contexts/AuthContext.tsx
import { useFilterStore } from "@/stores/useFilterStore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import { apiClient, User, Filter } from "../services/ApiClient";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
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

  useEffect(() => {
    const initializeAuth = async () => {
      setIsLoading(true);

      try {
        // Sync tokens from storage
        await apiClient.syncTokensWithStorage();

        // Check if we have tokens to work with
        const accessToken = await AsyncStorage.getItem("accessToken");
        const refreshToken = await AsyncStorage.getItem("refreshToken");

        if (accessToken && refreshToken) {
          try {
            // Try to get user profile to validate token
            const userProfile = await apiClient.auth.getUserProfile();

            // Make sure we have the user object correctly set
            if (userProfile) {
              await AsyncStorage.setItem("user", JSON.stringify(userProfile));
              setUser(userProfile);
              setIsAuthenticated(true);

              // Sync filters and active filter IDs
              await fetchFilters();
              const storedFilters =
                await AsyncStorage.getItem("@active_filters");
              if (storedFilters) {
                const activeIds = JSON.parse(storedFilters);
                // Ensure the filters are properly applied
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
          } catch (profileError) {
            // Only attempt token refresh if we have a refresh token
            if (refreshToken) {
              const refreshed = await apiClient.refreshAuthTokens();

              if (refreshed) {
                try {
                  const userProfile = await apiClient.auth.getUserProfile();

                  await AsyncStorage.setItem(
                    "user",
                    JSON.stringify(userProfile),
                  );
                  setUser(userProfile);
                  setIsAuthenticated(true);

                  // Sync filters and active filter IDs
                  await fetchFilters();
                  const storedFilters =
                    await AsyncStorage.getItem("@active_filters");
                  if (storedFilters) {
                    const activeIds = JSON.parse(storedFilters);
                    // Ensure the filters are properly applied
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
                } catch (secondProfileError) {
                  console.error(
                    "Failed to get user profile after token refresh:",
                    secondProfileError,
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
    };

    initializeAuth();
  }, []);

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

  // Reset loading state when auth state changes
  useEffect(() => {
    if (user?.id && isAuthenticated) {
      // Give the main screen time to load before clearing loading state
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [user?.id, isAuthenticated]);

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
      const success = await apiClient.refreshAuthTokens();

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
      const response = await apiClient.auth.login(email, password);
      console.log("Login response:", response);

      // Wait for auth state to be fully synchronized
      await apiClient.syncTokensWithStorage();

      // Get the latest user state after sync
      const currentUser = apiClient.getCurrentUser();
      console.log("Current user after sync:", currentUser);

      // Update context state
      setUser(currentUser);
      setIsAuthenticated(apiClient.isAuthenticated());

      // Verify auth state is consistent
      if (!apiClient.isAuthenticated()) {
        console.warn("Auth state inconsistency detected after login");
        // Force a refresh by getting the user profile
        const userProfile = await apiClient.auth.getUserProfile();
        setUser(userProfile);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error("Login error:", error);
      // Ensure we clear any partial auth state on error
      await apiClient.clearAuthState();
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
    displayName?: string,
  ) => {
    setIsLoading(true);
    try {
      // First register the user
      await apiClient.auth.register(email, password, displayName);

      // Then log them in
      await apiClient.auth.login(email, password);

      // Update the auth state
      setUser(apiClient.getCurrentUser());
      setIsAuthenticated(true);
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
      await apiClient.auth.logout();
      setUser(null);
      setIsAuthenticated(false);
      // Add a small delay to ensure the loading state is visible
      await new Promise((resolve) => setTimeout(resolve, 500));
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<User>) => {
    setIsLoading(true);
    try {
      const updatedUser = await apiClient.auth.updateUserProfile(updates);
      setUser(updatedUser);
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
