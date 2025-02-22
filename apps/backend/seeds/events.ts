import { Event, EventStatus } from "../entities/Event";
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

const SAMPLE_EVENTS = [
  {
    title: "Community BBQ in the Park",
    description: "Join us for a neighborhood BBQ with games and activities for all ages",
    categories: ["Community Events", "Food & Dining"],
  },
  {
    title: "Local Art Gallery Opening",
    description: "Featuring works from emerging local artists with wine and cheese reception",
    categories: ["Entertainment", "Community Events"],
  },
  {
    title: "Downtown Farmers Market",
    description: "Fresh local produce, crafts, and live music",
    categories: ["Shopping", "Food & Dining", "Community Events"],
  },
  {
    title: "Tech Meetup: Web Development",
    description: "Learn about the latest web development trends and network with local developers",
    categories: ["Education", "Community Events"],
  },
  {
    title: "Live Jazz Night",
    description: "Evening of jazz music featuring local musicians",
    categories: ["Entertainment"],
  },
  {
    title: "Food Truck Festival",
    description: "Various food trucks offering diverse cuisine options",
    categories: ["Food & Dining", "Community Events"],
  },
  {
    title: "Morning Yoga in the Park",
    description: "Start your day with outdoor yoga suitable for all levels",
    categories: ["Sports & Recreation", "Community Events"],
  },
  {
    title: "Street Art Festival",
    description: "Watch local artists create murals and street art live",
    categories: ["Entertainment", "Community Events"],
  },
  {
    title: "Book Club Meeting",
    description: "Monthly book discussion group at the local library",
    categories: ["Education", "Community Events"],
  },
  {
    title: "Amateur Sports Tournament",
    description: "Local sports competition open to all skill levels",
    categories: ["Sports & Recreation"],
  },
];

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

function randomStatus(): EventStatus {
  const statuses = [EventStatus.PENDING, EventStatus.VERIFIED, EventStatus.REJECTED];
  return randomFromArray(statuses);
}

export async function seedEvents(dataSource: DataSource, count: number = 50) {
  const eventRepository = dataSource.getRepository(Event);
  const categoryRepository = dataSource.getRepository(Category);

  const allCategories = await categoryRepository.find();
  const categoryMap = new Map(allCategories.map((cat) => [cat.name, cat]));

  for (let i = 0; i < count; i++) {
    const sampleEvent = randomFromArray(SAMPLE_EVENTS);

    // Get the actual Category entities based on the category names
    const eventCategories = sampleEvent.categories
      .map((catName) => categoryMap.get(catName))
      .filter((cat): cat is Category => cat !== undefined);

    const event = eventRepository.create({
      title: sampleEvent.title,
      description: sampleEvent.description,
      eventDate: randomFutureDate(),
      location: randomLocation(),
      status: randomStatus(),
      scanCount: Math.floor(Math.random() * 10) + 1,
      confidenceScore: Math.random() * 0.5 + 0.5, // Random score between 0.5 and 1.0
      categories: eventCategories,
    });

    await eventRepository.save(event);
  }
}
