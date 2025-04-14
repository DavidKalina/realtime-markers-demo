import { DataSource, Repository } from "typeorm";
import { Organization } from "../entities/Organization";
import { User } from "../entities/User";
import { Event } from "../entities/Event";
import { Brackets } from "typeorm";
import { StripeService } from "./StripeService";
import Stripe from "stripe";
import { CacheService } from "./shared/CacheService";

interface SearchOrganizationsInput {
    query?: string;
    limit?: number;
    cursor?: string;
}

interface SearchOrganizationsResult {
    organizations: Organization[];
    nextCursor?: string;
}

export class OrganizationService {
    private organizationRepository: Repository<Organization>;
    private userRepository: Repository<User>;
    private eventRepository: Repository<Event>;
    private stripeService: StripeService;

    constructor(dataSource: DataSource) {
        this.organizationRepository = dataSource.getRepository(Organization);
        this.userRepository = dataSource.getRepository(User);
        this.eventRepository = dataSource.getRepository(Event);
        this.stripeService = new StripeService();
    }

    private getOrganizationCacheKey(id: string): string {
        return `organization:${id}`;
    }

    private getOrganizationEventsCacheKey(organizationId: string, cursor?: string): string {
        return `organization-events:${organizationId}:${cursor || 'initial'}`;
    }

    private getOrganizationsByOwnerCacheKey(ownerId: string): string {
        return `organizations-by-owner:${ownerId}`;
    }

    private async invalidateOrganizationCache(id: string): Promise<void> {
        await CacheService.invalidateEventCache(this.getOrganizationCacheKey(id));
    }

    private async invalidateOrganizationEventsCache(organizationId: string): Promise<void> {
        const keys = await CacheService.getRedisClient()?.keys(`organization-events:${organizationId}:*`);
        if (keys && keys.length > 0) {
            await CacheService.getRedisClient()?.del(...keys);
        }
    }

    private async invalidateOrganizationsByOwnerCache(ownerId: string): Promise<void> {
        await CacheService.getRedisClient()?.del(this.getOrganizationsByOwnerCacheKey(ownerId));
    }

    async createOrganization(
        ownerId: string,
        name: string,
        description?: string,
        website?: string,
        contactEmail?: string,
        contactPhone?: string
    ) {
        // Create Stripe customer
        const stripeCustomer = await this.stripeService.stripe.customers.create({
            email: contactEmail,
            name,
            metadata: {
                ownerId,
            },
        });

        // Create subscription
        const subscription = await this.stripeService.stripe.subscriptions.create({
            customer: stripeCustomer.id,
            items: [{ price: process.env.STRIPE_ORGANIZATION_PRICE_ID }],
            payment_behavior: "default_incomplete",
            payment_settings: { save_default_payment_method: "on_subscription" },
            expand: ["latest_invoice.payment_intent"],
        });

        const organization = this.organizationRepository.create({
            name,
            description,
            website,
            contactEmail,
            contactPhone,
            ownerId,
            stripeCustomerId: stripeCustomer.id,
            stripeSubscriptionId: subscription.id,
            subscriptionEndDate: new Date((subscription as any).current_period_end * 1000),
            isActive: false, // Will be activated after payment
        });

        const savedOrganization = await this.organizationRepository.save(organization);

        // Invalidate owner's organizations cache
        await this.invalidateOrganizationsByOwnerCache(ownerId);

        return savedOrganization;
    }

    async getOrganizationById(id: string) {
        const cacheKey = this.getOrganizationCacheKey(id);

        // Try to get from cache first
        const cachedOrganization = await CacheService.getCachedEvent(cacheKey);
        if (cachedOrganization) {
            return cachedOrganization;
        }

        const organization = await this.organizationRepository.findOne({
            where: { id },
            relations: ["owner", "members", "events"],
        });

        if (organization) {
            // Cache the organization for 1 hour
            await CacheService.setCachedEvent(cacheKey, organization, 3600);
        }

        return organization;
    }

    async getOrganizationsByOwner(ownerId: string) {
        const cacheKey = this.getOrganizationsByOwnerCacheKey(ownerId);

        // Try to get from cache first
        const cachedOrganizations = await CacheService.getCachedEvent(cacheKey);
        if (cachedOrganizations) {
            return cachedOrganizations;
        }

        const organizations = await this.organizationRepository.find({
            where: { ownerId },
            relations: ["members", "events"],
        });

        // Cache the organizations for 1 hour
        await CacheService.setCachedEvent(cacheKey, organizations, 3600);

        return organizations;
    }

    async updateOrganization(
        id: string,
        updates: Partial<Organization>
    ) {
        await this.organizationRepository.update(id, updates);

        // Invalidate caches
        await this.invalidateOrganizationCache(id);
        const organization = await this.getOrganizationById(id);
        if (organization) {
            await this.invalidateOrganizationsByOwnerCache(organization.ownerId);
        }

        return organization;
    }

    async addMember(organizationId: string, userId: string) {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) throw new Error("User not found");

        user.organizationId = organizationId;
        const updatedUser = await this.userRepository.save(user);

        // Invalidate organization cache
        await this.invalidateOrganizationCache(organizationId);

