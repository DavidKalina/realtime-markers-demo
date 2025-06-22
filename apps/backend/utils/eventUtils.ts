import type { Context } from "hono";
import type { AppContext } from "../types/context";
import { Buffer } from "buffer";
import type { CategoryProcessingService } from "../services/CategoryProcessingService";
import type { StorageService } from "../services/shared/StorageService";
import type { IEmbeddingService } from "../services/event-processing/interfaces/IEmbeddingService";
import { RecurrenceFrequency, DayOfWeek } from "../entities/Event";
import type { CreateEventInput } from "../types/event";

// Extended type for internal processing that includes categories
export interface EventDataWithCategories extends Partial<CreateEventInput> {
  categories?: Array<{ id: string; name: string }>;
}

/**
 * Process form data and extract event data from both multipart/form-data and JSON requests
 */
export async function processEventFormData(
  c: Context<AppContext>,
  storageService: StorageService,
  user: { userId?: string; email: string; role: string },
): Promise<{
  data: EventDataWithCategories;
  originalImageUrl: string | null;
}> {
  const contentType = c.req.header("content-type") || "";
  let data: EventDataWithCategories;
  let originalImageUrl: string | null = null;

  if (contentType.includes("multipart/form-data")) {
    console.log("[processEventFormData] Processing as FormData");
    const formData = await c.req.formData();
    const imageEntry = formData.get("image");

    console.log(
      "[processEventFormData] FormData keys:",
      Array.from(formData.keys()),
    );
    console.log(
      "[processEventFormData] Image entry:",
      imageEntry ? "present" : "not present",
    );

    // Upload image if provided
    if (imageEntry && typeof imageEntry !== "string") {
      const file = imageEntry as File;

      // Validate file type
      const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
      if (!allowedTypes.includes(file.type)) {
        throw new Error(
          "Invalid file type. Only JPEG and PNG files are allowed",
        );
      }

      // Convert file to buffer and upload
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      originalImageUrl = await storageService.uploadImage(
        buffer,
        "event-images",
        {
          filename: file.name,
          contentType: file.type,
          size: buffer.length.toString(),
          uploadedBy: user?.userId || "unknown",
        },
      );
    }

    // Parse other form data
    const eventData = formData.get("eventData");
    if (eventData && typeof eventData === "string") {
      try {
        data = JSON.parse(eventData);
      } catch (error) {
        throw new Error("Invalid event data format");
      }
    } else {
      // Extract individual fields from form data
      data = {
        title: formData.get("title")?.toString() || "",
        description: formData.get("description")?.toString(),
        eventDate: formData.get("eventDate")?.toString()
          ? new Date(formData.get("eventDate")!.toString())
          : undefined,
        endDate: formData.get("endDate")?.toString()
          ? new Date(formData.get("endDate")!.toString())
          : undefined,
        emoji: formData.get("emoji")?.toString() || "📍",
        emojiDescription: formData.get("emojiDescription")?.toString(),
        address: formData.get("address")?.toString(),
        locationNotes: formData.get("locationNotes")?.toString(),
        isPrivate: formData.get("isPrivate") === "true",
        sharedWithIds: formData.get("sharedWithIds")
          ? (formData.get("sharedWithIds") as string).split(",")
          : [],
        // QR code related fields
        qrUrl: formData.get("qrUrl")?.toString(),
        // Extract recurring event fields
        isRecurring: formData.get("isRecurring") === "true",
        recurrenceFrequency: formData.get("recurrenceFrequency")?.toString() as
          | RecurrenceFrequency
          | undefined,
        recurrenceTime: formData.get("recurrenceTime")?.toString(),
        recurrenceInterval: formData.get("recurrenceInterval")
          ? parseInt(formData.get("recurrenceInterval")!.toString())
          : undefined,
        recurrenceStartDate: formData.get("recurrenceStartDate")?.toString()
          ? new Date(formData.get("recurrenceStartDate")!.toString())
          : undefined,
        recurrenceEndDate: formData.get("recurrenceEndDate")?.toString()
          ? new Date(formData.get("recurrenceEndDate")!.toString())
          : undefined,
      };

      // Handle recurrence days (JSON array)
      const recurrenceDays = formData.get("recurrenceDays");
      if (recurrenceDays && typeof recurrenceDays === "string") {
        try {
          data.recurrenceDays = JSON.parse(recurrenceDays) as DayOfWeek[];
        } catch (error) {
          console.error("Error parsing recurrence days:", error);
        }
      }

      // Handle location coordinates
      const lat = formData.get("lat");
      const lng = formData.get("lng");
      if (lat && lng) {
        data.location = {
          type: "Point",
          coordinates: [parseFloat(lat.toString()), parseFloat(lng.toString())],
        };
      }

      // Handle categories
      const categories = formData.get("categories");
      if (categories && typeof categories === "string") {
        try {
          data.categories = JSON.parse(categories);
        } catch (error) {
          // If not JSON, treat as comma-separated category IDs
          data.categoryIds = categories.split(",");
        }
      }
    }
  } else {
    console.log("[processEventFormData] Processing as JSON");
    // Handle JSON data (existing behavior)
    data = await c.req.json();
  }

  return { data, originalImageUrl };
}

