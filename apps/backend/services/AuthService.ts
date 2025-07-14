// src/services/AuthService.ts

import bcrypt from "bcrypt";
import jwt, { type SignOptions } from "jsonwebtoken";
import { Repository, DataSource } from "typeorm";
import { User, UserRole } from "@realtime-markers/database";
import type { UserPreferencesServiceImpl } from "./UserPreferences";
import { addDays, format } from "date-fns";
import type { OpenAIService } from "./shared/OpenAIService";
import { OpenAIModel } from "./shared/OpenAIService";

export interface UserRegistrationData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthServiceDependencies {
  userRepository: Repository<User>;
  userPreferencesService: UserPreferencesServiceImpl;
  dataSource: DataSource;
  openAIService: OpenAIService;
}

export class AuthService {
  private userRepository: Repository<User>;
  private jwtSecret: string;
  private refreshSecret: string;
  private accessTokenExpiry: SignOptions["expiresIn"];
  private refreshTokenExpiry: SignOptions["expiresIn"];
  private userPreferencesService: UserPreferencesServiceImpl;
  private dataSource: DataSource;
  private openAIService: OpenAIService;

  constructor(private dependencies: AuthServiceDependencies) {
    this.userRepository = dependencies.userRepository;
    this.userPreferencesService = dependencies.userPreferencesService;
    this.dataSource = dependencies.dataSource;
    this.openAIService = dependencies.openAIService;
    this.jwtSecret = process.env.JWT_SECRET || "your-secret-key";
    this.refreshSecret = process.env.REFRESH_SECRET || "your-refresh-secret";
    this.accessTokenExpiry = "1h";
    this.refreshTokenExpiry = "7d";
  }

  /**
   * Check if content is appropriate using OpenAI
   */
  private async isContentAppropriate(content: string): Promise<boolean> {
    try {
      const response = await this.openAIService.executeChatCompletion({
        model: OpenAIModel.GPT4OMini,
        messages: [
          {
            role: "system",
            content:
              "You are a content moderator. Determine if the given content is appropriate for a family-friendly event discovery app. Consider:\n" +
              "1. No profanity or offensive language\n" +
              "2. No hate speech or discriminatory content\n" +
              "3. No inappropriate sexual content\n" +
              "4. No violent or threatening content\n" +
              "5. No spam or misleading content\n\n" +
              "Respond with only 'APPROPRIATE' or 'INAPPROPRIATE'.",
          },
          {
            role: "user",
            content: `Evaluate this content: "${content}"`,
          },
        ],
        max_tokens: 10,
        temperature: 0,
      });

      const result = response.choices[0]?.message?.content?.trim();
      return result === "APPROPRIATE";
    } catch (error) {
      console.error("Error checking content appropriateness:", error);
      // Default to allowing content if moderation fails
      return true;
    }
  }

  /**
   * Validate names for appropriateness
   */
  private async validateNames(
    firstName?: string,
    lastName?: string,
  ): Promise<void> {
    const namesToValidate: string[] = [];

    if (firstName?.trim()) {
      namesToValidate.push(firstName.trim());
    }

    if (lastName?.trim()) {
      namesToValidate.push(lastName.trim());
    }

    if (namesToValidate.length === 0) {
      return; // No names to validate
    }

    // Check each name individually
    for (const name of namesToValidate) {
      const isAppropriate = await this.isContentAppropriate(name);
      if (!isAppropriate) {
        throw new Error(`Name "${name}" contains inappropriate content`);
      }
    }
  }

