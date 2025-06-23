import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";
import { apiClient } from "./ApiClient";

// Complete the auth session
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
  private googleConfig: AuthSession.AuthRequestConfig;
  private facebookConfig: AuthSession.AuthRequestConfig;

  // Google discovery document - this is the recommended approach
  private googleDiscovery: AuthSession.DiscoveryDocument = {
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    revocationEndpoint: "https://oauth2.googleapis.com/revoke",
  };

  constructor() {
    let redirectUri: string;

    // In Expo Go, we use the auth proxy.
    // In dev clients and standalone builds, we use the custom scheme.
    if (Constants.appOwnership === "expo") {
      // You can find your slug in app.json and username by running `expo whoami`.
      const slug = "mobile-app"; // from app.config.ts
      const username = "tenuto"; // from `expo whoami`
      redirectUri = `https://auth.expo.io/@${username}/${slug}`;
    } else {
      redirectUri = AuthSession.makeRedirectUri();
    }

    this.googleConfig = {
      clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || "",
      scopes: ["openid", "profile", "email"],
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
    };

    this.facebookConfig = {
      clientId: process.env.EXPO_PUBLIC_FACEBOOK_CLIENT_ID || "",
      scopes: ["public_profile", "email"],
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
    };

    // Log configuration for debugging
    console.log("OAuthService initialized with:", {
      googleClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID
        ? "Set"
        : "Not set",
      redirectUri: this.googleConfig.redirectUri,
      apiUrl: process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000",
      appOwnership: Constants.appOwnership,
    });
  }

  /**
   * Sign in with Google using the recommended discovery document approach
   */
  async signInWithGoogle(): Promise<OAuthResponse> {
    try {
      // Validate configuration
      if (!this.googleConfig.clientId) {
        throw new Error(
          "Google Client ID is not configured. Please check your environment variables.",
        );
      }

      console.log("Starting Google OAuth flow with:", {
        clientId: this.googleConfig.clientId.substring(0, 10) + "...",
        redirectUri: this.googleConfig.redirectUri,
        scopes: this.googleConfig.scopes,
      });

      const request = new AuthSession.AuthRequest(this.googleConfig);
      const result = await request.promptAsync(this.googleDiscovery);

      console.log("Google OAuth result:", {
        type: result.type,
        hasCode: result.type === "success" && !!result.params?.code,
        error: result.type === "success" ? result.params?.error : undefined,
      });

      if (result.type === "success" && result.params?.code) {
        return this.handleOAuthCallback("google", result.params.code);
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
      const request = new AuthSession.AuthRequest(this.facebookConfig);
      const result = await request.promptAsync({
        authorizationEndpoint: "https://www.facebook.com/v18.0/dialog/oauth",
      });

      if (result.type === "success" && result.params.code) {
        return this.handleOAuthCallback("facebook", result.params.code);
      } else if (result.type === "cancel") {
        throw new Error("Facebook sign-in was cancelled");
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
  ): Promise<OAuthResponse> {
    try {
      const redirectUri =
        provider === "google"
          ? this.googleConfig.redirectUri
          : this.facebookConfig.redirectUri;

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
    return !!process.env.EXPO_PUBLIC_FACEBOOK_CLIENT_ID;
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
}

export const oAuthService = new OAuthService();
