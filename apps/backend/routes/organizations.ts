import { Hono } from "hono";
import { z } from "zod";
import { initializeDatabase } from "../data-source";
import { authMiddleware } from "../middleware/authMiddleware";
import { OrganizationService } from "../services/OrganizationService";
import { StripeService } from "../services/StripeService";
import type { AppContext } from "../types/context";

const organizationSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    website: z.string().url().optional(),
    contactEmail: z.string().email().optional(),
    contactPhone: z.string().optional(),
});

const router = new Hono<AppContext>();

// Initialize database connection
let dataSource: Awaited<ReturnType<typeof initializeDatabase>>;

// Create organization
router.post("/", authMiddleware, async (c) => {
    const user = c.get("user")
    const userId = user?.userId
    const data = await c.req.json();
    const validatedData = organizationSchema.parse(data);

    if (!userId) {
        return c.json({ error: "User not found" }, 404);
    }

    // Initialize dataSource if not already initialized
    if (!dataSource) {
        dataSource = await initializeDatabase();
    }

    const organizationService = new OrganizationService(dataSource);
    const organization = await organizationService.createOrganization(
        userId,
        validatedData.name,
        validatedData.description,
        validatedData.website,
        validatedData.contactEmail,
        validatedData.contactPhone
    );

    // Create Stripe checkout session
    const stripeService = new StripeService();
    const appUrl = process.env.APP_URL || "https://mapmoji.app";
    const successUrl = `${appUrl}/organizations/${organization.id}?status=success`;
    const cancelUrl = `${appUrl}/organizations/${organization.id}?status=cancel`;

    const session = await stripeService.createCheckoutSession(
        userId,
        successUrl,
        cancelUrl
    );

    return c.json({
        organization,
        checkoutUrl: session.url,
        sessionId: session.id
    });
});

// Get organization by ID
router.get("/:id", authMiddleware, async (c) => {
    const id = c.req.param("id");

    // Initialize dataSource if not already initialized
    if (!dataSource) {
        dataSource = await initializeDatabase();
    }

    const organizationService = new OrganizationService(dataSource);
    const organization = await organizationService.getOrganizationById(id);

    if (!organization) {
        return c.json({ error: "Organization not found" }, 404);
    }

    return c.json(organization);
});

// Get organizations by owner
router.get("/owner/:ownerId", authMiddleware, async (c) => {
    const ownerId = c.req.param("ownerId");

    // Initialize dataSource if not already initialized
    if (!dataSource) {
        dataSource = await initializeDatabase();
    }

    const organizationService = new OrganizationService(dataSource);
    const organizations = await organizationService.getOrganizationsByOwner(ownerId);

    return c.json(organizations);
});

// Update organization
router.patch("/:id", authMiddleware, async (c) => {
    const id = c.req.param("id");
    const data = await c.req.json();
    const validatedData = organizationSchema.partial().parse(data);

    // Initialize dataSource if not already initialized
    if (!dataSource) {
        dataSource = await initializeDatabase();
    }

    const organizationService = new OrganizationService(dataSource);
    const organization = await organizationService.updateOrganization(id, validatedData);

    if (!organization) {
        return c.json({ error: "Organization not found" }, 404);
    }

    return c.json(organization);
});

// Add member to organization
router.post("/:id/members/:userId", authMiddleware, async (c) => {
    const { id, userId } = c.req.param();

    // Initialize dataSource if not already initialized
    if (!dataSource) {
        dataSource = await initializeDatabase();
    }

    const organizationService = new OrganizationService(dataSource);
    const user = await organizationService.addMember(id, userId);

    return c.json(user);
});

// Remove member from organization
router.delete("/:id/members/:userId", authMiddleware, async (c) => {
    const { id, userId } = c.req.param();

    // Initialize dataSource if not already initialized
    if (!dataSource) {
        dataSource = await initializeDatabase();
    }

    const organizationService = new OrganizationService(dataSource);
    const user = await organizationService.removeMember(id, userId);

    return c.json(user);
});

// Search organizations
router.get("/search", async (c) => {
    const query = c.req.query("q") || "";
    const limit = parseInt(c.req.query("limit") || "10");
    const cursor = c.req.query("cursor");

    // Initialize dataSource if not already initialized
    if (!dataSource) {
        dataSource = await initializeDatabase();
    }

    const organizationService = new OrganizationService(dataSource);
    const result = await organizationService.searchOrganizations({
        query,
        limit,
        cursor,
    });

    return c.json(result);
});

// Get organization events with pagination
router.get("/:id/events", authMiddleware, async (c) => {
    const organizationId = c.req.param("id");
    const limit = parseInt(c.req.query("limit") || "10");
    const cursor = c.req.query("cursor");

    // Initialize dataSource if not already initialized
    if (!dataSource) {
        dataSource = await initializeDatabase();
    }

    const organizationService = new OrganizationService(dataSource);
    const result = await organizationService.getOrganizationEvents(organizationId, {
        limit,
        cursor,
    });

    return c.json(result);
});

export default router; 