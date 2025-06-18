import { describe, it, expect, beforeEach, jest } from "bun:test";
import { trackEventViewHandler } from "../eventHandlers";
import type { Context } from "hono";
import type { AppContext } from "../../types/context";
import type { EventService } from "../../services/EventServiceRefactored";

describe("trackEventViewHandler", () => {
  let mockContext: Context<AppContext>;
  let mockEventService: Partial<EventService>;

  beforeEach(() => {
    mockEventService = {
      getEventById: jest.fn() as jest.Mock,
      createViewRecord: jest.fn() as jest.Mock,
    };

    mockContext = {
      req: {
        param: jest.fn(),
      },
      get: jest.fn(),
      json: jest.fn(),
    } as unknown as Context<AppContext>;
  });

  it("should track event view successfully", async () => {
    const eventId = "event-123";
    const userId = "user-456";
    const mockEvent = { id: eventId, title: "Test Event" };
    const mockUser = { userId };

    (mockContext.req.param as jest.Mock).mockReturnValue(eventId);
    (mockContext.get as jest.Mock)
      .mockReturnValueOnce(mockUser) // user
      .mockReturnValueOnce(mockEventService); // eventService

    (mockEventService.getEventById as jest.Mock).mockResolvedValue(mockEvent);
    (mockEventService.createViewRecord as jest.Mock).mockResolvedValue(
      undefined,
    );

    await trackEventViewHandler(mockContext);

    expect(mockContext.get).toHaveBeenCalledWith("user");
    expect(mockContext.get).toHaveBeenCalledWith("eventService");
    expect(mockEventService.getEventById).toHaveBeenCalledWith(eventId);
    expect(mockEventService.createViewRecord).toHaveBeenCalledWith(
      userId,
      eventId,
    );
    expect(mockContext.json).toHaveBeenCalledWith({
      success: true,
      message: "Event view tracked successfully",
    });
  });

  it("should return error when user is not authenticated", async () => {
    const eventId = "event-123";

    (mockContext.req.param as jest.Mock).mockReturnValue(eventId);
    (mockContext.get as jest.Mock).mockReturnValueOnce(null); // No user

    await trackEventViewHandler(mockContext);

    expect(mockContext.json).toHaveBeenCalledWith(
      { error: "Authentication required" },
      401,
    );
  });

  it("should return error when event ID is missing", async () => {
    const mockUser = { userId: "user-456" };

    (mockContext.req.param as jest.Mock).mockReturnValue(null);
    (mockContext.get as jest.Mock).mockReturnValueOnce(mockUser);

    await trackEventViewHandler(mockContext);

    expect(mockContext.json).toHaveBeenCalledWith(
      { error: "Missing event ID" },
      400,
    );
  });

  it("should return error when event not found", async () => {
    const eventId = "event-123";
    const mockUser = { userId: "user-456" };

    (mockContext.req.param as jest.Mock).mockReturnValue(eventId);
    (mockContext.get as jest.Mock)
      .mockReturnValueOnce(mockUser) // user
      .mockReturnValueOnce(mockEventService); // eventService

    (mockEventService.getEventById as jest.Mock).mockResolvedValue(null);

    await trackEventViewHandler(mockContext);

    expect(mockContext.json).toHaveBeenCalledWith(
      { error: "Event not found" },
      404,
    );
  });
});
