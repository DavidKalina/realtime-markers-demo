import { Marker } from "../entities/Marker";
import { Category } from "../entities/Category";
import { DataSource } from "typeorm";
import { type Point } from "geojson";

// Provo/Orem area boundaries
const BOUNDS = {
  north: 40.3136,
  south: 40.2102,
  east: -111.6133,
  west: -111.7478,
};

const SAMPLE_TITLES = [
  "Community BBQ",
  "Art Gallery Opening",
  "Farmers Market",
  "Tech Meetup",
  "Live Music Night",
  "Food Truck Rally",
  "Yoga in the Park",
  "Street Festival",
  "Book Club Meeting",
  "Sports Tournament",
];

const EMOJIS = ["🎉", "🎨", "🍔", "💻", "🎵", "🌟", "🎭", "🏃", "📚", "⚽"];
const COLORS = ["#FF5733", "#33FF57", "#3357FF", "#FF33F6", "#33FFF6", "#F6FF33"];

function randomFromArray<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomLocation(): Point {
  const lat = BOUNDS.south + Math.random() * (BOUNDS.north - BOUNDS.south);
  const lng = BOUNDS.west + Math.random() * (BOUNDS.east - BOUNDS.west);

  return {
    type: "Point",
    coordinates: [lng, lat],
  };
}

function randomFutureDate(): Date {
  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(now.getDate() + Math.floor(Math.random() * 30));
  return futureDate;
}

export async function seedMarkers(dataSource: DataSource, count: number = 50) {
  const markerRepository = dataSource.getRepository(Marker);
  const categoryRepository = dataSource.getRepository(Category);

  const allCategories = await categoryRepository.find();

  for (let i = 0; i < count; i++) {
    const marker = markerRepository.create({
      location: randomLocation(),
      title: randomFromArray(SAMPLE_TITLES),
      description: "Sample event description",
      eventDate: randomFutureDate(),
      eventLocation: "Provo/Orem Area",
      contactInfo: "contact@example.com",
      emoji: randomFromArray(EMOJIS),
      color: randomFromArray(COLORS),
      isVerified: Math.random() > 0.5,
      categories: [randomFromArray(allCategories), randomFromArray(allCategories)],
    });

    await markerRepository.save(marker);
  }
}
