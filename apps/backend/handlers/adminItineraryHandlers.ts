import type { Context } from "hono";
import type { AppContext } from "../types/context";
import AppDataSource from "../data-source";
import {
  Itinerary,
  ItineraryItem,
  ItineraryStatus,
  User,
} from "@realtime-markers/database";

interface CreateItineraryItemPayload {
  title: string;
  startTime: string;
  endTime: string;
  latitude: number;
  longitude: number;
  emoji?: string;
  description?: string;
  venueName?: string;
  venueCategory?: string;
  estimatedCost?: number;
}

interface CreateItineraryPayload {
  userId: string;
  title: string;
  city: string;
  plannedDate: string;
  durationHours: number;
  activate?: boolean;
  budgetMin?: number;
  budgetMax?: number;
  activityTypes?: string[];
  items: CreateItineraryItemPayload[];
}

export const adminCreateItineraryHandler = async (c: Context<AppContext>) => {
  try {
    const body = (await c.req.json()) as CreateItineraryPayload;

    const { userId, title, city, plannedDate, durationHours, activate, items } =
      body;

    if (!userId || !title || !city || !plannedDate || !durationHours) {
      return c.json(
        {
          error:
            "userId, title, city, plannedDate, and durationHours are required",
        },
        400,
      );
    }

    if (!items || items.length === 0) {
      return c.json({ error: "At least one item is required" }, 400);
    }

    // Verify user exists
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    // Create itinerary
    const itineraryRepo = AppDataSource.getRepository(Itinerary);
    const itinerary = itineraryRepo.create({
      userId,
      title,
      city,
      plannedDate,
      durationHours,
      budgetMin: body.budgetMin ?? 0,
      budgetMax: body.budgetMax ?? 0,
      activityTypes: body.activityTypes ?? [],
      status: ItineraryStatus.READY,
    });

    const savedItinerary = await itineraryRepo.save(itinerary);

    // Create itinerary items
    const itemRepo = AppDataSource.getRepository(ItineraryItem);
    const itineraryItems = items.map((item, index) =>
      itemRepo.create({
        itineraryId: savedItinerary.id,
        sortOrder: index + 1,
        title: item.title,
        startTime: item.startTime,
        endTime: item.endTime,
        latitude: item.latitude,
        longitude: item.longitude,
        emoji: item.emoji,
        description: item.description,
        venueName: item.venueName,
        venueCategory: item.venueCategory,
        estimatedCost: item.estimatedCost,
      }),
    );

    await itemRepo.save(itineraryItems);

    // Activate for user if requested
    if (activate) {
      await userRepo.update(userId, {
        activeItineraryId: savedItinerary.id,
      });
    }

    // Fetch the complete itinerary with items
    const result = await itineraryRepo.findOne({
      where: { id: savedItinerary.id },
      relations: ["items"],
    });

    return c.json(
      {
        success: true,
        itinerary: result,
        activated: !!activate,
      },
      201,
    );
  } catch (error) {
    console.error("Error creating admin itinerary:", error);
    return c.json(
      {
        error: "Failed to create itinerary",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};
