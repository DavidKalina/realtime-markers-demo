// src/seed/seedUsers.ts

import { DataSource } from "typeorm";
import { User, UserRole } from "../entities/User";
import * as bcrypt from "bcrypt";

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
      bio: "System administrator",
      role: UserRole.ADMIN,
      isVerified: true,
    },
    {
      email: "josh@example.com",
      password: "password123!",
      displayName: "Josh K",
      bio: "System administrator",
      role: UserRole.ADMIN,
      isVerified: true,
    },
    {
      email: "james@example.com",
      password: "password123!",
      displayName: "James H.",
      bio: "Content moderator",
      role: UserRole.MODERATOR,
      isVerified: true,
    },
    {
      email: "jared@example.com",
      password: "password123!",
      displayName: "Jared B.",
      bio: "Regular user account",
      role: UserRole.USER,
      isVerified: true,
    },
    {
      email: "garrett@example.com",
      password: "password123!",
      displayName: "Garret L.",
      bio: "Another regular user",
      role: UserRole.USER,
      isVerified: true,
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
      user.bio = userData.bio;
      user.role = userData.role;
      user.isVerified = userData.isVerified;
      user.discoveryCount = Math.floor(Math.random() * 10);
      user.scanCount = Math.floor(Math.random() * 20);

      return user;
    })
  );

  // Save all users to the database
  await userRepository.save(userEntities);
  console.log(`✅ Successfully seeded ${userEntities.length} test users`);
}