        return updatedUser;
    }

    async removeMember(organizationId: string, userId: string) {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) throw new Error("User not found");

        user.organizationId = undefined;
        const updatedUser = await this.userRepository.save(user);

        // Invalidate organization cache
        await this.invalidateOrganizationCache(organizationId);

        return updatedUser;
    }

    async getOrganizationEvents(
        organizationId: string,
        options: { limit?: number; cursor?: string } = {}
    ): Promise<{ events: Event[]; nextCursor?: string }> {
        const { limit = 10, cursor } = options;
        const cacheKey = this.getOrganizationEventsCacheKey(organizationId, cursor);

        // Try to get from cache first
        const cachedEvents = await CacheService.getCachedEvent(cacheKey);
        if (cachedEvents) {
            return cachedEvents;
        }

        // Parse cursor if provided
        let cursorData: { createdAt: Date; id: string } | undefined;
        if (cursor) {
            try {
                const jsonStr = Buffer.from(cursor, "base64").toString("utf-8");
                cursorData = JSON.parse(jsonStr);
            } catch (e) {
                console.error("Invalid cursor format:", e);
            }
        }

        // Build query
        let queryBuilder = this.eventRepository
            .createQueryBuilder("event")
            .leftJoinAndSelect("event.categories", "categories")
            .leftJoinAndSelect("event.creator", "creator")
            .where("event.organizationId = :organizationId", { organizationId });

        // Add cursor conditions if cursor is provided
        if (cursorData) {
            queryBuilder = queryBuilder.andWhere(
                new Brackets((qb) => {
                    qb.where("event.createdAt < :createdAt", {
                        createdAt: cursorData.createdAt,
                    }).orWhere(
                        new Brackets((qb2) => {
                            qb2
                                .where("event.createdAt = :createdAt", {
                                    createdAt: cursorData.createdAt,
                                })
                                .andWhere("event.id < :id", {
                                    id: cursorData.id,
                                });
                        })
                    );
                })
            );
        }

        // Execute query
        const events = await queryBuilder
            .orderBy("event.createdAt", "DESC")
            .addOrderBy("event.id", "DESC")
            .take(limit + 1)
            .getMany();

        // Process results
        const hasMore = events.length > limit;
        const results = events.slice(0, limit);

        // Generate next cursor if we have more results
        let nextCursor: string | undefined;
        if (hasMore && results.length > 0) {
            const lastResult = results[results.length - 1];
            const cursorObj = {
                createdAt: lastResult.createdAt,
                id: lastResult.id,
            };
            nextCursor = Buffer.from(JSON.stringify(cursorObj)).toString("base64");
        }

        const result = {
            events: results,
            nextCursor,
        };

        // Cache the result for 5 minutes
        await CacheService.setCachedEvent(cacheKey, result, 300);

        return result;
    }

    async handleSubscriptionUpdate(subscription: Stripe.Subscription) {
        const organization = await this.organizationRepository.findOne({
            where: { stripeSubscriptionId: subscription.id },
        });

        if (!organization) return;

        organization.isActive = subscription.status === "active";
        organization.subscriptionEndDate = new Date((subscription as any).current_period_end * 1000);

        const updatedOrganization = await this.organizationRepository.save(organization);

        // Invalidate caches
        await this.invalidateOrganizationCache(organization.id);
        await this.invalidateOrganizationsByOwnerCache(organization.ownerId);

        return updatedOrganization;
    }

    async searchOrganizations(input: SearchOrganizationsInput): Promise<SearchOrganizationsResult> {
        const { query = "", limit = 10, cursor } = input;

        // Parse cursor if provided
        let cursorData: { createdAt: Date; id: string } | undefined;
        if (cursor) {
            try {
                const jsonStr = Buffer.from(cursor, "base64").toString("utf-8");
                cursorData = JSON.parse(jsonStr);
            } catch (e) {
                console.error("Invalid cursor format:", e);
            }
        }

        // Build query
        let queryBuilder = this.organizationRepository
            .createQueryBuilder("organization")
            .leftJoinAndSelect("organization.owner", "owner")
            .leftJoinAndSelect("organization.members", "members")
            .where(
                new Brackets((qb) => {
                    qb.where("LOWER(organization.name) LIKE LOWER(:query)", {
                        query: `%${query.toLowerCase()}%`,
                    })
                        .orWhere("LOWER(organization.description) LIKE LOWER(:query)", {
                            query: `%${query.toLowerCase()}%`,
                        })
                        .orWhere("LOWER(organization.website) LIKE LOWER(:query)", {
                            query: `%${query.toLowerCase()}%`,
                        });
                })
            );

        // Add cursor conditions if cursor is provided
        if (cursorData) {
            queryBuilder = queryBuilder.andWhere(
                new Brackets((qb) => {
                    qb.where("organization.createdAt < :createdAt", {
                        createdAt: cursorData.createdAt,
                    }).orWhere(
                        new Brackets((qb2) => {
                            qb2
                                .where("organization.createdAt = :createdAt", {
                                    createdAt: cursorData.createdAt,
                                })
                                .andWhere("organization.id < :id", {
                                    id: cursorData.id,
                                });
                        })
                    );
                })
            );
        }

        // Execute query
        const organizations = await queryBuilder
            .orderBy("organization.createdAt", "DESC")
            .addOrderBy("organization.id", "DESC")
            .take(limit + 1)
            .getMany();

        // Process results
        const hasMore = organizations.length > limit;
        const results = organizations.slice(0, limit);

        // Generate next cursor if we have more results
        let nextCursor: string | undefined;
        if (hasMore && results.length > 0) {
            const lastResult = results[results.length - 1];
            const cursorObj = {
                createdAt: lastResult.createdAt,
                id: lastResult.id,
            };
            nextCursor = Buffer.from(JSON.stringify(cursorObj)).toString("base64");
        }

        return {
            organizations: results,
            nextCursor,
        };
    }
} 