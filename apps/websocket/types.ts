// services/event-processing/types/RichUIMetadata.ts

/**
 * Icon types for progress steps
 */
export type IconType =
  | "processing"
  | "success"
  | "error"
  | "warning"
  | "info"
  | "image"
  | "calendar"
  | "location"
  | "category"
  | "duplicate"
  | "qrcode";

/**
 * Rich UI metadata for progress updates
 */
export interface RichUIMetadata {
  // Visual elements
  icon?: IconType; // Step icon type
  color?: string; // Color for step (can be used for icon, border, etc.)
  animationType?: string; // Type of animation to use (e.g., 'pulse', 'spin', 'bounce')

  // Content elements
  title?: string; // Optional title for the step
  description?: string; // Detailed description
  summary?: Record<string, any>; // Key-value summary data
  detailsExpanded?: boolean; // Whether details should be expanded by default

  // Preview elements
  previewImageUrl?: string; // URL for image preview
  previewText?: string; // Text preview

  // Interactive elements
  actions?: Array<{
    // Available actions for this step
    id: string;
    label: string;
    type: "primary" | "secondary" | "danger";
    disabled?: boolean;
  }>;

  // Navigation
  linkedEntityId?: string; // ID of a related entity (event, venue, etc.)
  linkedEntityType?: string; // Type of the linked entity

  // Temporal information
  estimatedTimeRemaining?: number; // Estimated seconds remaining
  startTime?: string; // ISO timestamp when step started

  // Additional context
  contextData?: Record<string, any>; // Any additional data needed for UI rendering
}

/**
 * Predefined rich UI metadata templates for common steps
 */
export const richUITemplates = {
  // Image processing templates
  imageAnalysisStarted: (): RichUIMetadata => ({
    icon: "image",
    color: "#3498db", // Blue
    animationType: "pulse",
    title: "Image Analysis",
    description: "Starting image analysis to extract event information",
    estimatedTimeRemaining: 10,
  }),

  imageAnalysisComplete: (confidence: number): RichUIMetadata => ({
    icon: "image",
    color: "#2ecc71", // Green
    title: "Image Analysis Complete",
    description: `Successfully analyzed image with ${Math.round(confidence * 100)}% confidence`,
    summary: { confidence: `${Math.round(confidence * 100)}%` },
  }),

  // Event extraction templates
  eventDetailsExtracted: (details: any): RichUIMetadata => ({
    icon: "info",
    color: "#2ecc71", // Green
    title: "Event Details Extracted",
    description: "Successfully extracted event information from the image",
    summary: {
      title: details.title || "Unknown",
      date: details.date || "Unknown",
      location: details.address || "Unknown",
    },
    detailsExpanded: true,
  }),

  // QR code templates
  qrCodeDetected: (data?: string): RichUIMetadata => ({
    icon: "qrcode",
    color: "#f39c12", // Orange
    title: "QR Code Detected",
    description: "Found a QR code in the image",
    summary: {
      data: data || "[Content not readable]",
    },
  }),

  // Duplicate detection templates
  duplicateDetected: (eventId: string, score: number, title: string): RichUIMetadata => ({
    icon: "duplicate",
    color: "#e74c3c", // Red
    title: "Duplicate Event Detected",
    description: `This appears to be a duplicate of an existing event: "${title}"`,
    summary: {
      similarityScore: `${Math.round(score * 100)}%`,
      matchingEvent: title,
    },
    linkedEntityId: eventId,
    linkedEntityType: "event",
    actions: [
      {
        id: "viewEvent",
        label: "View Existing Event",
        type: "primary",
      },
    ],
  }),

  // Event creation templates
  eventCreationStarted: (): RichUIMetadata => ({
    icon: "calendar",
    color: "#3498db", // Blue
    animationType: "pulse",
    title: "Creating Event",
    description: "Creating new event with extracted information",
  }),

  eventCreationComplete: (eventId: string, title: string): RichUIMetadata => ({
    icon: "success",
    color: "#2ecc71", // Green
    title: "Event Created Successfully",
    description: `Successfully created event: "${title}"`,
    linkedEntityId: eventId,
    linkedEntityType: "event",
    actions: [
      {
        id: "viewEvent",
        label: "View Event",
        type: "primary",
      },
    ],
  }),

  // Error templates
  errorOccurred: (message: string): RichUIMetadata => ({
    icon: "error",
    color: "#e74c3c", // Red
    title: "Error Occurred",
    description: message,
  }),

  lowConfidence: (confidence: number): RichUIMetadata => ({
    icon: "warning",
    color: "#f39c12", // Orange
    title: "Low Confidence",
    description: `Confidence level (${Math.round(
      confidence * 100
    )}%) is too low to create an event`,
    summary: {
      confidence: `${Math.round(confidence * 100)}%`,
      required: "75%",
    },
  }),

  invalidDate: (reason: string): RichUIMetadata => ({
    icon: "warning",
    color: "#f39c12", // Orange
    title: "Invalid Event Date",
    description: reason,
  }),
};