  /**
   * Register a new user
   */
  async register(userData: UserRegistrationData): Promise<User> {
    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: userData.email },
    });

    if (existingUser) {
      throw new Error("User with this email already exists");
    }

    // Validate names for appropriateness
    await this.validateNames(userData.firstName, userData.lastName);

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(userData.password, saltRounds);

    // Create new user
    const newUser = this.userRepository.create({
      email: userData.email,
      firstName: userData.firstName?.trim(),
      lastName: userData.lastName?.trim(),
      passwordHash,
      isVerified: false, // Set to false by default - would need email verification process
    });

    const savedUser = await this.userRepository.save(newUser);

    const now = new Date();
    const twoWeeksFromNow = addDays(now, 14);

    const defaultFilter = await this.userPreferencesService.createFilter(
      savedUser.id,
      {
        name: "First Two Weeks",
        isActive: true,
        criteria: {
          dateRange: {
            start: format(now, "yyyy-MM-dd"),
            end: format(twoWeeksFromNow, "yyyy-MM-dd"),
          },
        },
      },
    );

    // Apply the filter
    await this.userPreferencesService.applyFilters(savedUser.id, [
      defaultFilter.id,
    ]);
    return savedUser;
  }

  /**
   * Login user and generate auth tokens
   */
  async login(
    email: string,
    password: string,
  ): Promise<{ user: User; tokens: AuthTokens }> {
    // Find user by email with password included
    const user = await this.userRepository.findOne({
      where: { email },
      select: [
        "id",
        "email",
        "passwordHash",
        "role",
        "isVerified",
        "avatarUrl",
        "saveCount",
      ],
    });

    if (!user) {
      throw new Error("Invalid credentials");
    }

    // Verify password
    if (!user.passwordHash) {
      throw new Error("Invalid credentials");
    }
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error("Invalid credentials");
    }

    // Generate tokens
    const tokens = this.generateTokens(user);

    // Save refresh token to user
    user.refreshToken = tokens.refreshToken;
    await this.userRepository.save(user);

    // Don't return passwordHash or refreshToken to client
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (user as any).passwordHash;
    delete user.refreshToken;

    return { user, tokens };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      console.log("Starting token refresh process...");

      // Verify the refresh token
      const decoded = jwt.verify(refreshToken, this.refreshSecret) as {
        userId: string;
      };
      console.log("Refresh token verified, userId:", decoded.userId);

      // First check if user exists at all
      const userExists = await this.userRepository.findOne({
        where: { id: decoded.userId },
        select: ["id", "refreshToken"], // Explicitly select refreshToken
      });

      if (!userExists) {
        console.log("User not found in database");
        throw new Error("Invalid refresh token");
      }

      console.log("User exists, current refresh token in DB:", {
        hasRefreshToken: !!userExists.refreshToken,
        tokenLength: userExists.refreshToken?.length,
        tokenPrefix: userExists.refreshToken?.substring(0, 20) + "...",
        incomingTokenPrefix: refreshToken.substring(0, 20) + "...",
      });

      // Now find user with matching refresh token
      const user = await this.userRepository.findOne({
        where: {
          id: decoded.userId,
          refreshToken,
        },
      });

      if (!user) {
        console.log(
          "No user found with matching refresh token. Token mismatch detected.",
          {
            storedTokenPrefix:
              userExists.refreshToken?.substring(0, 20) + "...",
            incomingTokenPrefix: refreshToken.substring(0, 20) + "...",
            storedTokenLength: userExists.refreshToken?.length,
            incomingTokenLength: refreshToken.length,
          },
        );
        throw new Error("Invalid refresh token");
      }

      // Generate new tokens
      const tokens = this.generateTokens(user);
      console.log("Generated new tokens");

      try {
        // Update refresh token in database
        user.refreshToken = tokens.refreshToken;
        console.log("Attempting to save user with new refresh token...");
        await this.userRepository.save(user);
        console.log("Successfully saved new refresh token");
      } catch (saveError) {
        console.error("Error saving refresh token:", saveError);
        // If it's a database error, log more details
        if (saveError instanceof Error) {
          console.error("Save error details:", {
            message: saveError.message,
            stack: saveError.stack,
          });
        }
        throw new Error("Failed to update refresh token");
      }

      return tokens;
    } catch (error) {
      console.error("Token refresh error details:", {
        error:
          error instanceof Error
            ? {
                message: error.message,
                stack: error.stack,
                name: error.name,
              }
            : error,
      });

      if (error instanceof jwt.TokenExpiredError) {
        throw new Error("Refresh token expired");
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error("Invalid refresh token");
      }
      throw error;
    }
  }

  /**
   * Logout user by invalidating refresh token
   */
  async logout(userId: string): Promise<boolean> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      return false;
    }

    // Remove refresh token
    user.refreshToken = undefined;
    await this.userRepository.save(user);

    return true;
  }

  /**
   * Generate JWT tokens (access and refresh)
   */
  private generateTokens(user: User): AuthTokens {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = jwt.sign(
      payload,
      this.jwtSecret as jwt.Secret,
      { expiresIn: this.accessTokenExpiry }, // "1h"
    );

    const refreshToken = jwt.sign(
      { id: user.id },
      this.refreshSecret as jwt.Secret,
      { expiresIn: this.refreshTokenExpiry }, // "7d"
    );

    return { accessToken, refreshToken };
  }

  /**
   * Validate a JWT token and return the payload
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  validateToken(token: string): any {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      return null;
    }
  }

  /**
   * Get user profile by ID
   */
  async getUserProfile(userId: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: [
        "id",
        "email",
        "firstName",
        "lastName",
        "role",
        "isVerified",
        "avatarUrl",
        "bio",
        "createdAt",
        "scanCount",
        "saveCount",
      ],
    });

    return user;
  }

  /**
   * Update user profile
   */
  async updateUserProfile(
    userId: string,
    userData: Partial<User>,
  ): Promise<User | null> {
    // Exclude sensitive fields from updates
    delete userData.passwordHash;
    delete userData.refreshToken;
    delete userData.role; // Role should be updated through admin functions
    delete userData.id;
    delete userData.email; // Email changes should have their own flow with verification

    // Validate names for appropriateness if they're being updated
    if (userData.firstName !== undefined || userData.lastName !== undefined) {
      await this.validateNames(userData.firstName, userData.lastName);

      // Trim names if they're being updated
      if (userData.firstName !== undefined) {
        userData.firstName = userData.firstName?.trim();
      }
      if (userData.lastName !== undefined) {
        userData.lastName = userData.lastName?.trim();
      }
    }

    await this.userRepository.update(userId, userData);
    return this.getUserProfile(userId);
  }

  /**
   * Change user password
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ["id", "passwordHash"],
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Verify current password
    if (!user.passwordHash) {
      throw new Error("Current password is incorrect");
    }
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new Error("Current password is incorrect");
    }

    // Hash new password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    user.passwordHash = passwordHash;
    await this.userRepository.save(user);

    return true;
  }

  /**
   * Delete user account
   */
  async deleteAccount(userId: string, password: string): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ["id", "passwordHash"],
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Verify password before deletion
    if (!user.passwordHash) {
      throw new Error("Invalid password");
    }
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error("Invalid password");
    }

    // Delete the user
    await this.userRepository.delete(userId);
    return true;
  }

  /**
   * Handle Google OAuth
   */
  async handleGoogleOAuth(
    code: string,
    redirectUri: string,
    codeVerifier?: string,
    platform?: "ios" | "android" | "web",
  ): Promise<{ user: User; tokens: AuthTokens }> {
    try {
      let clientId: string | undefined;
      let clientSecret: string | undefined;

      // Select credentials based on platform
      switch (platform) {
        case "ios":
          clientId = process.env.GOOGLE_IOS_CLIENT_ID;
          break;
        case "android":
          clientId = process.env.GOOGLE_ANDROID_CLIENT_ID;
          break;
        default: // 'web' or undefined
          clientId = process.env.GOOGLE_CLIENT_ID; // This is the Web client
          clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      }

      if (!clientId) {
        throw new Error(
          `Google Client ID not configured for platform: ${platform || "web"}`,
        );
      }

      const tokenRequestBody: Record<string, string> = {
        code,
        client_id: clientId,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      };

      // If PKCE is used, add verifier and don't send secret
      if (codeVerifier) {
        tokenRequestBody.code_verifier = codeVerifier;
      } else if (clientSecret) {
        // Fallback for flows without PKCE (e.g., old web flow)
        tokenRequestBody.client_secret = clientSecret;
      }

      // Exchange authorization code for tokens
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(tokenRequestBody),
      });

      if (!tokenResponse.ok) {
        const errorBody = await tokenResponse.json();
        console.error("Google token exchange failed:", {
          status: tokenResponse.status,
          body: errorBody,
        });
        throw new Error("Failed to exchange Google authorization code");
      }

      const tokenData = await tokenResponse.json();
      const { access_token } = tokenData;

      // Get user info from Google
      const userInfoResponse = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        {
          headers: {
            Authorization: `Bearer ${access_token}`,
          },
        },
      );

      if (!userInfoResponse.ok) {
        throw new Error("Failed to get Google user info");
      }

      const userInfo = await userInfoResponse.json();

      // Find or create user
      let user = await this.userRepository.findOne({
        where: { email: userInfo.email },
      });

      if (!user) {
        // Create new user
        user = this.userRepository.create({
          email: userInfo.email,
          firstName: userInfo.given_name,
          lastName: userInfo.family_name,
          avatarUrl: userInfo.picture,
          isVerified: true, // Google users are verified
          role: UserRole.USER,
        });

        user = await this.userRepository.save(user);

        // Create default filter for new user
      }

      // Generate tokens
      const tokens = this.generateTokens(user);

      // Save refresh token
      user.refreshToken = tokens.refreshToken;
      await this.userRepository.save(user);

      // Don't return sensitive data
      delete user.refreshToken;

      return { user, tokens };
    } catch (error) {
      console.error("Google OAuth error:", error);
      throw new Error("Google OAuth failed");
    }
  }

  /**
   * Handle Facebook OAuth
   */
  async handleFacebookOAuth(
    code: string,
    redirectUri: string,
    codeVerifier?: string,
  ): Promise<{ user: User; tokens: AuthTokens }> {
    try {
      const clientId = process.env.FACEBOOK_CLIENT_ID;
      const clientSecret = process.env.FACEBOOK_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        throw new Error("Facebook Client ID or Secret not configured.");
      }

      const tokenRequestBody: Record<string, string> = {
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      };

      // Facebook also supports PKCE
      if (codeVerifier) {
        tokenRequestBody.code_verifier = codeVerifier;
      }

      // Exchange authorization code for tokens
      const tokenResponse = await fetch(
        "https://graph.facebook.com/v18.0/oauth/access_token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams(tokenRequestBody),
        },
      );

      if (!tokenResponse.ok) {
        const errorBody = await tokenResponse.json();
        console.error("Facebook token exchange failed:", {
          status: tokenResponse.status,
          body: errorBody,
        });
        throw new Error("Failed to exchange Facebook authorization code");
      }

      const tokenData = await tokenResponse.json();
      const { access_token } = tokenData;

      // Get user info from Facebook
      const userInfoResponse = await fetch(
        `https://graph.facebook.com/v18.0/me?fields=id,email,first_name,last_name,picture&access_token=${access_token}`,
      );

      if (!userInfoResponse.ok) {
        throw new Error("Failed to get Facebook user info");
      }

      const userInfo = await userInfoResponse.json();

      // Find or create user
      let user = await this.userRepository.findOne({
        where: { email: userInfo.email },
      });

      if (!user) {
        // Create new user
        user = this.userRepository.create({
          email: userInfo.email,
          firstName: userInfo.first_name,
          lastName: userInfo.last_name,
          avatarUrl: userInfo.picture?.data?.url,
          isVerified: true, // Facebook users are verified
          role: UserRole.USER,
        });

        user = await this.userRepository.save(user);

        // Create default filter for new user
        const now = new Date();
        const twoWeeksFromNow = addDays(now, 14);

        const defaultFilter = await this.userPreferencesService.createFilter(
          user.id,
          {
            name: "First Two Weeks",
            isActive: true,
            criteria: {
              dateRange: {
                start: format(now, "yyyy-MM-dd"),
                end: format(twoWeeksFromNow, "yyyy-MM-dd"),
              },
            },
          },
        );

        await this.userPreferencesService.applyFilters(user.id, [
          defaultFilter.id,
        ]);
      }

      // Generate tokens
      const tokens = this.generateTokens(user);

      // Save refresh token
      user.refreshToken = tokens.refreshToken;
      await this.userRepository.save(user);

      // Don't return sensitive data
      delete user.refreshToken;

      return { user, tokens };
    } catch (error) {
      console.error("Facebook OAuth error:", error);
      throw new Error("Facebook OAuth failed");
    }
  }
}

export function createAuthService(
  dependencies: AuthServiceDependencies,
): AuthService {
  return new AuthService(dependencies);
}
