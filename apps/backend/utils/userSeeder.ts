import { DataSource } from "typeorm";
import { User, UserRole } from "@realtime-markers/database";
import bcrypt from "bcrypt";

export interface SeededUser {
  email: string;
  passwordHash: string;
  role: UserRole;
  isVerified: boolean;
}

export const SEEDED_USERS: Omit<SeededUser, "passwordHash">[] = [
  {
    email: "user@example.com",
    role: UserRole.USER,
    isVerified: true,
  },
  {
    email: "moderator@example.com",
    role: UserRole.MODERATOR,
    isVerified: true,
  },
  {
    email: "admin@example.com",
    role: UserRole.ADMIN,
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
  const parsed = parseInt(process.env.BCRYPT_ROUNDS || "", 10);
  const isProd = (process.env.NODE_ENV || "development") === "production";
  let saltRounds = Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
  if (isProd && saltRounds < 12) {
    saltRounds = 12;
  }
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
    console.log(`✓ Created ${savedUser.email} (${savedUser.role})`);
  }

  console.log("\nDevelopment user seeding completed!");
  console.log("\nLogin credentials:");
  Object.entries(SEEDED_PASSWORDS).forEach(([email, password]) => {
    console.log(`${email}: ${email} / ${password}`);
  });
}
