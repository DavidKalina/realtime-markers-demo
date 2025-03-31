// src/services/AuthService.ts

import bcrypt from "bcrypt";
import jwt, { type SignOptions } from "jsonwebtoken";
import { Repository } from "typeorm";
import { User } from "../entities/User";

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

  constructor(userRepository: Repository<User>) {
    this.userRepository = userRepository;
    this.jwtSecret = process.env.JWT_SECRET!;
    this.refreshSecret = process.env.REFRESH_SECRET!;
    this.accessTokenExpiry = "1h";
    this.refreshTokenExpiry = "7d";
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

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(userData.password, saltRounds);

    // Create new user
    const newUser = this.userRepository.create({
      email: userData.email,
      passwordHash,
      displayName: userData.displayName || userData.email.split("@")[0],
      isVerified: false, // Set to false by default - would need email verification process
    });

    return this.userRepository.save(newUser);
  }

  /**
   * Login user and generate auth tokens
   */
  async login(email: string, password: string): Promise<{ user: User; tokens: AuthTokens }> {
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
    delete (user as any).passwordHash;
    delete user.refreshToken;

    return { user, tokens };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      // Verify the refresh token
      const decoded = jwt.verify(refreshToken, this.refreshSecret) as { userId: string };

      // Find user with this refresh token
      const user = await this.userRepository.findOne({
        where: {
          id: decoded.userId,
          refreshToken,
        },
      });

      if (!user) {
        throw new Error("Invalid refresh token");
      }

      // Generate new tokens
      const tokens = this.generateTokens(user);

      // Update refresh token in database
      user.refreshToken = tokens.refreshToken;
      await this.userRepository.save(user);

      return tokens;
    } catch (error) {
      throw new Error("Invalid refresh token");
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
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const expiresIn = this.accessTokenExpiry as SignOptions["expiresIn"];

    const accessToken = jwt.sign(
      payload,
      this.jwtSecret as jwt.Secret,
      { expiresIn } // "1h"
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      this.refreshSecret as jwt.Secret,
      { expiresIn } // "7d"
    );

    return { accessToken, refreshToken };
  }

  /**
   * Validate a JWT token and return the payload
   */
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
        "saveCount"
      ]
    });

    if (user) {
      // Don't return sensitive information
      delete (user as any).passwordHash;
      delete user.refreshToken;
    }

    return user;
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId: string, userData: Partial<User>): Promise<User | null> {
    // Exclude sensitive fields from updates
    delete userData.passwordHash;
    delete userData.refreshToken;
    delete userData.role; // Role should be updated through admin functions
    delete userData.id;
    delete userData.email; // Email changes should have their own flow with verification

    await this.userRepository.update(userId, userData);
    return this.getUserProfile(userId);
  }

  /**
   * Change user password
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ["id", "passwordHash"],
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
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
