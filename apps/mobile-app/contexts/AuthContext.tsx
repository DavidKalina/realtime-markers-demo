// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from "react";
import apiClient, { User } from "../services/ApiClient";
import { useRouter } from "expo-router";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(apiClient.getCurrentUser());
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(apiClient.isAuthenticated());
  const { replace } = useRouter();

  useEffect(() => {
    const initAuth = async () => {
      // Wait for API client to be initialized - call any method to ensure initialization
      await apiClient.syncTokensWithStorage();

      // Now it's safe to get the initial state
      setUser(apiClient.getCurrentUser());
      setIsAuthenticated(apiClient.isAuthenticated());
      setIsLoading(false);
    };

    initAuth();
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

  useEffect(() => {
    console.log("Checking navigation:", { user: user?.id, isAuthenticated, isLoading });

    if (!isLoading) {
      if (user?.id && isAuthenticated) {
        replace("/");
      } else {
        replace("/login");
      }
    }
  }, [user?.id, isAuthenticated, isLoading, replace]);

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

  // In AuthContext.tsx

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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
