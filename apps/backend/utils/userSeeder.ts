import { DataSource } from "typeorm";
import { User, UserRole, PlanType } from "../entities/User";
import bcrypt from "bcrypt";

export interface SeededUser {
  email: string;
  username: string;
  friendCode: string;
  passwordHash: string;
  displayName: string;
  role: UserRole;
  planType: PlanType;
  isVerified: boolean;
}

export const SEEDED_USERS: Omit<SeededUser, "passwordHash">[] = [
  {
    email: "user@example.com",
    username: "regularuser",
    friendCode: "USER001",
    displayName: "Regular User",
    role: UserRole.USER,
    planType: PlanType.FREE,
    isVerified: true,
  },
  {
    email: "moderator@example.com",
    username: "moderator",
    friendCode: "MOD001",
    displayName: "Moderator User",
    role: UserRole.MODERATOR,
    planType: PlanType.PRO,
    isVerified: true,
  },
  {
    email: "admin@example.com",
    username: "admin",
    friendCode: "ADMIN001",
    displayName: "Admin User",
    role: UserRole.ADMIN,
    planType: PlanType.PRO,
    isVerified: true,
  },
];

export const SEEDED_PASSWORDS = {
  "user@example.com": "user123",
  "moderator@example.com": "moderator123",
  "admin@example.com": "admin123",
} as const;

export async function seedUsers(dataSource: DataSource): Promise<void> {
  const userRepository = dataSource.getRepository(User);

  // Check if users already exist
  const existingUsers = await userRepository.find({
    where: SEEDED_USERS.map((user) => ({ email: user.email })),
  });

  if (existingUsers.length > 0) {
    console.log("Development users already exist. Skipping seeding.");
    existingUsers.forEach((user) => {
      console.log(`- ${user.email} (${user.role}) already exists`);
    });
    return;
  }

  // Hash passwords
  const saltRounds = 10;
  const usersWithHashedPasswords: SeededUser[] = await Promise.all(
    SEEDED_USERS.map(async (user) => ({
      ...user,
      passwordHash: await bcrypt.hash(
        SEEDED_PASSWORDS[user.email as keyof typeof SEEDED_PASSWORDS],
        saltRounds,
      ),
    })),
  );

  console.log("Seeding development users...");
  for (const userData of usersWithHashedPasswords) {
    const user = userRepository.create(userData);
    const savedUser = await userRepository.save(user);
    console.log(
      `✓ Created ${savedUser.displayName} (${savedUser.role}) - ${savedUser.email}`,
    );
  }

  console.log("\nDevelopment user seeding completed!");
  console.log("\nLogin credentials:");
  Object.entries(SEEDED_PASSWORDS).forEach(([email, password]) => {
    const user = SEEDED_USERS.find((u) => u.email === email);
    console.log(`${user?.displayName}: ${email} / ${password}`);
  });
}
