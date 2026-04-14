import { BaseApiClient } from "../base/ApiClient";
import { User, AuthTokens, LoginResponse } from "../base/types";

export class AuthModule {
  constructor(protected readonly client: BaseApiClient) {}

  /**
   * Login with email and password
   * @returns The logged in user
   */
  async login(email: string, password: string): Promise<User> {
    const url = `${this.client.baseUrl}/api/auth/login`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await this.client.handleResponse<LoginResponse>(response);

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

      // Save auth state and notify listeners
      await this.client.saveAuthState(data.user, tokens);

      // Ensure we're initialized
      await this.client.ensureInitialized();

      return data.user;
    } catch (error) {
      console.error("Login error:", error);
      // Clear any partial auth state on error
      await this.client.clearAuthState();
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
    firstName?: string,
    lastName?: string,
  ): Promise<User> {
    const url = `${this.client.baseUrl}/api/auth/register`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password, firstName, lastName }),
    });

    return this.client.handleResponse<User>(response);
  }

  /**
   * Logout the current user
   */
  async logout(): Promise<void> {
    const accessToken = await this.client.getAccessToken();
    if (accessToken) {
      try {
        const url = `${this.client.baseUrl}/api/auth/logout`;
        await this.client.fetchWithAuth(url, {
          method: "POST",
        });
      } catch (error) {
        console.error("Logout API error:", error);
      }
    }
    await this.client.clearAuthState();
  }

  /**
   * Get the current user's profile
   * @returns The current user's profile
   */
  async getUserProfile(): Promise<User> {
    const url = `${this.client.baseUrl}/api/auth/me`;
    const response = await this.client.fetchWithAuth(url, { method: "POST" });
    const user = await this.client.handleResponse<User>(response);

    // Update local user state with the new data
    if (this.client.user) {
      this.client.user = { ...this.client.user, ...user };
      await this.client.saveAuthState(this.client.user, this.client.tokens!);
    }

    return user;
  }

  /**
   * Update the current user's profile
   * @returns The updated user profile
   */
  async updateUserProfile(updates: Partial<User>): Promise<User> {
    const url = `${this.client.baseUrl}/api/users/me`;
    const response = await this.client.fetchWithAuth(url, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });

    const updatedUser = await this.client.handleResponse<User>(response);

    // Update local user state
    if (this.client.user) {
      this.client.user = { ...this.client.user, ...updatedUser };
      await this.client.saveAuthState(this.client.user, this.client.tokens!);
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
    const url = `${this.client.baseUrl}/api/users/me/change-password`;
    const response = await this.client.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    await this.client.handleResponse<{ success: boolean }>(response);
    return true;
  }

  /**
   * Delete the current user's account
   * @returns true if successful
   */
  async deleteAccount(password: string): Promise<boolean> {
    const url = `${this.client.baseUrl}/api/auth/account`;
    const response = await this.client.fetchWithAuth(url, {
      method: "DELETE",
      body: JSON.stringify({ password }),
    });

    await this.client.handleResponse<{ message: string }>(response);
    await this.client.clearAuthState();
    return true;
  }

  /**
   * Request a password reset email
   * @returns true if the request was successful
   */
  async requestPasswordReset(email: string): Promise<boolean> {
    const url = `${this.client.baseUrl}/api/auth/password-reset`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    await this.client.handleResponse<{ message: string }>(response);
    return true;
  }

  /**
   * Reset password using email, 6-digit code, and new password
   * @returns true if the password was reset successfully
   */
  async resetPassword(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<boolean> {
    const url = `${this.client.baseUrl}/api/auth/password-reset/confirm`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, code, newPassword }),
    });

    await this.client.handleResponse<{ message: string }>(response);
    return true;
  }

  /**
   * Verify an email address using a verification token
   * @returns true if the email was verified successfully
   */
  async verifyEmail(token: string): Promise<boolean> {
    const url = `${this.client.baseUrl}/api/auth/verify-email`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    });

    await this.client.handleResponse<{ message: string }>(response);
    return true;
  }

  /**
   * Request a new email verification token
   * @returns true if the request was successful
   */
  async requestEmailVerification(): Promise<boolean> {
    const url = `${this.client.baseUrl}/api/auth/verify-email/request`;
    const response = await this.client.fetchWithAuth(url, {
      method: "POST",
    });

    await this.client.handleResponse<{ message: string }>(response);
    return true;
  }

}

