// notification-worker.ts
import Redis from "ioredis";
import { CronJob } from "cron";
import { Expo, type ExpoPushMessage } from "expo-server-sdk";
import AppDataSource from "./data-source";
import { Event, EventStatus } from "./entities/Event";
import { UserEventSave } from "./entities/UserEventSave";
import { User } from "./entities/User";
import { UserDeviceToken } from "./entities/UserDeviceToken";
import { Between, Repository } from "typeorm";

async function initializeNotificationWorker() {
  console.log("Initializing notification worker...");

  // Initialize data source
  await AppDataSource.initialize();
  console.log("Database connection established");

  // Initialize repositories
  const eventRepository = AppDataSource.getRepository(Event);
  const userEventSaveRepository = AppDataSource.getRepository(UserEventSave);
  const userRepository = AppDataSource.getRepository(User);
  const userDeviceTokenRepository = AppDataSource.getRepository(UserDeviceToken);

  // Initialize Redis
  const redisClient = new Redis({
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD || undefined,
  });

  // Initialize Expo SDK
  const expo = new Expo({
    accessToken: process.env.EXPO_ACCESS_TOKEN,
  });

  // Schedule recurring check for upcoming events using cron package
  // Run every 15 minutes (at 0, 15, 30, 45 minutes of each hour)
  const notificationJob = new CronJob(
    "0,15,30,45 * * * *",
    async function () {
      console.log("[Notification Worker] Checking for upcoming events...");
      try {
        const result = await processUpcomingEventNotifications(
          eventRepository,
          userEventSaveRepository,
          userRepository,
          userDeviceTokenRepository,
          redisClient,
          expo
        );
        console.log(
          `[Notification Worker] Check complete: ${result.eventsProcessed} events processed, ${result.notificationsSent} notifications sent`
        );
      } catch (error) {
        console.error("[Notification Worker] Error checking for notifications:", error);
      }
    },
    null, // onComplete
    true, // start immediately
    "UTC" // timezone
  );

  console.log("Notification worker started successfully");
  console.log(`Next check scheduled for: ${notificationJob.nextDate().toISODate()}`);

  // Handle graceful shutdown
  process.on("SIGTERM", async () => {
    console.log("Notification worker shutting down...");
    notificationJob.stop();
    await redisClient.quit();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    console.log("Notification worker shutting down...");
    notificationJob.stop();
    await redisClient.quit();
    process.exit(0);
  });
}

/**
 * Check for upcoming events and send notifications
 */
