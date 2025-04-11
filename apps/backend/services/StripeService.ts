import Stripe from "stripe";
import { PlanService } from "./PlanService";
import { PlanType } from "../entities/User";
import dataSource from "../data-source";

export class StripeService {
  public stripe: Stripe;
  private planService: PlanService;

  constructor() {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-03-31.basil",
    });
    this.planService = new PlanService(dataSource);
  }

  /**
   * Create a checkout session for upgrading to PRO
   */
  async createCheckoutSession(userId: string, successUrl: string, cancelUrl: string) {
    if (!process.env.STRIPE_PRICE_ID) {
      throw new Error("STRIPE_PRICE_ID is not set");
    }

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId,
      },
    });

    return session;
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhookEvent(event: Stripe.Event) {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;

        if (userId) {
          await this.planService.updatePlan(userId, PlanType.PRO);
        }
        break;
      }
      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        const customer = await this.stripe.customers.retrieve(subscription.customer as string) as Stripe.Customer;
        const userId = customer.metadata?.userId;

        if (userId) {
          await this.planService.updatePlan(userId, PlanType.PRO);
        }
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customer = await this.stripe.customers.retrieve(subscription.customer as string) as Stripe.Customer;
        const userId = customer.metadata?.userId;

        if (userId) {
          await this.planService.updatePlan(userId, PlanType.FREE);
        }
        break;
      }
    }
  }
}
