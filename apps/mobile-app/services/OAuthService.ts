import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";
import { apiClient } from "./ApiClient";
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

class OAuthService {
  // Google discovery document - this is the recommended approach
  private googleDiscovery: AuthSession.DiscoveryDocument = {
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    revocationEndpoint: "https://oauth2.googleapis.com/revoke",
  };

  // Facebook discovery document
  private facebookDiscovery: AuthSession.DiscoveryDocument = {
    authorizationEndpoint: "https://www.facebook.com/v18.0/dialog/oauth",
    tokenEndpoint: "https://graph.facebook.com/v18.0/oauth/access_token",
  };

  /**
   * Get the appropriate redirect URI based on the provider and platform
   */
  private getRedirectUri(provider: "google" | "facebook"): string {
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
    return AuthSession.makeRedirectUri({
      scheme: "myapp", // matches your app.config.ts scheme
      path: "oauth/callback",
    });
  }

  /**
   * Create Google OAuth configuration
   */
  private createGoogleConfig(): AuthSession.AuthRequestConfig {
    return {
      clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || "",
      scopes: ["openid", "profile", "email"],
      redirectUri: this.getRedirectUri("google"),
      responseType: AuthSession.ResponseType.Code,
      codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
    };
  }

  /**
   * Create Facebook OAuth configuration
   */
  private createFacebookConfig(): AuthSession.AuthRequestConfig {
    return {
      clientId: process.env.EXPO_PUBLIC_FACEBOOK_CLIENT_ID || "",
      scopes: ["public_profile", "email"],
      redirectUri: this.getRedirectUri("facebook"),
      responseType: AuthSession.ResponseType.Code,
      codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
    };
  }

  /**
   * Sign in with Google using the recommended discovery document approach
   */
  async signInWithGoogle(): Promise<OAuthResponse> {
    try {
      const config = this.createGoogleConfig();

      // Validate configuration
      if (!config.clientId) {
        throw new Error(
          "Google Client ID is not configured. Please check your environment variables.",
        );
      }

      console.log("Starting Google OAuth flow with:", {
        clientId: config.clientId.substring(0, 10) + "...",
        redirectUri: config.redirectUri,
        scopes: config.scopes,
        appOwnership: Constants.appOwnership,
      });

      // Create auth request
      const request = new AuthSession.AuthRequest(config);

      // Prompt for authentication
      const result = await request.promptAsync(this.googleDiscovery);

      console.log("Google OAuth result:", {
        type: result.type,
        hasCode: result.type === "success" && !!result.params?.code,
        error: result.type === "success" ? result.params?.error : undefined,
      });

      if (result.type === "success" && result.params?.code) {
        return this.handleOAuthCallback(
          "google",
          result.params.code,
          config.redirectUri,
        );
      } else if (result.type === "cancel") {
        throw new Error("Google sign-in was cancelled");
      } else if (result.type === "success" && result.params?.error) {
        throw new Error(`Google OAuth error: ${result.params.error}`);
      } else {
        throw new Error("Google sign-in failed");
      }
    } catch (error) {
      console.error("Google sign-in error:", error);
      throw new Error("Google sign-in failed");
    }
  }

  /**
   * Sign in with Facebook
   */
  async signInWithFacebook(): Promise<OAuthResponse> {
    try {
      const config = this.createFacebookConfig();

      // Validate configuration
      if (!config.clientId) {
        throw new Error(
          "Facebook Client ID is not configured. Please check your environment variables.",
        );
      }

      console.log("Starting Facebook OAuth flow with:", {
        clientId: config.clientId.substring(0, 10) + "...",
        redirectUri: config.redirectUri,
        scopes: config.scopes,
      });

      // Create auth request
      const request = new AuthSession.AuthRequest(config);

      // Prompt for authentication
      const result = await request.promptAsync(this.facebookDiscovery);

      console.log("Facebook OAuth result:", {
        type: result.type,
        hasCode: result.type === "success" && !!result.params?.code,
        error: result.type === "success" ? result.params?.error : undefined,
      });

      if (result.type === "success" && result.params?.code) {
        return this.handleOAuthCallback(
          "facebook",
          result.params.code,
          config.redirectUri,
        );
      } else if (result.type === "cancel") {
        throw new Error("Facebook sign-in was cancelled");
      } else if (result.type === "success" && result.params?.error) {
        throw new Error(`Facebook OAuth error: ${result.params.error}`);
      } else {
        throw new Error("Facebook sign-in failed");
      }
    } catch (error) {
      console.error("Facebook sign-in error:", error);
      throw new Error("Facebook sign-in failed");
    }
  }

  /**
   * Handle OAuth callback by sending the authorization code to your backend
   */
  private async handleOAuthCallback(
    provider: "google" | "facebook",
    code: string,
    redirectUri: string,
  ): Promise<OAuthResponse> {
    try {
      console.log(`Handling ${provider} OAuth callback:`, {
        codeLength: code.length,
        redirectUri,
        apiUrl: `${apiClient.baseUrl}/api/auth/oauth/${provider}`,
      });

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
   * Check if OAuth providers are available
   */
  isGoogleAvailable(): boolean {
    const hasGoogleId = !!process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
    console.log("Google OAuth available:", hasGoogleId);
    return hasGoogleId;
  }

  isFacebookAvailable(): boolean {
    const hasFacebookId = !!process.env.EXPO_PUBLIC_FACEBOOK_CLIENT_ID;
    console.log("Facebook OAuth available:", hasFacebookId);
    return hasFacebookId;
  }

  /**
   * Get available OAuth providers
   */
  getAvailableProviders(): Array<"google" | "facebook"> {
    const providers: Array<"google" | "facebook"> = [];

    if (this.isGoogleAvailable()) {
      providers.push("google");
    }

    if (this.isFacebookAvailable()) {
      providers.push("facebook");
    }

    return providers;
  }

  /**
   * Get redirect URI for debugging purposes
   */
  getRedirectUriForDebug(): string {
    return this.getRedirectUri("google");
  }
}

export const oAuthService = new OAuthService();