/**
 * Validate event data for required fields and proper format
 */
export function validateEventData(data: EventDataWithCategories): void {
  if (!data.title || !data.eventDate || !data.location?.coordinates) {
    throw new Error(
      "Missing required fields: title, eventDate, and location coordinates",
    );
  }

  // Ensure location is in GeoJSON format
  if (data.location && !data.location.type) {
    data.location = {
      type: "Point",
      coordinates: data.location.coordinates,
    };
  }
}

/**
 * Process categories - generate automatically if not provided
 */
export async function processCategories(
  data: EventDataWithCategories,
  categoryProcessingService: CategoryProcessingService | undefined,
): Promise<EventDataWithCategories> {
  // Automatically generate categories if not provided
  if (!data.categories || data.categories.length === 0) {
    // Use title and description for category extraction
    const text = `${data.title}\n${data.description || ""}`;
    if (categoryProcessingService) {
      const processedCategories =
        await categoryProcessingService.extractAndProcessCategories(text);
      // Convert Category objects to categoryIds for the service
      data.categoryIds = processedCategories.map((cat) => cat.id);
      // Also keep the full categories for embedding generation
      data.categories = processedCategories;
    }
  } else {
    // If categories are provided, convert them to categoryIds
    data.categoryIds = data.categories.map((cat: { id: string } | string) =>
      typeof cat === "string" ? cat : cat.id,
    );
  }

  return data;
}

/**
 * Generate embedding for event search functionality
 */
export async function generateEmbedding(
  data: EventDataWithCategories,
  embeddingService: IEmbeddingService,
): Promise<EventDataWithCategories> {
  if (!data.embedding) {
    console.log(
      "[generateEmbedding] Generating embedding for event:",
      data.title,
    );

    // Create text for embedding using the same format as EventProcessingService
    const textForEmbedding = `
      TITLE: ${data.title} ${data.title} ${data.title}
      EMOJI: ${data.emoji || "📍"} - ${data.emojiDescription || ""}
      CATEGORIES: ${data.categories?.map((c: { name: string }) => c.name).join(", ") || ""}
      DESCRIPTION: ${data.description || ""}
      LOCATION: ${data.address || ""}
      LOCATION_NOTES: ${data.locationNotes || ""}
    `.trim();

    try {
      data.embedding = await embeddingService.getEmbedding(textForEmbedding);
      console.log("[generateEmbedding] Generated embedding successfully");
    } catch (embeddingError) {
      console.error(
        "[generateEmbedding] Error generating embedding:",
        embeddingError,
      );
      // Continue without embedding - the event can still be created
      data.embedding = [];
    }
  }

  return data;
}

/**
 * Prepare the final CreateEventInput from processed data
 */
