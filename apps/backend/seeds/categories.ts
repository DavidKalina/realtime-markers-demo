import { Category } from "../entities/Category";
import { DataSource } from "typeorm";

export const categories = [
  {
    name: "Community Events",
    description: "Local gatherings and community activities",
    icon: "🎉",
  },
  {
    name: "Food & Dining",
    description: "Restaurants, food trucks, and dining experiences",
    icon: "🍽️",
  },
  {
    name: "Education",
    description: "Schools, workshops, and learning opportunities",
    icon: "📚",
  },
  {
    name: "Entertainment",
    description: "Concerts, shows, and entertainment venues",
    icon: "🎭",
  },
  {
    name: "Sports & Recreation",
    description: "Athletic events and outdoor activities",
    icon: "⚽",
  },
  {
    name: "Shopping",
    description: "Retail stores and shopping centers",
    icon: "🛍️",
  },
] as const;

export async function seedCategories(dataSource: DataSource) {
  const categoryRepository = dataSource.getRepository(Category);

  // Create all categories in a single transaction
  await dataSource.transaction(async (transactionalEntityManager) => {
    for (const categoryData of categories) {
      const existingCategory = await transactionalEntityManager.findOne(Category, {
        where: { name: categoryData.name },
      });

      if (!existingCategory) {
        const category = categoryRepository.create(categoryData);
        await transactionalEntityManager.save(category);
      }
    }
  });
}
