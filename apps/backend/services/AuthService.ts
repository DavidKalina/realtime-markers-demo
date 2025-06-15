// src/services/AuthService.ts

import bcrypt from "bcrypt";
import jwt, { type SignOptions } from "jsonwebtoken";
import { Repository } from "typeorm";
import { User } from "../entities/User";
import type { UserPreferencesServiceImpl } from "./UserPreferences";
import { addDays, format } from "date-fns";
import { LevelingService } from "./LevelingService";
import { createFriendshipService } from "./FriendshipService";
import { DataSource } from "typeorm";
import { OpenAIModel, type OpenAIService } from "./shared/OpenAIService";
import { createFriendshipCacheService } from "./shared/FriendshipCacheService";

export interface UserRegistrationData {
  email: string;
  password: string;
  displayName?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  private userRepository: Repository<User>;
  private jwtSecret: string;
  private refreshSecret: string;
  private accessTokenExpiry: SignOptions["expiresIn"];
  private refreshTokenExpiry: SignOptions["expiresIn"];
  private userPreferencesService: UserPreferencesServiceImpl;
  private levelingService: LevelingService;
  private dataSource: DataSource;
  private openAIService: OpenAIService;

  constructor(
    userRepository: Repository<User>,
    userPreferencesService: UserPreferencesServiceImpl,
    levelingService: LevelingService,
    dataSource: DataSource,
    openAIService: OpenAIService,
  ) {
    this.userRepository = userRepository;
    this.userPreferencesService = userPreferencesService;
    this.levelingService = levelingService;
    this.dataSource = dataSource;
    this.openAIService = openAIService;
    this.jwtSecret = process.env.JWT_SECRET!;
    if (!this.jwtSecret) {
      throw new Error("JWT_SECRET environment variable must be set");
    }
    this.refreshSecret = process.env.REFRESH_SECRET!;
    if (!this.refreshSecret) {
      throw new Error("REFRESH_SECRET environment variable must be set");
    }
    this.accessTokenExpiry = "1h";
    this.refreshTokenExpiry = "7d";
  }

  /**
   * Check if a username or display name is appropriate using OpenAI
   */
  private async isContentAppropriate(content: string): Promise<boolean> {
    try {
      const prompt = `Please analyze if the following username/display name is appropriate for a general audience platform. Consider:
1. No profanity or offensive language
2. No hate speech or discriminatory content
3. No impersonation of public figures
4. No explicit sexual content
5. No promotion of harmful activities

Content to analyze: "${content}"

Respond with a JSON object containing:
{
  "isAppropriate": boolean,
  "reason": string
}`;

      const response = await this.openAIService.executeChatCompletion({
        model: OpenAIModel.GPT4OMini,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        response_format: { type: "json_object" },
      });

      const responseContent = response.choices[0].message.content;
      if (!responseContent) {
        throw new Error("No content received from OpenAI");
      }
      const result = JSON.parse(responseContent);
      return result.isAppropriate;
    } catch (error) {
      console.error("Error checking content appropriateness:", error);
      // If we can't check appropriateness, default to allowing the content
      // This is safer than blocking legitimate users if the service is down
      return true;
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

    // Check content appropriateness if display name is provided
    if (userData.displayName) {
      const isAppropriate = await this.isContentAppropriate(
        userData.displayName,
      );
      if (!isAppropriate) {
        throw new Error("Display name contains inappropriate content");
      }
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(userData.password, saltRounds);

    // Create new user
    const newUser = this.userRepository.create({
      email: userData.email,
      passwordHash,
      displayName: userData.displayName || userData.email.split("@")[0],
      username: userData.displayName || userData.email.split("@")[0],
      isVerified: false, // Set to false by default - would need email verification process
    });

    const savedUser = await this.userRepository.save(newUser);

    // Create default two-week filter using date-fns for consistency with frontend
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
        "displayName",
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
        "displayName",
        "role",
        "isVerified",
        "avatarUrl",
        "bio",
        "createdAt",
        "scanCount",
        "saveCount",
        "totalXp",
        "currentTitle",
        "friendCode",
        "username",
      ],
    });

    if (!user) {
      return null;
    }

    // Generate a friend code if the user doesn't have one
    if (!user.friendCode) {
      const friendshipService = createFriendshipService({
        dataSource: this.dataSource,
        friendshipCacheService: createFriendshipCacheService(),
      });
      user.friendCode = await friendshipService.generateFriendCode(userId);
      await this.userRepository.save(user);
    }

    // Get level information from LevelingService
    const levelInfo = await this.levelingService.getUserLevelInfo(userId);

    // Create a new object with level information
    const userWithLevelInfo = {
      ...user,
      level: levelInfo.currentLevel,
      currentTitle: levelInfo.currentTitle,
      totalXp: levelInfo.totalXp,
      nextLevelXp: levelInfo.nextLevelXp,
      xpProgress: levelInfo.progress,
    };

    return userWithLevelInfo;
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

    // Check content appropriateness if display name is being updated
    if (userData.displayName) {
      const isAppropriate = await this.isContentAppropriate(
        userData.displayName,
      );
      if (!isAppropriate) {
        throw new Error("Display name contains inappropriate content");
      }
    }

    // Check content appropriateness if username is being updated
    if (userData.username) {
      const isAppropriate = await this.isContentAppropriate(userData.username);
      if (!isAppropriate) {
        throw new Error("Username contains inappropriate content");
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
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error("Invalid password");
    }

    // Delete the user
    await this.userRepository.delete(userId);
    return true;
  }
}