export function prepareCreateEventInput(
  data: EventDataWithCategories,
  user: { userId?: string; email: string; role: string },
  originalImageUrl: string | null,
): CreateEventInput {
  if (!user.userId) {
    throw new Error("User ID is required");
  }

  return {
    emoji: data.emoji || "📍",
    emojiDescription: data.emojiDescription,
    title: data.title!,
    description: data.description,
    eventDate:
      typeof data.eventDate === "string"
        ? new Date(data.eventDate)
        : data.eventDate!,
    endDate: data.endDate
      ? typeof data.endDate === "string"
        ? new Date(data.endDate)
        : data.endDate
      : undefined,
    location: data.location!,
    categoryIds: data.categoryIds,
    confidenceScore: data.confidenceScore,
    address: data.address,
    locationNotes: data.locationNotes,
    creatorId: user.userId,
    timezone: data.timezone,
    qrDetectedInImage: data.qrDetectedInImage,
    detectedQrData: data.detectedQrData,
    originalImageUrl: originalImageUrl || data.originalImageUrl,
    embedding: data.embedding || [],
    isPrivate: data.isPrivate,
    isOfficial: user.role === "ADMIN",
    sharedWithIds: data.sharedWithIds,
    // QR code related fields
    qrUrl: data.qrUrl,
    isRecurring: data.isRecurring,
    recurrenceFrequency: data.recurrenceFrequency as
      | RecurrenceFrequency
      | undefined,
    recurrenceDays: data.recurrenceDays as DayOfWeek[] | undefined,
    recurrenceTime: data.recurrenceTime,
    recurrenceStartDate: data.recurrenceStartDate,
    recurrenceEndDate: data.recurrenceEndDate,
    recurrenceInterval: data.recurrenceInterval,
  };
}

/**
 * Process form data for event updates and extract event data from both multipart/form-data and JSON requests
 */
export async function processEventUpdateFormData(
  c: Context<AppContext>,
  storageService: StorageService,
  user: { userId?: string; email: string; role: string },
  eventId: string,
): Promise<{
  data: Partial<EventDataWithCategories>;
  originalImageUrl: string | null;
}> {
  const contentType = c.req.header("content-type") || "";
  let data: Partial<EventDataWithCategories>;
  let originalImageUrl: string | null = null;

  if (contentType.includes("multipart/form-data")) {
    console.log("[processEventUpdateFormData] Processing as FormData");
    const formData = await c.req.formData();
    const imageEntry = formData.get("image");

    console.log(
      "[processEventUpdateFormData] FormData keys:",
      Array.from(formData.keys()),
    );
    console.log(
      "[processEventUpdateFormData] Image entry:",
      imageEntry ? "present" : "not present",
    );

    // Upload image if provided
    if (imageEntry && typeof imageEntry !== "string") {
      const file = imageEntry as File;

      // Validate file type
      const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
      if (!allowedTypes.includes(file.type)) {
        throw new Error(
          "Invalid file type. Only JPEG and PNG files are allowed",
        );
      }

      // Convert file to buffer and upload
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      originalImageUrl = await storageService.uploadImage(
        buffer,
        "event-images",
        {
          filename: file.name,
          contentType: file.type,
          size: buffer.length.toString(),
          uploadedBy: user?.userId || "unknown",
          eventId: eventId,
        },
      );
    }

    // Parse other form data
    const eventData = formData.get("eventData");
    if (eventData && typeof eventData === "string") {
      try {
        data = JSON.parse(eventData);
      } catch (error) {
        throw new Error("Invalid event data format");
      }
    } else {
      // Extract individual fields from form data
      data = {
        title: formData.get("title")?.toString(),
        description: formData.get("description")?.toString(),
        eventDate: formData.get("eventDate")?.toString()
          ? new Date(formData.get("eventDate")!.toString())
          : undefined,
        endDate: formData.get("endDate")?.toString()
          ? new Date(formData.get("endDate")!.toString())
          : undefined,
        emoji: formData.get("emoji")?.toString(),
        emojiDescription: formData.get("emojiDescription")?.toString(),
        address: formData.get("address")?.toString(),
        locationNotes: formData.get("locationNotes")?.toString(),
        isPrivate: formData.get("isPrivate") === "true",
        sharedWithIds: formData.get("sharedWithIds")
          ? (formData.get("sharedWithIds") as string).split(",")
          : [],
        // QR code related fields
        qrUrl: formData.get("qrUrl")?.toString(),
        // Extract recurring event fields
        isRecurring: formData.get("isRecurring") === "true",
        recurrenceFrequency: formData.get("recurrenceFrequency")?.toString() as
          | RecurrenceFrequency
          | undefined,
        recurrenceTime: formData.get("recurrenceTime")?.toString(),
        recurrenceInterval: formData.get("recurrenceInterval")
          ? parseInt(formData.get("recurrenceInterval")!.toString())
          : undefined,
        recurrenceStartDate: formData.get("recurrenceStartDate")?.toString()
          ? new Date(formData.get("recurrenceStartDate")!.toString())
          : undefined,
        recurrenceEndDate: formData.get("recurrenceEndDate")?.toString()
          ? new Date(formData.get("recurrenceEndDate")!.toString())
          : undefined,
      };

      // Handle recurrence days (JSON array)
      const recurrenceDays = formData.get("recurrenceDays");
      if (recurrenceDays && typeof recurrenceDays === "string") {
        try {
          data.recurrenceDays = JSON.parse(recurrenceDays) as DayOfWeek[];
        } catch (error) {
          console.error("Error parsing recurrence days:", error);
        }
      }

      // Handle location coordinates
      const lat = formData.get("lat");
      const lng = formData.get("lng");
      if (lat && lng) {
        data.location = {
          type: "Point",
          coordinates: [parseFloat(lat.toString()), parseFloat(lng.toString())],
        };
      }

      // Handle categories
      const categories = formData.get("categories");
      if (categories && typeof categories === "string") {
        try {
          data.categories = JSON.parse(categories);
        } catch (error) {
          // If not JSON, treat as comma-separated category IDs
          data.categoryIds = categories.split(",");
        }
      }
    }
  } else {
    console.log("[processEventUpdateFormData] Processing as JSON");
    // Handle JSON data (existing behavior)
    data = await c.req.json();
  }

  return { data, originalImageUrl };
}

