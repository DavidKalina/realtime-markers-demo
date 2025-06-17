import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { ImageProcessingServiceImpl } from "../event-processing/ImageProcessingService";
import type { OpenAIService } from "../shared/OpenAIService";
import type { ImageProcessingCacheService } from "../shared/ImageProcessingCacheService";
import type { PrivacyValidationResult } from "../event-processing/dto/ImageProcessingResult";
import type { ChatCompletion } from "openai/resources/chat/completions";

// Mock dependencies
const mockOpenAIService = {
  executeChatCompletion: jest.fn(),
  generateEmbedding: jest.fn(),
  getStats: jest.fn(),
  resetRateLimits: jest.fn(),
} as jest.Mocked<OpenAIService>;

const mockImageProcessingCacheService = {
  getProcessingResult: jest.fn(),
  setProcessingResult: jest.fn(),
  invalidateProcessingResult: jest.fn(),
  invalidateAllProcessingResults: jest.fn(),
  getMultiEventResult: jest.fn(),
  setMultiEventResult: jest.fn(),
  invalidateMultiEventResult: jest.fn(),
  invalidateAllMultiEventResults: jest.fn(),
} as jest.Mocked<ImageProcessingCacheService>;

describe("ImageProcessingService", () => {
  let imageProcessingService: ImageProcessingServiceImpl;

  beforeEach(() => {
    jest.clearAllMocks();
    imageProcessingService = new ImageProcessingServiceImpl(
      mockOpenAIService,
      mockImageProcessingCacheService,
    );
  });

  describe("privacy validation", () => {
    it("should reject private medical appointments", async () => {
      const privateEventText = `
        Event Title: Doctor Appointment
        Date and Time: December 15, 2024 at 2:00 PM
        VENUE ADDRESS: 123 Medical Center Dr, Suite 100
        VENUE NAME: Dr. Smith's Office
        ORGANIZER: Dr. Smith
        Description: Annual checkup appointment
        Contact Info: (555) 123-4567
        Confidence Score: 0.8
      `;

      const mockPrivacyValidation: PrivacyValidationResult = {
        isPublicEvent: false,
        confidence: 0.9,
        reason: "This appears to be a private medical appointment",
        containsPrivateInfo: true,
        privateInfoTypes: ["medical_appointment"],
      };

      mockOpenAIService.executeChatCompletion
        .mockResolvedValueOnce({
          choices: [{ message: { content: privateEventText } }],
        } as ChatCompletion)
        .mockResolvedValueOnce({
          choices: [
            { message: { content: JSON.stringify(mockPrivacyValidation) } },
          ],
        } as ChatCompletion);

      mockImageProcessingCacheService.getProcessingResult.mockResolvedValue(
        null,
      );

      const result = await imageProcessingService.processImage(
        Buffer.from("fake-image-data"),
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Private information detected");
      expect(result.privacyValidation).toEqual(mockPrivacyValidation);
    });

    it("should accept public community events", async () => {
      const publicEventText = `
        Event Title: Community Art Festival
        Date and Time: December 20, 2024 at 6:00 PM
        VENUE ADDRESS: 456 Community Center Blvd
        VENUE NAME: Downtown Community Center
        ORGANIZER: Local Arts Council
        Description: Annual community art festival featuring local artists
        Contact Info: info@localartscouncil.org
        Confidence Score: 0.9
      `;

      const mockPrivacyValidation: PrivacyValidationResult = {
        isPublicEvent: true,
        confidence: 0.95,
        reason: "This is a public community event",
        containsPrivateInfo: false,
        privateInfoTypes: [],
      };

      mockOpenAIService.executeChatCompletion
        .mockResolvedValueOnce({
          choices: [{ message: { content: publicEventText } }],
        } as ChatCompletion)
        .mockResolvedValueOnce({
          choices: [
            { message: { content: JSON.stringify(mockPrivacyValidation) } },
          ],
        } as ChatCompletion);

      mockImageProcessingCacheService.getProcessingResult.mockResolvedValue(
        null,
      );

      const result = await imageProcessingService.processImage(
        Buffer.from("fake-image-data"),
      );

      expect(result.success).toBe(true);
      expect(result.privacyValidation).toEqual(mockPrivacyValidation);
    });

    it("should reject private business meetings", async () => {
      const privateEventText = `
        Event Title: Team Standup Meeting
        Date and Time: December 16, 2024 at 9:00 AM
        VENUE ADDRESS: Conference Room A
        VENUE NAME: Office Building
        ORGANIZER: Project Manager
        Description: Daily team standup meeting
        Contact Info: pm@company.com
        Confidence Score: 0.7
      `;

      const mockPrivacyValidation: PrivacyValidationResult = {
        isPublicEvent: false,
        confidence: 0.85,
        reason: "This appears to be a private business meeting",
        containsPrivateInfo: true,
        privateInfoTypes: ["business_meeting"],
      };

      mockOpenAIService.executeChatCompletion
        .mockResolvedValueOnce({
          choices: [{ message: { content: privateEventText } }],
        } as ChatCompletion)
        .mockResolvedValueOnce({
          choices: [
            { message: { content: JSON.stringify(mockPrivacyValidation) } },
          ],
        } as ChatCompletion);

      mockImageProcessingCacheService.getProcessingResult.mockResolvedValue(
        null,
      );

      const result = await imageProcessingService.processImage(
        Buffer.from("fake-image-data"),
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Private information detected");
    });

    it("should handle Vision API detecting private information directly", async () => {
      mockOpenAIService.executeChatCompletion.mockResolvedValueOnce({
        choices: [{ message: { content: "PRIVATE INFORMATION DETECTED" } }],
      } as ChatCompletion);

      mockImageProcessingCacheService.getProcessingResult.mockResolvedValue(
        null,
      );

      const result = await imageProcessingService.processImage(
        Buffer.from("fake-image-data"),
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Private information detected - event processing rejected",
      );
    });

    it("should handle privacy validation errors gracefully", async () => {
      const publicEventText = `
        Event Title: Public Concert
        Date and Time: December 25, 2024 at 7:00 PM
        VENUE ADDRESS: 789 Concert Hall Ave
        VENUE NAME: City Concert Hall
        ORGANIZER: City Arts Department
        Description: Holiday concert featuring local musicians
        Contact Info: concerts@city.gov
        Confidence Score: 0.9
      `;

      mockOpenAIService.executeChatCompletion
        .mockResolvedValueOnce({
          choices: [{ message: { content: publicEventText } }],
        } as ChatCompletion)
        .mockRejectedValueOnce(new Error("Privacy validation failed"));

      mockImageProcessingCacheService.getProcessingResult.mockResolvedValue(
        null,
      );

      const result = await imageProcessingService.processImage(
        Buffer.from("fake-image-data"),
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Private information detected");
      expect(result.privacyValidation?.reason).toContain(
        "Privacy validation failed",
      );
    });
  });

  describe("multi-event processing", () => {
    it("should reject multi-event images containing private information", async () => {
      const multiEventText = `
        EVENT_COUNT: 2
        
        EVENT_1:
        Event Title: Doctor Appointment
        Date and Time: December 15, 2024 at 2:00 PM
        VENUE ADDRESS: 123 Medical Center Dr
        VENUE NAME: Dr. Smith's Office
        ORGANIZER: Dr. Smith
        Description: Annual checkup
        Confidence Score: 0.8
        
        EVENT_2:
        Event Title: Community Festival
        Date and Time: December 20, 2024 at 6:00 PM
        VENUE ADDRESS: 456 Community Center Blvd
        VENUE NAME: Downtown Community Center
        ORGANIZER: Local Arts Council
        Description: Annual community art festival
        Confidence Score: 0.9
      `;

      const mockPrivacyValidation1: PrivacyValidationResult = {
        isPublicEvent: false,
        confidence: 0.9,
        reason: "This appears to be a private medical appointment",
        containsPrivateInfo: true,
        privateInfoTypes: ["medical_appointment"],
      };

      const mockPrivacyValidation2: PrivacyValidationResult = {
        isPublicEvent: true,
        confidence: 0.95,
        reason: "This is a public community event",
        containsPrivateInfo: false,
        privateInfoTypes: [],
      };

      mockOpenAIService.executeChatCompletion
        .mockResolvedValueOnce({
          choices: [{ message: { content: "MULTIPLE" } }],
        } as ChatCompletion)
        .mockResolvedValueOnce({
          choices: [{ message: { content: multiEventText } }],
        } as ChatCompletion)
        .mockResolvedValueOnce({
          choices: [
            { message: { content: JSON.stringify(mockPrivacyValidation1) } },
          ],
        } as ChatCompletion)
        .mockResolvedValueOnce({
          choices: [
            { message: { content: JSON.stringify(mockPrivacyValidation2) } },
          ],
        } as ChatCompletion);

      mockImageProcessingCacheService.getMultiEventResult.mockResolvedValue(
        null,
      );

      const result = await imageProcessingService.processMultiEventImage(
        Buffer.from("fake-image-data"),
      );

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(2);
      expect(result.events[0].success).toBe(false);
      expect(result.events[0].error).toContain("Private information detected");
      expect(result.events[1].success).toBe(true);
    });
  });
});
