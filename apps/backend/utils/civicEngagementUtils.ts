import type { Context } from "hono";
import type { AppContext } from "../types/context";
import { Buffer } from "buffer";
import type { IEmbeddingService } from "../services/event-processing/interfaces/IEmbeddingService";
import type { StorageService } from "../services/shared/StorageService";
import type { CreateCivicEngagementInput } from "../types/civicEngagement";
import {
  CivicEngagementType,
  CivicEngagementStatus,
} from "@realtime-markers/database";

// Extended type for internal processing
export interface CivicEngagementDataWithEmbedding
  extends Partial<CreateCivicEngagementInput> {
  embedding?: number[];
}

// Extended type for internal processing that includes form data
export interface CivicEngagementDataWithFormData
  extends Partial<CreateCivicEngagementInput> {
  contentType?: string;
  filename?: string;
  imageBuffer?: string; // For base64 encoded images in JSON requests
  status?: CivicEngagementStatus;
  adminNotes?: string;
}

/**
 * Process form data and extract civic engagement data from both multipart/form-data and JSON requests
 */
export async function processCivicEngagementFormData(
  c: Context<AppContext>,
  storageService: StorageService,
  user: { userId?: string; email: string; role: string },
): Promise<{
  data: CivicEngagementDataWithFormData;
  imageUrls: string[];
}> {
  const contentType = c.req.header("content-type") || "";
  let data: CivicEngagementDataWithFormData;
  let imageUrls: string[] = [];

  if (contentType.includes("multipart/form-data")) {
    console.log("[processCivicEngagementFormData] Processing as FormData");
    const formData = await c.req.formData();
    const imageEntry = formData.get("image");

    console.log(
      "[processCivicEngagementFormData] FormData keys:",
      Array.from(formData.keys()),
    );
    console.log(
      "[processCivicEngagementFormData] Image entry:",
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

      const imageUrl = await storageService.uploadImage(
        buffer,
        "civic-engagement",
        {
          filename: file.name,
          contentType: file.type,
          size: buffer.length.toString(),
          uploadedBy: user?.userId || "unknown",
        },
      );

      if (imageUrl) {
        imageUrls = [imageUrl];
      }
    }

    // Parse other form data
    const civicEngagementData = formData.get("civicEngagementData");
    if (civicEngagementData && typeof civicEngagementData === "string") {
      try {
        data = JSON.parse(civicEngagementData);
      } catch (error) {
        throw new Error("Invalid civic engagement data format");
      }
    } else {
      // Extract individual fields from form data
      data = {
        title: formData.get("title")?.toString() || "",
        description: formData.get("description")?.toString(),
        type: formData.get("type")?.toString() as CivicEngagementType,
        address: formData.get("address")?.toString(),
        locationNotes: formData.get("locationNotes")?.toString(),
        status: formData.get("status")?.toString() as CivicEngagementStatus,
        adminNotes: formData.get("adminNotes")?.toString(),
      };

      // Handle location coordinates
      const lat = formData.get("lat");
      const lng = formData.get("lng");
      if (lat && lng) {
        data.location = {
          type: "Point",
          coordinates: [parseFloat(lat.toString()), parseFloat(lng.toString())],
        };
      }
    }
  } else {
    console.log("[processCivicEngagementFormData] Processing as JSON");
    // Handle JSON data (existing behavior)
    data = await c.req.json();

    // For JSON requests, we don't upload images synchronously
    // Instead, we pass the imageBuffer to the job for background processing
    // This prevents the API call from blocking on image upload
    if (data.imageBuffer) {
      console.log(
        "[processCivicEngagementFormData] Image buffer provided, will be processed in background job",
      );
      // Don't upload here - let the job handle it
      // Just ensure the data is properly structured
      if (!data.contentType) {
        data.contentType = "image/jpeg";
      }
      if (!data.filename) {
        data.filename = "civic-engagement.jpg";
      }
    }
  }

  return { data, imageUrls };
}

/**
 * Validate civic engagement data for required fields and proper format
 */
export function validateCivicEngagementData(
  data: CivicEngagementDataWithFormData,
): void {
  if (!data.title || !data.type) {
    throw new Error("Missing required fields: title and type are required");
  }

  // Ensure location is in GeoJSON format if provided
  if (data.location && !data.location.type) {
    data.location = {
      type: "Point",
      coordinates: data.location.coordinates,
    };
  }
}

/**
 * Prepare the final CreateCivicEngagementInput from processed data
 */
export function prepareCreateCivicEngagementInput(
  data: CivicEngagementDataWithFormData,
  user: { userId?: string; email: string; role: string },
  imageUrls: string[],
): CreateCivicEngagementInput {
  if (!user.userId) {
    throw new Error("User ID is required");
  }

  return {
    title: data.title!,
    description: data.description,
    type: data.type!,
    location: data.location,
    address: data.address,
    locationNotes: data.locationNotes,
    imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
    creatorId: user.userId,
  };
}

/**
 * Generate embedding for civic engagement search functionality
 */
