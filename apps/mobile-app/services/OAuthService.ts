import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
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
  private googleConfig: AuthSession.AuthRequestConfig = {
    clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || "",
    scopes: ["openid", "profile", "email"],
    redirectUri: AuthSession.makeRedirectUri({
      scheme: "realtime-markers-demo",
      path: "oauth/google",
    }),
    responseType: AuthSession.ResponseType.Code,
    codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
  };

  private facebookConfig: AuthSession.AuthRequestConfig = {
    clientId: process.env.EXPO_PUBLIC_FACEBOOK_CLIENT_ID || "",
    scopes: ["public_profile", "email"],
    redirectUri: AuthSession.makeRedirectUri({
      scheme: "realtime-markers-demo",
      path: "oauth/facebook",
    }),
    responseType: AuthSession.ResponseType.Code,
    codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
  };

  /**
   * Sign in with Google
   */
  async signInWithGoogle(): Promise<OAuthResponse> {
    try {
      const request = new AuthSession.AuthRequest(this.googleConfig);
      const result = await request.promptAsync({
        authorizationEndpoint: "https://accounts.google.com/oauth/authorize",
      });

      if (result.type === "success" && result.params.code) {
        return this.handleOAuthCallback("google", result.params.code);
      } else {
        throw new Error("Google sign-in was cancelled or failed");
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
      } else {
        throw new Error("Facebook sign-in was cancelled or failed");
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
      const response = await fetch(
        `${apiClient.baseUrl}/api/auth/oauth/${provider}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            code,
            redirectUri:
              provider === "google"
                ? this.googleConfig.redirectUri
                : this.facebookConfig.redirectUri,
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.details || errorData.error || `HTTP ${response.status}`,
        );
      }

      const data = await response.json();

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
    return !!process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
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
