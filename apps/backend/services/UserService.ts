import AppDataSource from "../data-source";
import { User, UserRole } from "../entities/User";
import { Repository, MoreThanOrEqual } from "typeorm";
import type { EmailService } from "./shared/EmailService";
import bcrypt from "bcrypt";

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
      queryBuilder.andWhere("(user.email ILIKE :search)", {
        search: `%${search}%`,
      });
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
        "user.avatarUrl",
        "user.role",
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
        "avatarUrl",
        "bio",
        "role",
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
      select: ["id", "email", "avatarUrl", "role", "createdAt"],
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
    },
    addedBy?: string,
  ): Promise<User> {
    const { email, password } = params;

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: [{ email }],
    });

    if (existingUser) {
      throw new Error("User with this email already exists");
    }

    // Create new admin user
    const newAdmin = this.userRepository.create({
      email,
      passwordHash: await this.hashPassword(password),
      role: UserRole.ADMIN,
      isVerified: true,
    });

    const savedUser = await this.userRepository.save(newAdmin);

    // Log admin creation
    console.log(
      `Admin user created: ${savedUser.email} by ${addedBy || "system"}`,
    );

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

  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }
}