export async function generateCivicEngagementEmbedding(
  data: CivicEngagementDataWithEmbedding,
  embeddingService: IEmbeddingService,
): Promise<CivicEngagementDataWithEmbedding> {
  if (!data.embedding) {
    console.log(
      "[generateCivicEngagementEmbedding] Generating embedding for civic engagement:",
      data.title,
    );

    // Create text for embedding using a format optimized for civic engagements
    const textForEmbedding = `
      TITLE: ${data.title} ${data.title} ${data.title}
      TYPE: ${data.type || ""}
      DESCRIPTION: ${data.description || ""}
      LOCATION: ${data.address || ""}
      LOCATION_NOTES: ${data.locationNotes || ""}
    `.trim();

    try {
      data.embedding = await embeddingService.getEmbedding(textForEmbedding);
      console.log(
        "[generateCivicEngagementEmbedding] Generated embedding successfully",
      );
    } catch (embeddingError) {
      console.error(
        "[generateCivicEngagementEmbedding] Error generating embedding:",
        embeddingError,
      );
      // Continue without embedding - the civic engagement can still be created
      data.embedding = [];
    }
  }

  return data;
}

/**
 * Prepare update data by generating embeddings if needed
 */
export async function prepareCivicEngagementUpdateData(
  data: Partial<CivicEngagementDataWithEmbedding>,
  embeddingService: IEmbeddingService,
): Promise<Partial<CivicEngagementDataWithEmbedding>> {
  const processedData = { ...data };

  // Generate embedding if title or description changed
  if (data.title || data.description) {
    console.log(
      "[prepareCivicEngagementUpdateData] Generating embedding for updated civic engagement:",
      data.title,
    );

    // Create text for embedding using a format optimized for civic engagements
    const textForEmbedding = `
      TITLE: ${data.title || ""} ${data.title || ""} ${data.title || ""}
      TYPE: ${data.type || ""}
      DESCRIPTION: ${data.description || ""}
      LOCATION: ${data.address || ""}
      LOCATION_NOTES: ${data.locationNotes || ""}
    `.trim();

    try {
      processedData.embedding =
        await embeddingService.getEmbedding(textForEmbedding);
      console.log(
        "[prepareCivicEngagementUpdateData] Generated embedding successfully",
      );
    } catch (embeddingError) {
      console.error(
        "[prepareCivicEngagementUpdateData] Error generating embedding:",
        embeddingError,
      );
      // Continue without embedding - the civic engagement can still be updated
      processedData.embedding = [];
    }
  }

  return processedData;
}

/**
 * Process form data for civic engagement updates and extract data from both multipart/form-data and JSON requests
 */
export async function processCivicEngagementUpdateFormData(
  c: Context<AppContext>,
  storageService: StorageService,
  user: { userId?: string; email: string; role: string },
  civicEngagementId: string,
): Promise<{
  data: Partial<CivicEngagementDataWithFormData>;
  imageUrls: string[];
}> {
  const contentType = c.req.header("content-type") || "";
  let data: Partial<CivicEngagementDataWithFormData>;
  let imageUrls: string[] = [];

  if (contentType.includes("multipart/form-data")) {
    console.log(
      "[processCivicEngagementUpdateFormData] Processing as FormData",
    );
    const formData = await c.req.formData();
    const imageEntry = formData.get("image");

    console.log(
      "[processCivicEngagementUpdateFormData] FormData keys:",
      Array.from(formData.keys()),
    );
    console.log(
      "[processCivicEngagementUpdateFormData] Image entry:",
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

      const imageUrl = await storageService.uploadImage(
        buffer,
        "civic-engagement",
        {
          filename: file.name,
          contentType: file.type,
          size: buffer.length.toString(),
          uploadedBy: user?.userId || "unknown",
          civicEngagementId: civicEngagementId,
        },
      );

      if (imageUrl) {
        imageUrls = [imageUrl];
      }
    }

    // Parse other form data
    const civicEngagementData = formData.get("civicEngagementData");
    if (civicEngagementData && typeof civicEngagementData === "string") {
      try {
        data = JSON.parse(civicEngagementData);
      } catch (error) {
        throw new Error("Invalid civic engagement data format");
      }
    } else {
      // Extract individual fields from form data
      data = {
        title: formData.get("title")?.toString() || "",
        description: formData.get("description")?.toString(),
        type: formData.get("type")?.toString() as CivicEngagementType,
        address: formData.get("address")?.toString(),
        locationNotes: formData.get("locationNotes")?.toString(),
        status: formData.get("status")?.toString() as CivicEngagementStatus,
        adminNotes: formData.get("adminNotes")?.toString(),
      };

      // Handle location coordinates
      const lat = formData.get("lat");
      const lng = formData.get("lng");
      if (lat && lng) {
        data.location = {
          type: "Point",
          coordinates: [parseFloat(lat.toString()), parseFloat(lng.toString())],
        };
      }
    }
  } else {
    console.log("[processCivicEngagementUpdateFormData] Processing as JSON");
    // Handle JSON data (existing behavior)
    data = await c.req.json();

    // Handle base64 image if provided in JSON
    if (data.imageBuffer) {
      const imageBuffer = Buffer.from(data.imageBuffer, "base64");
      const imageUrl = await storageService.uploadImage(
        imageBuffer,
        "civic-engagement",
        {
          filename: data.filename || "civic-engagement.jpg",
          contentType: data.contentType || "image/jpeg",
          size: imageBuffer.length.toString(),
          uploadedBy: user?.userId || "unknown",
          civicEngagementId: civicEngagementId,
        },
      );

      if (imageUrl) {
        imageUrls = [imageUrl];
      }
    }
  }

  return { data, imageUrls };
}
