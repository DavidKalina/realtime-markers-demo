import { Hono } from "hono";
import { z } from "zod";
import { StripeService } from "../services/StripeService";
import type { AppContext } from "../types/context";
import { authMiddleware } from "../middleware/authMiddleware";

const stripeRouter = new Hono<AppContext>();

// Apply auth middleware to all Stripe routes except webhook
stripeRouter.use("*", async (c, next) => {
  // Skip auth for webhook endpoint
  if (c.req.path === "/webhook") {
    return next();
  }
  return authMiddleware(c, next);
});

// Create checkout session
stripeRouter.post("/create-checkout-session", async (c) => {
  const userId = c.get("user")?.userId;
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const schema = z.object({
    successUrl: z.string().url(),
    cancelUrl: z.string().url(),
  });

  try {
    const body = await c.req.json();
    const { successUrl, cancelUrl } = schema.parse(body);

    const stripeService = new StripeService();
    const session = await stripeService.createCheckoutSession(userId, successUrl, cancelUrl);

    return c.json({ sessionId: session.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Invalid request body", details: error.errors }, 400);
    }
    console.error("Error creating checkout session:", error);
    return c.json({ error: "Failed to create checkout session" }, 500);
  }
});

// Handle Stripe webhooks
stripeRouter.post("/webhook", async (c) => {
  const stripeService = new StripeService();
  const signature = c.req.header("stripe-signature");

  if (!signature) {
    return c.json({ error: "No signature" }, 400);
  }

  try {
    const event = stripeService.stripe.webhooks.constructEvent(
      await c.req.text(),
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    await stripeService.handleWebhookEvent(event);
    return c.json({ received: true });
  } catch (error) {
    console.error("Error handling webhook:", error);
    return c.json({ error: "Webhook error" }, 400);
  }
});

export default stripeRouter;
