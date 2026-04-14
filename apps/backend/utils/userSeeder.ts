import { DataSource } from "typeorm";
import { User, UserRole } from "../entities";
import bcrypt from "bcryptjs";

export interface SeededUser {
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  role: UserRole;
  isVerified: boolean;
}

export const SEEDED_USERS: Omit<SeededUser, "passwordHash">[] = [
  {
    email: "user@example.com",
    firstName: "Alex",
    lastName: "Explorer",
    role: UserRole.USER,
    isVerified: true,
  },
  {
    email: "moderator@example.com",
    firstName: "Morgan",
    lastName: "Mod",
    role: UserRole.MODERATOR,
    isVerified: true,
  },
  {
    email: "admin@example.com",
    firstName: "Sam",
    lastName: "Admin",
    role: UserRole.ADMIN,
    isVerified: true,
  },
  {
    email: "scout@example.com",
    firstName: "Jamie",
    lastName: "Scout",
    role: UserRole.USER,
    isVerified: true,
  },
  {
    email: "curator@example.com",
    firstName: "Riley",
    lastName: "Curator",
    role: UserRole.USER,
    isVerified: true,
  },
];

export const SEEDED_PASSWORDS: Record<string, string> = {
  "user@example.com": "user123",
  "moderator@example.com": "moderator123",
  "admin@example.com": "admin123",
  "scout@example.com": "scout123",
  "curator@example.com": "curator123",
};

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
    console.log(`✓ Created ${savedUser.email} (${savedUser.role})`);
  }

  console.log("\nDevelopment user seeding completed!");
  console.log("\nLogin credentials:");
  Object.entries(SEEDED_PASSWORDS).forEach(([email, password]) => {
    console.log(`${email}: ${email} / ${password}`);
  });
}
