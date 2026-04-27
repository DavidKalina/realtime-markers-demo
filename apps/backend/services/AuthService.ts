// src/services/AuthService.ts

import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { Repository, DataSource } from "typeorm";
import { User } from "../entities";
import type { UserInput, UserUpdate, UserProfile } from "../types/derived";
import { addDays, format } from "date-fns";
import type { EmailService } from "./shared/EmailService";

// Tier definitions (previously in GamificationService)
const TIERS = [
  { name: "Explorer", minXp: 0, emoji: "\u{1F9ED}" },
  { name: "Scout", minXp: 500, emoji: "\u{1F52D}" },
  { name: "Curator", minXp: 2000, emoji: "\u{2B50}" },
  { name: "Ambassador", minXp: 5000, emoji: "\u{1F451}" },
] as const;

function getTierForXP(xp: number): {
  name: string;
  emoji: string;
  index: number;
} {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (xp >= TIERS[i].minXp) {
      return { name: TIERS[i].name, emoji: TIERS[i].emoji, index: i };
    }
  }
  return { name: TIERS[0].name, emoji: TIERS[0].emoji, index: 0 };
}

// Create a registration-specific interface that includes password
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
  dataSource: DataSource;
  emailService: EmailService;
}

export class AuthService {
  private userRepository: Repository<User>;
  private jwtSecret: string;
  private refreshSecret: string;
  private accessTokenExpiry: SignOptions["expiresIn"];
  private refreshTokenExpiry: SignOptions["expiresIn"];
  private dataSource: DataSource;
  private emailService: EmailService;

  constructor(private dependencies: AuthServiceDependencies) {
    this.userRepository = dependencies.userRepository;
    this.dataSource = dependencies.dataSource;
    this.emailService = dependencies.emailService;
    if (!process.env.JWT_SECRET || !process.env.REFRESH_SECRET) {
      throw new Error(
        "JWT_SECRET and REFRESH_SECRET environment variables are required",
      );
    }
    this.jwtSecret = process.env.JWT_SECRET;
    this.refreshSecret = process.env.REFRESH_SECRET;
    this.accessTokenExpiry = "1h";
    this.refreshTokenExpiry = "7d";
  }

  /**
   * Register a new user
   */
  async register(userData: UserRegistrationData): Promise<UserProfile> {
    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: userData.email },
    });

    if (existingUser) {
      throw new Error("User with this email already exists");
    }

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
    return this.toUserProfile(savedUser);
  }

  /**
   * Login user and generate auth tokens
   */
  async login(
    email: string,
    password: string,
  ): Promise<{ user: UserProfile; tokens: AuthTokens }> {
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
        "totalXp",
        "currentTier",
        "firstName",
        "lastName",
        "bio",
        "onboardingProfile",
        "comfortProfile",
        "fearLadder",
        "pacePreference",
        "reachMode",
        "onboardingPhase",
        "comfortRadiusMiles",
        "homeLatitude",
        "homeLongitude",
        "aiFocus",
        "socialSituation",
        "currentStreak",
        "longestStreak",
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

    return { user: this.toUserProfile(user), tokens };
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
  async getUserProfile(userId: string): Promise<UserProfile | null> {
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
        "totalXp",
        "currentTier",
        "currentStreak",
        "onboardingProfile",
        "comfortProfile",
        "fearLadder",
        "pacePreference",
        "reachMode",
        "onboardingPhase",
        "comfortRadiusMiles",
        "homeLatitude",
        "homeLongitude",
        "aiFocus",
        "socialSituation",
      ],
    });

    return user;
  }

  /**
   * Update user profile
   */
  async updateUserProfile(
    userId: string,
    userData: UserUpdate,
  ): Promise<UserProfile | null> {
    // Exclude sensitive fields from updates
    delete userData.passwordHash;
    delete userData.refreshToken;
    delete userData.role; // Role should be updated through admin functions
    // Note: userData.id is already excluded by UserUpdate type
    delete userData.email; // Email changes should have their own flow with verification

    // Trim names if they're being updated
    if (userData.firstName !== undefined || userData.lastName !== undefined) {
      if (userData.firstName !== undefined) {
        userData.firstName = userData.firstName?.trim();
      }
      if (userData.lastName !== undefined) {
        userData.lastName = userData.lastName?.trim();
      }
    }

    await this.userRepository.update(
      userId,
      userData as Record<string, unknown>,
    );
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
   * Request a password reset — generates a 6-digit code, emails it.
   * Always succeeds silently to prevent email enumeration.
   */
  async requestPasswordReset(email: string): Promise<void> {
    try {
      const user = await this.userRepository.findOne({ where: { email } });
      if (!user) return; // Silent — no enumeration

      // Generate 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();

      // Hash the code before storing
      const hashedCode = await bcrypt.hash(code, 10);

      // Store hashed code + 15 min expiry
      await this.userRepository.update(user.id, {
        passwordResetToken: hashedCode,
        passwordResetExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      });

      await this.emailService.sendPasswordResetEmail(email, code);
    } catch (error) {
      console.error("Error in requestPasswordReset:", error);
      // Swallow errors to prevent enumeration
    }
  }

  /**
   * Confirm password reset with email, code, and new password.
   */
  async confirmPasswordReset(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { email },
      select: ["id", "passwordResetToken", "passwordResetExpiresAt"],
    });

    if (!user || !user.passwordResetToken || !user.passwordResetExpiresAt) {
      throw new Error("Invalid or expired reset code");
    }

    // Check expiry
    if (new Date() > user.passwordResetExpiresAt) {
      throw new Error("Invalid or expired reset code");
    }

    // Verify code
    const isCodeValid = await bcrypt.compare(code, user.passwordResetToken);
    if (!isCodeValid) {
      throw new Error("Invalid or expired reset code");
    }

    // Hash new password and clear reset fields + refresh token
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.userRepository
      .createQueryBuilder()
      .update(User)
      .set({
        passwordHash,
        passwordResetToken: () => "NULL",
        passwordResetExpiresAt: () => "NULL",
        refreshToken: () => "NULL",
      })
      .where("id = :id", { id: user.id })
      .execute();

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
   * Convert User to UserProfile (removes sensitive fields)
   */
  private toUserProfile(user: User): UserProfile {
    // Always derive tier from totalXp to self-heal stale current_tier values
    const correctTier = getTierForXP(user.totalXp ?? 0).name;

    // Fire-and-forget DB correction if stale
    if (correctTier !== user.currentTier) {
      this.userRepository
        .update(user.id, { currentTier: correctTier })
        .catch(() => {});
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isVerified: user.isVerified,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      totalXp: user.totalXp,
      currentTier: correctTier,
      currentStreak: user.currentStreak ?? 0,
      longestStreak: user.longestStreak ?? 0,
      onboardingPhase: user.onboardingPhase ?? 0,
      onboardingProfile: user.onboardingProfile,
      comfortProfile: user.comfortProfile,
      fearLadder: user.fearLadder,
      pacePreference: user.pacePreference,
      reachMode: user.reachMode ?? null,
      comfortRadiusMiles: user.comfortRadiusMiles,
      homeLatitude: user.homeLatitude,
      homeLongitude: user.homeLongitude,
      aiFocus: user.aiFocus,
      socialSituation: user.socialSituation,
    };
  }
}