/**
 * Prepare update data by processing categories and generating embeddings if needed
 */
export async function prepareUpdateData(
  data: Partial<EventDataWithCategories>,
  categoryProcessingService: CategoryProcessingService | undefined,
  embeddingService: IEmbeddingService,
): Promise<Partial<EventDataWithCategories>> {
  const processedData = { ...data };

  // Process categories if provided
  if (data.categories && data.categories.length > 0) {
    // Convert categories to categoryIds
    processedData.categoryIds = data.categories.map(
      (cat: { id: string } | string) =>
        typeof cat === "string" ? cat : cat.id,
    );
  }

  // Generate embedding if title or description changed
  if (data.title || data.description) {
    console.log(
      "[prepareUpdateData] Generating embedding for updated event:",
      data.title,
    );

    // Create text for embedding using the same format as EventProcessingService
    const textForEmbedding = `
      TITLE: ${data.title || ""} ${data.title || ""} ${data.title || ""}
      EMOJI: ${data.emoji || "📍"} - ${data.emojiDescription || ""}
      CATEGORIES: ${data.categories?.map((c: { name: string }) => c.name).join(", ") || ""}
      DESCRIPTION: ${data.description || ""}
      LOCATION: ${data.address || ""}
      LOCATION_NOTES: ${data.locationNotes || ""}
    `.trim();

    try {
      processedData.embedding =
        await embeddingService.getEmbedding(textForEmbedding);
      console.log("[prepareUpdateData] Generated embedding successfully");
    } catch (embeddingError) {
      console.error(
        "[prepareUpdateData] Error generating embedding:",
        embeddingError,
      );
      // Continue without embedding - the event can still be updated
      processedData.embedding = [];
    }
  }

  // Ensure location is in GeoJSON format if provided
  if (processedData.location && !processedData.location.type) {
    processedData.location = {
      type: "Point",
      coordinates: processedData.location.coordinates,
    };
  }

  // Convert string dates to Date objects if needed
  if (processedData.eventDate && typeof processedData.eventDate === "string") {
    processedData.eventDate = new Date(processedData.eventDate);
  }
  if (processedData.endDate && typeof processedData.endDate === "string") {
    processedData.endDate = new Date(processedData.endDate);
  }

  return processedData;
}
