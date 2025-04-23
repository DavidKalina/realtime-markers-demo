// src/seed/seedUsers.ts

import { DataSource } from "typeorm";
import { User, UserRole } from "../entities/User";
import * as bcrypt from "bcrypt";

// Helper function to generate a unique friend code
const generateFriendCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export async function seedUsers(dataSource: DataSource): Promise<void> {
  const userRepository = dataSource.getRepository(User);

  // Check if users already exist to avoid duplicates
  const existingCount = await userRepository.count();
  if (existingCount > 0) {
    console.log(`Database already has ${existingCount} users. Skipping user seeding.`);
    return;
  }

  console.log("Seeding test users...");

  // Create test users
  const testUsers = [
    {
      email: "david@example.com",
      password: "password123!",
      displayName: "David K",
      username: "davidk",
      friendCode: "DAVID1",
      bio: "System administrator",
      role: UserRole.ADMIN,
      isVerified: true,
      discoveryCount: 0,
      saveCount: 0,
      scanCount: 0,
    },
    {
      email: "josh@example.com",
      password: "password123!",
      displayName: "Josh K",
      username: "joshk",
      friendCode: "JOSH01",
      bio: "System administrator",
      role: UserRole.USER,
      isVerified: true,
      discoveryCount: 0,
      saveCount: 0,
      scanCount: 0,
    },
    {
      email: "james@example.com",
      password: "password123!",
      displayName: "James H.",
      username: "jamesh",
      friendCode: "JAMES1",
      bio: "Content moderator",
      role: UserRole.ADMIN,
      isVerified: true,
      discoveryCount: 0,
      saveCount: 0,
      scanCount: 0,
    },
    {
      email: "jared@example.com",
      password: "password123!",
      displayName: "Jared B.",
      username: "jaredb",
      friendCode: "JARED1",
      bio: "Regular user account",
      role: UserRole.ADMIN,
      isVerified: true,
      discoveryCount: 0,
      saveCount: 0,
      scanCount: 0,
    },
  ];

  // Hash passwords and create user entities
  const saltRounds = 10;
  const userEntities = await Promise.all(
    testUsers.map(async (userData) => {
      const passwordHash = await bcrypt.hash(userData.password, saltRounds);

      const user = new User();
      user.email = userData.email;
      user.passwordHash = passwordHash;
      user.displayName = userData.displayName;
      user.username = userData.username;
      user.friendCode = userData.friendCode;
      user.bio = userData.bio;
      user.role = userData.role;
      user.isVerified = userData.isVerified;
      user.discoveryCount = userData.discoveryCount;
      user.saveCount = userData.saveCount;
      user.scanCount = userData.scanCount;

      return user;
    })
  );

  // Save all users to the database
  await userRepository.save(userEntities);
  console.log(`✅ Successfully seeded ${userEntities.length} test users`);
}
