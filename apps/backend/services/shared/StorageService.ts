// services/shared/StorageService.ts (updated version)

import { S3 } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";

export class StorageService {
  private static instance: StorageService;
  private s3Client: S3 | null = null;
  private bucketName: string = "event-images";
  public isEnabled: boolean = true; // Make public for debugging

  private constructor() {
    console.log("StorageService constructor called");

    // Check if storage is enabled via environment variable
    console.log(process.env.ENABLE_IMAGE_STORAGE);
    this.isEnabled = process.env.ENABLE_IMAGE_STORAGE === "true";
    console.log(`StorageService initialized with isEnabled=${this.isEnabled}`);

    // Only initialize if enabled
    if (this.isEnabled) {
      this.bucketName = process.env.DO_SPACE_BUCKET || "event-images";

      try {
        this.s3Client = new S3({
          endpoint: process.env.DO_SPACE_ENDPOINT,
          region: process.env.DO_SPACE_REGION || "us-east-1",
          credentials: {
            accessKeyId: process.env.DO_SPACE_ACCESS_KEY || "",
            secretAccessKey: process.env.DO_SPACE_SECRET_KEY || "",
          },
          forcePathStyle: true,
        });

        console.log("S3 client initialized with:", {
          endpoint: process.env.DO_SPACE_ENDPOINT,
          region: process.env.DO_SPACE_REGION,
          bucketName: this.bucketName,
          accessKeyProvided: !!process.env.DO_SPACE_ACCESS_KEY,
        });
      } catch (error) {
        console.error("Error initializing S3 client:", error);
      }
    }
  }

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  /**
   * Upload an image buffer to Digital Ocean Space
   */
  public async uploadImage(
    imageBuffer: Buffer,
    prefix: string = "events",
    metadata: Record<string, string> = {}
  ): Promise<string | null> {
    console.log(
      `uploadImage called, isEnabled=${this.isEnabled}, bufferSize=${imageBuffer.length}`
    );

    // Skip if storage is disabled
    if (!this.isEnabled) {
      console.log("Storage is disabled, not uploading");
      return null;
    }

    try {
      // Generate a unique ID for the image
      const imageId = uuidv4();
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const key = `${prefix}/${timestamp}-${imageId}.jpg`;

      console.log("Preparing to upload to storage:", {
        bucket: this.bucketName,
        key,
        endpoint: process.env.DO_SPACE_ENDPOINT,
      });

      // Upload to DO Space if client is initialized
      if (this.s3Client) {
        console.log("S3 client exists, calling putObject...");

        const startTime = Date.now();
        await this.s3Client.putObject({
          Bucket: this.bucketName,
          Key: key,
          Body: imageBuffer,
          ContentType: "image/jpeg",
          Metadata: metadata,
        });

        const duration = Date.now() - startTime;
        console.log(`Upload completed in ${duration}ms`);
      } else {
        console.error("S3 client not initialized");
        throw new Error("S3 client not initialized");
      }

      // Construct the URL to the uploaded image
      const endpoint = process.env.DO_SPACE_ENDPOINT || "";
      let imageUrl: string;

      // Check if endpoint already includes bucket name
      if (endpoint.includes(this.bucketName)) {
        imageUrl = `${endpoint}/${key}`;
      } else {
        imageUrl = `https://${this.bucketName}.${endpoint.replace("https://", "")}/${key}`;
      }

      console.log("Image URL generated:", imageUrl);
      return imageUrl;
    } catch (error) {
      console.error("Error uploading image to storage:", error);
      return null;
    }
  }

  /**
   * Store both original and preprocessed versions of an image
   */
  public async storeProcessedImages(
    originalImage: Buffer,
    preprocessedImage: Buffer,
    processingType: string,
    metadata: Record<string, string> = {}
  ): Promise<{ original: string | null; preprocessed: string | null }> {
    console.log(`storeProcessedImages called for ${processingType}, isEnabled=${this.isEnabled}`);

    // Skip if storage is disabled
    if (!this.isEnabled) {
      console.log("Storage is disabled, not uploading processed images");
      return { original: null, preprocessed: null };
    }

    try {
      const imageId = uuidv4();
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

      // Add basic metadata
      const enhancedMetadata = {
        ...metadata,
        timestamp,
        processingType,
        imageId,
      };

      console.log("Starting parallel uploads for processed images");

      // Upload both images in parallel but with proper awaiting
      const [originalUrl, preprocessedUrl] = await Promise.all([
        this.uploadImage(originalImage, `events/original/${processingType}`, enhancedMetadata),
        this.uploadImage(
          preprocessedImage,
          `events/preprocessed/${processingType}`,
          enhancedMetadata
        ),
      ]);

      const result = {
        original: originalUrl,
        preprocessed: preprocessedUrl,
      };

      console.log("Both uploads complete:", result);
      return result;
    } catch (error) {
      console.error("Error in storeProcessedImages:", error);
      return { original: null, preprocessed: null };
    }
  }
}