async function processUpcomingEventNotifications(
  eventRepository: Repository<Event>,
  userEventSaveRepository: Repository<UserEventSave>,
  userRepository: Repository<User>,
  userDeviceTokenRepository: Repository<UserDeviceToken>,
  redisClient: Redis,
  expo: Expo
): Promise<{
  eventsProcessed: number;
  notificationsSent: number;
}> {
  const now = new Date();
  let notificationsSent = 0;
  let eventsProcessed = 0;

  // We'll check for events starting soon at 60, 30, and 15 minute intervals
  const reminderIntervals = [60, 30, 15];

  for (const minutes of reminderIntervals) {
    // Calculate time range for upcoming events
    const rangeStart = new Date(now.getTime() + (minutes - 2) * 60 * 1000);
    const rangeEnd = new Date(now.getTime() + (minutes + 2) * 60 * 1000);

    console.log(
      `Looking for events starting in ~${minutes} minutes (${rangeStart.toISOString()} to ${rangeEnd.toISOString()})`
    );

    // Find events starting soon
    const upcomingEvents = await eventRepository.find({
      where: {
        eventDate: Between(rangeStart, rangeEnd),
        status: EventStatus.VERIFIED,
      },
    });

    console.log(`Found ${upcomingEvents.length} events starting in ~${minutes} minutes`);
    eventsProcessed += upcomingEvents.length;

    // Process each event
    for (const event of upcomingEvents) {
      try {
        // Check if we've already sent notifications for this event at this interval
        const notificationKey = `event_notification:${event.id}:${minutes}min`;
        const alreadySent = await redisClient.exists(notificationKey);

        if (alreadySent) {
          console.log(`Already sent ${minutes}-minute notifications for event: ${event.id}`);
          continue;
        }

        // Find users who saved this event
        const savedByUsers = await userEventSaveRepository.find({
          where: { eventId: event.id },
        });

        console.log(`Event ${event.title} (${event.id}) saved by ${savedByUsers.length} users`);

        // Send notification to each user
        for (const save of savedByUsers) {
          try {
            // Get user preferences
            const user = await userRepository.findOneBy({ id: save.userId });

            if (!user) {
              console.warn(`User ${save.userId} not found`);
              continue;
            }

            // Skip if user has notifications disabled
            if (user.notificationsEnabled === false || user.eventNotificationsEnabled === false) {
              continue;
            }

            // Skip if user's preferred lead time is greater than this interval
            // (They'll get notification at their preferred time)
            if (user.notificationLeadTimeMinutes > minutes) {
              continue;
            }

            // Get user's device tokens
            const deviceTokens = await getUserDeviceTokens(
              user.id,
              userDeviceTokenRepository,
              redisClient
            );

            if (deviceTokens.length === 0) {
              console.log(`No device tokens for user ${user.id}`);
              continue;
            }

            // Format notification message
            const minutesText = minutes === 60 ? "1 hour" : `${minutes} minutes`;
            const notificationTitle = `Event Starting Soon: ${event.title}`;
            const notificationBody = `"${event.title}" is starting in ${minutesText} at ${
              event.address || "the specified location"
            }.`;

            // Send push notifications
            await sendPushNotifications(expo, deviceTokens, notificationTitle, notificationBody, {
              eventId: event.id,
              type: "event_starting_soon",
              timeToStart: minutes,
              emoji: event.emoji || "📍",
            });

            notificationsSent += deviceTokens.length;
          } catch (userError) {
            console.error(`Error sending notification to user ${save.userId}:`, userError);
          }
        }

        // Mark this event interval as notified to prevent duplicates
        await redisClient.set(notificationKey, "1", "EX", 86400); // 24 hour TTL
      } catch (eventError) {
        console.error(`Error processing event ${event.id}:`, eventError);
      }
    }
  }

  console.log(
    `Notification processing complete. Events: ${eventsProcessed}, Notifications: ${notificationsSent}`
  );
  return { eventsProcessed, notificationsSent };
}

/**
 * Get user's device tokens from database or Redis cache
 */
async function getUserDeviceTokens(
  userId: string,
  userDeviceTokenRepository: Repository<UserDeviceToken>,
  redisClient: Redis
): Promise<string[]> {
  // Try from Redis first (faster)
  const tokensFromRedis = await redisClient.smembers(`user:${userId}:device_tokens`);

  if (tokensFromRedis.length > 0) {
    return tokensFromRedis;
  }

  // If not in Redis, query from database
  const deviceTokens = await userDeviceTokenRepository.find({
    where: {
      userId,
      isActive: true,
    },
    select: ["token"],
  });

  const tokens = deviceTokens.map((dt) => dt.token);

  // Cache in Redis for faster future lookups
  if (tokens.length > 0) {
    const pipeline = redisClient.pipeline();

    tokens.forEach((token) => {
      pipeline.sadd(`user:${userId}:device_tokens`, token);
    });

    // Set TTL for cache
    pipeline.expire(`user:${userId}:device_tokens`, 12 * 60 * 60); // 12 hour TTL
    await pipeline.exec();
  }

  return tokens;
}

/**
 * Send push notifications via Expo
 */
async function sendPushNotifications(
  expo: Expo,
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  // Filter for valid Expo push tokens
  const validTokens = tokens.filter((token) => Expo.isExpoPushToken(token));

  if (validTokens.length === 0) {
    return;
  }

  // Create messages
  const messages: ExpoPushMessage[] = validTokens.map((token) => ({
    to: token,
    sound: "default",
    title,
    body,
    data: data || {},
  }));

  // Send in chunks (Expo recommendation for large batches)
  const chunks = expo.chunkPushNotifications(messages);

  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);

      // Process tickets (optional but recommended to handle errors)
      for (const ticket of tickets) {
        if (ticket.status === "error") {
          console.error("Push notification error:", ticket.message);

          if (ticket.details && ticket.details.error === "DeviceNotRegistered") {
            // Handle invalid tokens - we should remove these from our database
            // This would require tracking which token caused the error
            console.warn("Device not registered, token should be removed");
          }
        }
      }
    } catch (error) {
      console.error("Error sending push notifications:", error);
    }
  }
}

// Start the worker
initializeNotificationWorker().catch((error) => {
  console.error("Failed to initialize notification worker:", error);
  process.exit(1);
});
