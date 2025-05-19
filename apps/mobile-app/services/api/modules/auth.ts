import { BaseApiClient } from "../base/ApiClient";
import { User, AuthTokens, LoginResponse } from "../base/types";

export class AuthModule extends BaseApiClient {
  /**
   * Login with email and password
   * @returns The logged in user
   */
  async login(email: string, password: string): Promise<User> {
    const url = `${this.baseUrl}/api/auth/login`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await this.handleResponse<LoginResponse>(response);

      if (!data.user) {
        throw new Error("User data missing from login response");
      }

      if (!data.accessToken) {
        throw new Error("Access token missing from login response");
      }

      const tokens: AuthTokens = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      };

      await this.saveAuthState(data.user, tokens);
      return data.user;
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  }

  /**
   * Register a new user
   * @returns The newly created user
   */
  async register(
    email: string,
    password: string,
    displayName?: string,
  ): Promise<User> {
    const url = `${this.baseUrl}/api/auth/register`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password, displayName }),
    });

    return this.handleResponse<User>(response);
  }

  /**
   * Logout the current user
   */
  async logout(): Promise<void> {
    if (this.tokens?.accessToken) {
      try {
        const url = `${this.baseUrl}/api/auth/logout`;
        await this.fetchWithAuth(url, {
          method: "POST",
        });
      } catch (error) {
        console.error("Logout API error:", error);
        // Continue with local logout even if API call fails
      }
    }

    await this.clearAuthState();
  }

  /**
   * Get the current user's profile
   * @returns The current user's profile
   */
  async getUserProfile(): Promise<User> {
    const url = `${this.baseUrl}/api/auth/me`;
    const response = await this.fetchWithAuth(url, { method: "POST" });
    const user = await this.handleResponse<User>(response);

    // Update local user state with the new data
    if (this.user) {
      this.user = { ...this.user, ...user };
      await this.saveAuthState(this.user, this.tokens!);
    }

    return user;
  }

  /**
   * Update the current user's profile
   * @returns The updated user profile
   */
  async updateUserProfile(updates: Partial<User>): Promise<User> {
    const url = `${this.baseUrl}/api/users/me`;
    const response = await this.fetchWithAuth(url, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });

    const updatedUser = await this.handleResponse<User>(response);

    // Update local user state
    if (this.user) {
      this.user = { ...this.user, ...updatedUser };
      await this.saveAuthState(this.user, this.tokens!);
    }

    return updatedUser;
  }

  /**
   * Change the current user's password
   * @returns true if successful
   */
  async changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<boolean> {
    const url = `${this.baseUrl}/api/users/me/change-password`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    await this.handleResponse<{ success: boolean }>(response);
    return true;
  }

  /**
   * Delete the current user's account
   * @returns true if successful
   */
  async deleteAccount(password: string): Promise<boolean> {
    const url = `${this.baseUrl}/api/auth/account`;
    const response = await this.fetchWithAuth(url, {
      method: "DELETE",
      body: JSON.stringify({ password }),
    });

    await this.handleResponse<{ message: string }>(response);
    await this.clearAuthState();
    return true;
  }

  /**
   * Check if the current access token is expired
   * @returns true if the token is expired
   */
  async isTokenExpired(): Promise<boolean> {
    if (!this.tokens?.accessToken) return true;

    try {
      const url = `${this.baseUrl}/api/auth/me`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.tokens.accessToken}`,
        },
      });

      return response.status === 401;
    } catch (error) {
      console.error("Error checking token expiration:", error);
      return true;
    }
  }

  /**
   * Refresh the current access token using the refresh token
   * @returns true if the refresh was successful
   */
  async refreshTokens(): Promise<boolean> {
    if (!this.tokens?.refreshToken) {
      console.log("No refresh token available");
      return false;
    }

    try {
      console.log("Attempting to refresh token");
      const url = `${this.baseUrl}/api/auth/refresh-token`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken: this.tokens.refreshToken }),
      });

      if (!response.ok) {
        console.error("Token refresh failed with status:", response.status);
        return false;
      }

      const data = await response.json();

      if (!data.accessToken) {
        console.error("Invalid refresh token response:", data);
        return false;
      }

      const newTokens: AuthTokens = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken || this.tokens.refreshToken,
      };

      this.tokens = newTokens;

      await Promise.all([
        this.saveAuthState(this.user!, newTokens),
        this.syncTokensWithStorage(),
      ]);

      console.log("Token refresh successful");
      return true;
    } catch (error) {
      console.error("Token refresh error:", error);
      return false;
    }
  }

  /**
   * Request a password reset email
   * @returns true if the request was successful
   */
  async requestPasswordReset(email: string): Promise<boolean> {
    const url = `${this.baseUrl}/api/auth/password-reset`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    await this.handleResponse<{ message: string }>(response);
    return true;
  }

  /**
   * Reset password using a reset token
   * @returns true if the password was reset successfully
   */
  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    const url = `${this.baseUrl}/api/auth/password-reset/confirm`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token, newPassword }),
    });

    await this.handleResponse<{ message: string }>(response);
    return true;
  }

  /**
   * Verify an email address using a verification token
   * @returns true if the email was verified successfully
   */
  async verifyEmail(token: string): Promise<boolean> {
    const url = `${this.baseUrl}/api/auth/verify-email`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    });

    await this.handleResponse<{ message: string }>(response);
    return true;
  }

  /**
   * Request a new email verification token
   * @returns true if the request was successful
   */
  async requestEmailVerification(): Promise<boolean> {
    const url = `${this.baseUrl}/api/auth/verify-email/request`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
    });

    await this.handleResponse<{ message: string }>(response);
    return true;
  }
}

// Export as singleton
export const authModule = new AuthModule();
export default authModule;
