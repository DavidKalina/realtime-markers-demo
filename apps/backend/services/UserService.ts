import AppDataSource from "../data-source";
import { User, UserRole } from "../entities/User";
import { Repository, MoreThanOrEqual } from "typeorm";
import type { EmailService } from "./shared/EmailService";

export interface UserListParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole;
}

export interface UserListResponse {
  users: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UpdateUserRoleParams {
  userId: string;
  role: UserRole;
}

export class UserService {
  private userRepository: Repository<User>;
  private emailService?: EmailService;

  constructor(emailService?: EmailService) {
    this.userRepository = AppDataSource.getRepository(User);
    this.emailService = emailService;
  }

  async getUsers(params: UserListParams = {}): Promise<UserListResponse> {
    const { page = 1, limit = 20, search, role } = params;
    const offset = (page - 1) * limit;

    const queryBuilder = this.userRepository.createQueryBuilder("user");

    // Add search filter
    if (search) {
      queryBuilder.andWhere(
        "(user.email ILIKE :search OR user.displayName ILIKE :search OR user.username ILIKE :search)",
        { search: `%${search}%` },
      );
    }

    // Add role filter
    if (role) {
      queryBuilder.andWhere("user.role = :role", { role });
    }

    // Get total count
    const total = await queryBuilder.getCount();

    // Get users with pagination
    const users = await queryBuilder
      .select([
        "user.id",
        "user.email",
        "user.username",
        "user.displayName",
        "user.avatarUrl",
        "user.role",
        "user.planType",
        "user.isVerified",
        "user.discoveryCount",
        "user.scanCount",
        "user.saveCount",
        "user.viewCount",
        "user.totalXp",
        "user.currentTitle",
        "user.createdAt",
        "user.updatedAt",
      ])
      .orderBy("user.createdAt", "DESC")
      .skip(offset)
      .take(limit)
      .getMany();

    return {
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUserById(userId: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id: userId },
      select: [
        "id",
        "email",
        "username",
        "displayName",
        "avatarUrl",
        "bio",
        "role",
        "planType",
        "isVerified",
        "discoveryCount",
        "scanCount",
        "saveCount",
        "viewCount",
        "createdAt",
        "updatedAt",
      ],
    });
  }

  async updateUserRole(params: UpdateUserRoleParams): Promise<User> {
    const { userId, role } = params;

    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Prevent removing the last admin
    if (user.role === UserRole.ADMIN && role !== UserRole.ADMIN) {
      const adminCount = await this.userRepository.count({
        where: { role: UserRole.ADMIN },
      });

      if (adminCount <= 1) {
        throw new Error("Cannot remove the last admin user");
      }
    }

    user.role = role;
    return this.userRepository.save(user);
  }

  async getAdminUsers(): Promise<User[]> {
    return this.userRepository.find({
      where: { role: UserRole.ADMIN },
      select: [
        "id",
        "email",
        "username",
        "displayName",
        "avatarUrl",
        "role",
        "createdAt",
      ],
      order: { createdAt: "ASC" },
    });
  }

  async getAdminCount(): Promise<number> {
    return this.userRepository.count({
      where: { role: UserRole.ADMIN },
    });
  }

  async getUserStats(): Promise<{
    totalUsers: number;
    adminUsers: number;
    verifiedUsers: number;
    usersThisMonth: number;
  }> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalUsers, adminUsers, verifiedUsers, usersThisMonth] =
      await Promise.all([
        this.userRepository.count(),
        this.userRepository.count({ where: { role: UserRole.ADMIN } }),
        this.userRepository.count({ where: { isVerified: true } }),
        this.userRepository.count({
          where: { createdAt: MoreThanOrEqual(startOfMonth) },
        }),
      ]);

    return {
      totalUsers,
      adminUsers,
      verifiedUsers,
      usersThisMonth,
    };
  }

  async createAdminUser(
    params: {
      email: string;
      password: string;
      displayName?: string;
      username?: string;
    },
    addedBy?: string,
  ): Promise<User> {
    const { email, password, displayName, username } = params;

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: [{ email }, ...(username ? [{ username }] : [])],
    });

    if (existingUser) {
      throw new Error("User with this email or username already exists");
    }

    // Import bcrypt for password hashing
    const bcrypt = await import("bcrypt");
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Generate a unique friend code
    const friendCode = this.generateFriendCode();

    // Create the admin user
    const adminUser = this.userRepository.create({
      email,
      passwordHash,
      displayName: displayName || email.split("@")[0],
      username,
      friendCode,
      role: UserRole.ADMIN,
      isVerified: true, // Admin users are automatically verified
    });

    const savedUser = await this.userRepository.save(adminUser);

    // Send email notifications
    if (this.emailService) {
      try {
        // Send welcome email to the new admin
        await this.emailService.sendWelcomeEmail(
          email,
          savedUser.displayName || email.split("@")[0],
        );

        // Send notification to existing admins
        await this.emailService.sendAdminAddedNotification(
          email,
          savedUser.displayName || email.split("@")[0],
          addedBy || "System",
        );
      } catch (error) {
        console.error("Failed to send email notifications:", error);
        // Don't fail the user creation if email fails
      }
    }

    return savedUser;
  }

  async deleteAdminUser(adminId: string, currentUserId: string): Promise<void> {
    // Prevent self-deletion
    if (adminId === currentUserId) {
      throw new Error("Cannot delete your own admin account");
    }

    const adminUser = await this.userRepository.findOne({
      where: { id: adminId, role: UserRole.ADMIN },
    });

    if (!adminUser) {
      throw new Error("Admin user not found");
    }

    // Check if this is the last admin
    const adminCount = await this.userRepository.count({
      where: { role: UserRole.ADMIN },
    });

    if (adminCount <= 1) {
      throw new Error("Cannot delete the last admin user");
    }

    // Delete the admin user
    await this.userRepository.remove(adminUser);
  }

  private generateFriendCode(): string {
    // Generate a 6-character alphanumeric code
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}
