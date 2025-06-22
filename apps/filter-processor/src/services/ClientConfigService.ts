import type { Redis } from "ioredis";
import type { ClientConfig } from "../types/types";
import { ClientType } from "../types/types";

export interface ClientConfigService {
  getClientConfig: (userId: string) => Promise<ClientConfig>;
  getDefaultConfig: (clientType: ClientType) => ClientConfig;
}

export interface ClientConfigServiceDependencies {
  redis: Redis;
}

export function createClientConfigService(
  dependencies: ClientConfigServiceDependencies,
): ClientConfigService {
  const { redis } = dependencies;

  // Default configurations for each client type
  const defaultConfigs: Record<ClientType, ClientConfig> = {
    [ClientType.MOBILE]: {
      includeEvents: true,
      includeCivicEngagements: false, // Mobile doesn't see civic engagements
      maxEvents: 100,
      maxCivicEngagements: 0,
    },
    [ClientType.DASHBOARD]: {
      includeEvents: true,
      includeCivicEngagements: true, // Dashboard sees everything
      maxEvents: 200,
      maxCivicEngagements: 50,
    },
  };

  return {
    async getClientConfig(userId: string): Promise<ClientConfig> {
      try {
        // Try to get client types from Redis
        const clientTypeKey = `user:${userId}:client_types`;
        const clientTypesJson = await redis.get(clientTypeKey);

        if (clientTypesJson) {
          try {
            const clientTypes = JSON.parse(clientTypesJson);
            const typesArray = Array.isArray(clientTypes)
              ? clientTypes
              : [clientTypes];

            // If user has both mobile and dashboard clients, check which one is more recent
            if (
              typesArray.includes("dashboard") &&
              typesArray.includes("mobile")
            ) {
              // Get the most recent client type by checking the order in the array
              // The last item in the array is typically the most recent
              const mostRecentType = typesArray[typesArray.length - 1];

              if (mostRecentType === "mobile") {
                console.log(
                  `[ClientConfigService] User ${userId} has both mobile and dashboard clients, using mobile config (most recent)`,
                );
                return this.getDefaultConfig(ClientType.MOBILE);
              } else {
                console.log(
                  `[ClientConfigService] User ${userId} has both mobile and dashboard clients, using dashboard config (most recent)`,
                );
                return this.getDefaultConfig(ClientType.DASHBOARD);
              }
            } else if (typesArray.includes("dashboard")) {
              console.log(
                `[ClientConfigService] User ${userId} has dashboard client, using dashboard config`,
              );
              return this.getDefaultConfig(ClientType.DASHBOARD);
            } else if (typesArray.includes("mobile")) {
              console.log(
                `[ClientConfigService] User ${userId} has mobile client, using mobile config`,
              );
              return this.getDefaultConfig(ClientType.MOBILE);
            }

            // Fallback to first type found
            const firstType = typesArray[0];
            if (Object.values(ClientType).includes(firstType as ClientType)) {
              console.log(
                `[ClientConfigService] Using config for client type: ${firstType}`,
              );
              return this.getDefaultConfig(firstType as ClientType);
            }
          } catch (error) {
            console.error(
              `[ClientConfigService] Error parsing client types for user ${userId}:`,
              error,
            );
          }
        }

        // Fallback to mobile config if no client type found (more restrictive)
        console.log(
          `[ClientConfigService] No client type found for user ${userId}, using mobile config`,
        );
        return this.getDefaultConfig(ClientType.MOBILE);
      } catch (error) {
        console.error(
          `[ClientConfigService] Error getting client config for user ${userId}:`,
          error,
        );
        // Fallback to mobile config on error (more restrictive)
        return this.getDefaultConfig(ClientType.MOBILE);
      }
    },

    getDefaultConfig(clientType: ClientType): ClientConfig {
      return defaultConfigs[clientType];
    },
  };
}
