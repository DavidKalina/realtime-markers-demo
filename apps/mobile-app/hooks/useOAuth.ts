import { useEffect } from "react";
import * as WebBrowser from "expo-web-browser";
import {
  makeRedirectUri,
  useAuthRequest,
  CodeChallengeMethod,
} from "expo-auth-session";
import Constants from "expo-constants";
import { apiClient } from "../services/ApiClient";
import { Platform } from "react-native";

// Complete the auth session - this is required for all authentication providers
WebBrowser.maybeCompleteAuthSession();

export interface OAuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  provider: "google" | "facebook";
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface OAuthResponse {
  user: OAuthUser;
  tokens: OAuthTokens;
}

// Google discovery document
const googleDiscovery = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
};

// Facebook discovery document
const facebookDiscovery = {
  authorizationEndpoint: "https://www.facebook.com/v18.0/dialog/oauth",
  tokenEndpoint: "https://graph.facebook.com/v18.0/oauth/access_token",
};

/**
 * Get the appropriate redirect URI based on the provider and platform
 */
function getRedirectUri(provider: "google" | "facebook"): string {
  // In Expo Go, we use the auth proxy for all providers
  if (Constants.appOwnership === "expo") {
    const slug = "mobile-app"; // from app.config.ts
    const username = "tenuto"; // from `expo whoami`
    return `https://auth.expo.io/@${username}/${slug}`;
  }

  // For Google on native iOS, we MUST use the reversed iOS Client ID as the URI.
  if (provider === "google" && Platform.OS === "ios") {
    const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
    if (iosClientId && iosClientId.includes(".apps.googleusercontent.com")) {
      const reversedClientId = iosClientId.split(".").reverse().join(".");
      return `${reversedClientId}:/`;
    }
  }

  // For other cases (Facebook, or Google on Android/Web), use the custom scheme.
  return makeRedirectUri({
    scheme: "myapp",
    path: "oauth/callback",
  });
}

/**
 * Handle OAuth callback by sending the authorization code to your backend
 */
async function handleOAuthCallback(
  provider: "google" | "facebook",
  code: string,
  redirectUri: string,
  codeVerifier?: string,
): Promise<OAuthResponse> {
  try {
    const platform = Platform.OS;
    console.log(
      `Handling ${provider} OAuth callback on platform: ${platform}`,
      {
        codeLength: code.length,
        redirectUri,
        apiUrl: `${apiClient.baseUrl}/api/auth/oauth/${provider}`,
        hasCodeVerifier: !!codeVerifier,
      },
    );

    const response = await fetch(
      `${apiClient.baseUrl}/api/auth/oauth/${provider}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code,
          redirectUri,
          codeVerifier,
          platform,
        }),
      },
    );

    console.log(`${provider} OAuth response status:`, response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`${provider} OAuth backend error:`, errorData);
      throw new Error(
        errorData.details || errorData.error || `HTTP ${response.status}`,
      );
    }

    const data = await response.json();
    console.log(`${provider} OAuth successful, user:`, {
      id: data.user?.id,
      email: data.user?.email,
      hasTokens: !!(data.accessToken && data.refreshToken),
    });

    // Save auth state using the existing API client
    await apiClient.saveAuthState(data.user, {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    });

    return {
      user: data.user,
      tokens: {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      },
    };
  } catch (error) {
    console.error(`OAuth ${provider} callback error:`, error);
    throw error;
  }
}

/**
 * Hook for Google OAuth authentication
 */
export function useGoogleOAuth() {
  const redirectUri = getRedirectUri("google");

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || "",
      scopes: ["openid", "profile", "email"],
      redirectUri,
      responseType: "code",
      codeChallengeMethod: CodeChallengeMethod.S256,
    },
    googleDiscovery,
  );

  useEffect(() => {
    if (response?.type === "success" && response.params?.code) {
      handleOAuthCallback(
        "google",
        response.params.code,
        redirectUri,
        request?.codeVerifier,
      )
        .then((result) => {
          console.log("Google OAuth successful:", result);
          // You can add a callback here to handle successful authentication
        })
        .catch((error) => {
          console.error("Google OAuth error:", error);
          // You can add a callback here to handle authentication errors
        });
    } else if (response?.type === "error") {
      console.error("Google OAuth error:", response.error);
    }
  }, [response, redirectUri, request]);

  const signInWithGoogle = async (): Promise<OAuthResponse | null> => {
    try {
      if (!request) {
        throw new Error("OAuth request not ready");
      }

      const result = await promptAsync();

      if (result.type === "success" && result.params?.code) {
        return await handleOAuthCallback(
          "google",
          result.params.code,
          redirectUri,
          request.codeVerifier,
        );
      } else if (result.type === "cancel") {
        throw new Error("Google sign-in was cancelled");
      } else {
        throw new Error("Google sign-in failed");
      }
    } catch (error) {
      console.error("Google sign-in error:", error);
      throw error;
    }
  };

  return {
    signInWithGoogle,
    isReady: !!request,
    isLoading: response?.type === "opened",
  };
}

/**
 * Hook for Facebook OAuth authentication
 */
export function useFacebookOAuth() {
  const redirectUri = getRedirectUri("facebook");

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: process.env.EXPO_PUBLIC_FACEBOOK_CLIENT_ID || "",
      scopes: ["public_profile", "email"],
      redirectUri,
      responseType: "code",
      codeChallengeMethod: CodeChallengeMethod.S256,
    },
    facebookDiscovery,
  );

  useEffect(() => {
    if (response?.type === "success" && response.params?.code) {
      handleOAuthCallback(
        "facebook",
        response.params.code,
        redirectUri,
        request?.codeVerifier,
      )
        .then((result) => {
          console.log("Facebook OAuth successful:", result);
          // You can add a callback here to handle successful authentication
        })
        .catch((error) => {
          console.error("Facebook OAuth error:", error);
          // You can add a callback here to handle authentication errors
        });
    } else if (response?.type === "error") {
      console.error("Facebook OAuth error:", response.error);
    }
  }, [response, redirectUri, request]);

  const signInWithFacebook = async (): Promise<OAuthResponse | null> => {
    try {
      if (!request) {
        throw new Error("OAuth request not ready");
      }

      const result = await promptAsync();

      if (result.type === "success" && result.params?.code) {
        return await handleOAuthCallback(
          "facebook",
          result.params.code,
          redirectUri,
          request.codeVerifier,
        );
      } else if (result.type === "cancel") {
        throw new Error("Facebook sign-in was cancelled");
      } else {
        throw new Error("Facebook sign-in failed");
      }
    } catch (error) {
      console.error("Facebook sign-in error:", error);
      throw error;
    }
  };

  return {
    signInWithFacebook,
    isReady: !!request,
    isLoading: response?.type === "opened",
  };
}

/**
 * Check if OAuth providers are available
 */
export function useOAuthAvailability() {
  const isGoogleAvailable = !!process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
  const isFacebookAvailable = !!process.env.EXPO_PUBLIC_FACEBOOK_CLIENT_ID;

  const getAvailableProviders = (): Array<"google" | "facebook"> => {
    const providers: Array<"google" | "facebook"> = [];

    if (isGoogleAvailable) {
      providers.push("google");
    }

    if (isFacebookAvailable) {
      providers.push("facebook");
    }

    return providers;
  };

  return {
    isGoogleAvailable,
    isFacebookAvailable,
    getAvailableProviders,
  };
}
