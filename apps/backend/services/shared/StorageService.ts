// services/shared/StorageService.ts (non-blocking version)

import { GetObjectCommand, S3 } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";

export class StorageService extends EventEmitter {
  private static instance: StorageService;
  private s3Client: S3 | null = null;
  private bucketName: string = "event-images";
  public isEnabled: boolean = true;
  private uploadQueue: Array<{
    imageBuffer: Buffer;
    prefix: string;
    metadata: Record<string, string>;
    resolveUrl: (url: string | null) => void;
  }> = [];
  private isProcessing: boolean = false;

  private constructor() {
    super(); // Initialize EventEmitter
    console.log("StorageService constructor called");

    // Check if storage is enabled via environment variable
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
          requestHandler: {
            validateResponse: false,
          },
          customUserAgent: "event-app-storage-service",
          maxAttempts: 3,
          retryMode: "standard",
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
   * Queue an image upload and return immediately
   * Returns a promise that resolves when the upload is complete
   */
  public uploadImage(
    imageBuffer: Buffer,
    prefix: string = "events",
    metadata: Record<string, string> = {},
  ): Promise<string | null> {
    console.log(
      `uploadImage called, isEnabled=${this.isEnabled}, bufferSize=${imageBuffer.length}`,
    );

    // Skip if storage is disabled
    if (!this.isEnabled) {
      console.log("Storage is disabled, not uploading");
      return Promise.resolve(null);
    }

    // Return a promise that will resolve when the upload completes
    return new Promise((resolve) => {
      // Add to queue
      this.uploadQueue.push({
        imageBuffer,
        prefix,
        metadata,
        resolveUrl: resolve,
      });

      // Process queue if not already processing
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  /**
   * Process the upload queue in the background
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.uploadQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      // Get the next item from the queue
      const item = this.uploadQueue.shift();

      if (!item) {
        this.isProcessing = false;
        return;
      }

      const { imageBuffer, prefix, metadata, resolveUrl } = item;

      // Perform the actual upload
      const url = await this.performUpload(imageBuffer, prefix, metadata);

      // Resolve the promise with the URL
      resolveUrl(url);

      // Emit event for logging/monitoring
      this.emit("uploadComplete", {
        success: !!url,
        prefix,
        size: imageBuffer.length,
      });
    } catch (error) {
      console.error("Error in queue processing:", error);
    } finally {
      this.isProcessing = false;

      // Continue processing if there are more items
      if (this.uploadQueue.length > 0) {
        // Use setImmediate to prevent blocking
        setImmediate(() => this.processQueue());
      }
    }
  }

  /**
   * Perform the actual upload to S3/DO Spaces
   * @private
   */
  private async performUpload(
    imageBuffer: Buffer,
    prefix: string,
    metadata: Record<string, string>,
  ): Promise<string | null> {
    try {
      // Generate a unique ID for the image
      const imageId = uuidv4();
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const key = `${prefix}/${timestamp}-${imageId}.jpg`;

      // Upload to DO Space if client is initialized
      if (this.s3Client) {
        const startTime = Date.now();

        // Upload directly using the buffer instead of creating a stream
        await this.s3Client.putObject({
          Bucket: this.bucketName,
          Key: key,
          Body: imageBuffer,
          ContentType: "image/jpeg",
          Metadata: metadata,
          ContentEncoding: "binary",
          CacheControl: "public, max-age=31536000",
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
   * Get the current queue size (useful for monitoring)
   */
  public getQueueSize(): number {
    return this.uploadQueue.length;
  }

  /**
   * Handle any remaining uploads before the app shuts down
   */
  public async drainQueue(): Promise<void> {
    console.log(
      `Draining upload queue: ${this.uploadQueue.length} items remaining`,
    );

    // Process remaining items one by one
    while (this.uploadQueue.length > 0) {
      await new Promise((resolve) => {
        this.once("uploadComplete", resolve);
        if (!this.isProcessing) {
          this.processQueue();
        }
      });
    }

    console.log("Upload queue drained");
  }

  public getS3Client(): S3 | null {
    return this.s3Client;
  }

  public getBucketName(): string {
    return this.bucketName;
  }

  // Add this method to the StorageService class
  public async streamImage(
    imageUrl: string,
  ): Promise<{ stream: ReadableStream; contentType: string }> {
    if (!this.isEnabled || !this.s3Client) {
      throw new Error("Storage service is not available");
    }

    try {
      // Parse the URL to get the key
      const url = new URL(imageUrl);
      const key = url.pathname.substring(1); // Remove leading slash

      const response = await this.s3Client.getObject({
        Bucket: this.bucketName,
        Key: key,
      });

      if (!response.Body) {
        throw new Error("No data received from storage");
      }

      return {
        stream: response.Body as ReadableStream,
        contentType: response.ContentType || "image/jpeg",
      };
    } catch (error) {
      console.error("Error retrieving image from storage:", error);
      throw new Error("Failed to stream image from storage");
    }
  }

  public async getSignedUrl(
    imageUrl: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    if (!this.isEnabled || !this.s3Client) {
      throw new Error("Storage service is not available");
    }

    try {
      // Parse the URL to get the key
      const url = new URL(imageUrl);
      const path = url.pathname;
      // Remove leading slash and potentially the bucket name prefix
      let key = path.startsWith("/") ? path.substring(1) : path;

      // If the path includes the bucket name, remove it
      if (key.startsWith(`${this.bucketName}/`)) {
        key = key.substring(this.bucketName.length + 1);
      }

      console.log(`Getting signed URL for key: ${key}`);

      // Create the command
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      // Generate signed URL
      const signedUrl = await getSignedUrl(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.s3Client as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        command as any,
        {
          expiresIn, // Seconds
        },
      );

      console.log(`Generated signed URL (expires in ${expiresIn}s)`);
      return signedUrl;
    } catch (error) {
      console.error("Error generating signed URL:", error);
      throw new Error("Failed to generate signed URL");
    }
  }
}
