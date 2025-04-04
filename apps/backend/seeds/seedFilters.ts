import { DataSource } from "typeorm";
import { User } from "../entities/User";
import { Filter } from "../entities/Filter";

export async function seedDefaultFilters(dataSource: DataSource): Promise<void> {
  const userRepository = dataSource.getRepository(User);
  const filterRepository = dataSource.getRepository(Filter);

  console.log("Adding default filters for existing users...");

  // Get all users
  const users = await userRepository.find();

  // Create default filters for each user
  for (const user of users) {
    // Check if user already has any filters
    const existingFilters = await filterRepository.count({ where: { userId: user.id } });

    if (existingFilters === 0) {
      // Create a two-week filter starting from user's creation date
      const userCreationDate = user.createdAt || new Date();
      const twoWeeksFromCreation = new Date(userCreationDate);
      twoWeeksFromCreation.setDate(userCreationDate.getDate() + 14);

      const defaultFilter = filterRepository.create({
        userId: user.id,
        name: "First Two Weeks",
        isActive: true,
        semanticQuery: "Show me everything in my first two weeks",
        emoji: "🎯",
        criteria: {
          dateRange: {
            start: userCreationDate.toISOString(),
            end: twoWeeksFromCreation.toISOString(),
          },
        },
      });

      await filterRepository.save(defaultFilter);
      console.log(`✅ Created default filter for user: ${user.email}`);
    } else {
      console.log(`Skipping user ${user.email} - already has filters`);
    }
  }

  const totalFiltersCreated = await filterRepository.count();
  console.log(
    `✅ Finished creating default filters. Total filters in system: ${totalFiltersCreated}`
  );
}
