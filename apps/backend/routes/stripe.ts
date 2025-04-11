import { Hono } from "hono";
import { z } from "zod";
import { StripeService } from "../services/StripeService";
import type { AppContext } from "../types/context";
import { authMiddleware } from "../middleware/authMiddleware";

const stripeRouter = new Hono<AppContext>();

// Apply auth middleware to all Stripe routes except webhook
stripeRouter.use("*", async (c, next) => {
  // Skip auth for webhook endpoint
  if (c.req.path.endsWith("/webhook")) {
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

  console.log({ userId });

  // Check for required environment variable
  const appUrl = `https://4cdbc404d515.ngrok.app`;
  if (!appUrl) {
    console.error("APP_URL environment variable is not set");
    return c.json({ error: "Server configuration error" }, 500);
  }

  // Ensure the URL starts with http or https
  const baseUrl = appUrl.startsWith('http') ? appUrl : `https://${appUrl}`;

  try {
    const stripeService = new StripeService();
    const session = await stripeService.createCheckoutSession(
      userId,
      `${baseUrl}/user?status=success`,
      `${baseUrl}/user?status=cancel`
    );

    if (!session.url) {
      console.error("No checkout URL in session:", session);
      return c.json({ error: "Failed to create checkout session" }, 500);
    }

    console.log("Session created:", {
      id: session.id,
      url: session.url
    });

    // For subscription mode, we return the checkout URL
    return c.json({
      checkoutUrl: session.url,
      sessionId: session.id
    });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return c.json({ error: "Failed to create checkout session" }, 500);
  }
});

// Handle Stripe webhooks
stripeRouter.post("/webhook", async (c) => {
  const stripeService = new StripeService();
  const signature = c.req.header("stripe-signature");

  console.log("signature", signature);

  if (!signature) {
    console.error("No signature in webhook request");
    return c.json({ error: "No signature" }, 400);
  }

  try {
    const payload = await c.req.text();
    console.log("Webhook payload:", payload);

    const event = await stripeService.stripe.webhooks.constructEventAsync(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    console.log("Webhook event type:", event.type);
    await stripeService.handleWebhookEvent(event);
    return c.json({ received: true });
  } catch (error) {
    console.error("Error handling webhook:", error);
    return c.json({ error: "Webhook error" }, 400);
  }
});

export default stripeRouter;
