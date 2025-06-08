import { BaseApiModule } from "../base/BaseApiModule";
import { BaseApiClient } from "../base/ApiClient";
import { Plan, PlanCreateInput, PlanUpdateInput } from "../base/types";
import { apiClient } from "../../ApiClient";

export enum PlanType {
  FREE = "FREE",
  PRO = "PRO",
}

export interface PlanDetails {
  planType: PlanType;
  weeklyScanCount: number;
  scanLimit: number;
  remainingScans: number;
  lastReset: string | null;
  features: PlanFeature[];
  price?: {
    amount: number;
    currency: string;
    interval: "MONTHLY" | "YEARLY";
  };
  trialEndsAt?: string;
  cancelAtPeriodEnd?: boolean;
  status: "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED" | "EXPIRED";
}

export interface PlanFeature {
  id: string;
  name: string;
  description: string;
  included: boolean;
  limit?: number;
  usage?: number;
}

export interface PlanUsage {
  scans: {
    total: number;
    remaining: number;
    resetAt: string;
  };
  events: {
    created: number;
    limit: number;
  };
  storage: {
    used: number;
    limit: number;
    unit: "MB" | "GB";
  };
}

export interface PlanChangeRequest {
  newPlanType: PlanType;
  interval: "MONTHLY" | "YEARLY";
  paymentMethodId?: string;
}

export interface PlanChangeResponse {
  success: boolean;
  message: string;
  newPlan: PlanDetails;
  requiresAction?: boolean;
  actionUrl?: string;
}

export class PlansModule extends BaseApiModule {
  constructor(client: BaseApiClient) {
    super(client);
  }

  async getPlans(): Promise<Plan[]> {
    const url = `${this.client.baseUrl}/api/plans`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<Plan[]>(response);
  }

  async getPlan(id: string): Promise<Plan> {
    const url = `${this.client.baseUrl}/api/plans/${id}`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<Plan>(response);
  }

  async createPlan(input: PlanCreateInput): Promise<Plan> {
    const url = `${this.client.baseUrl}/api/plans`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify(input),
    });
    return this.handleResponse<Plan>(response);
  }

  async updatePlan(id: string, input: PlanUpdateInput): Promise<Plan> {
    const url = `${this.client.baseUrl}/api/plans/${id}`;
    const response = await this.fetchWithAuth(url, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    return this.handleResponse<Plan>(response);
  }

  async deletePlan(id: string): Promise<void> {
    const url = `${this.client.baseUrl}/api/plans/${id}`;
    const response = await this.fetchWithAuth(url, {
      method: "DELETE",
    });
    await this.handleResponse<void>(response);
  }

  async getPlansByEvent(eventId: string): Promise<Plan[]> {
    const url = `${this.client.baseUrl}/api/events/${eventId}/plans`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<Plan[]>(response);
  }

  async getPlansByUser(userId: string): Promise<Plan[]> {
    const url = `${this.client.baseUrl}/api/users/${userId}/plans`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<Plan[]>(response);
  }

  /**
   * Get current plan details
   * @returns Current plan details
   */
  async getPlanDetails(): Promise<PlanDetails> {
    const url = `${this.client.baseUrl}/api/plans`;

    const response = await this.fetchWithAuth(url);

    const data = await this.handleResponse<PlanDetails>(response);

    return data;
  }

  /**
   * Get plan usage statistics
   * @returns Current plan usage
   */
  async getPlanUsage(): Promise<PlanUsage> {
    const url = `${this.client.baseUrl}/api/plans/usage`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<PlanUsage>(response);
  }

  /**
   * Get available plans and features
   * @returns Array of available plans with their features
   */
  async getAvailablePlans(): Promise<{
    plans: Array<{
      type: PlanType;
      name: string;
      description: string;
      features: PlanFeature[];
      prices: Array<{
        amount: number;
        currency: string;
        interval: "MONTHLY" | "YEARLY";
      }>;
    }>;
    currentPlan?: PlanType;
  }> {
    const url = `${this.client.baseUrl}/api/plans/available`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<{
      plans: Array<{
        type: PlanType;
        name: string;
        description: string;
        features: PlanFeature[];
        prices: Array<{
          amount: number;
          currency: string;
          interval: "MONTHLY" | "YEARLY";
        }>;
      }>;
      currentPlan?: PlanType;
    }>(response);
  }

  /**
   * Change the current plan
   * @param request - Plan change request details
   * @returns Plan change response
   */
  async changePlan(request: PlanChangeRequest): Promise<PlanChangeResponse> {
    const url = `${this.client.baseUrl}/api/plans/change`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify(request),
    });
    return this.handleResponse<PlanChangeResponse>(response);
  }

  /**
   * Cancel the current plan
   * @param cancelAtPeriodEnd - Whether to cancel at the end of the current period
   * @returns Success status and message
   */
  async cancelPlan(cancelAtPeriodEnd: boolean = true): Promise<{
    success: boolean;
    message: string;
    cancelAt: string;
  }> {
    const url = `${this.client.baseUrl}/api/plans/cancel`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      body: JSON.stringify({ cancelAtPeriodEnd }),
    });
    return this.handleResponse<{
      success: boolean;
      message: string;
      cancelAt: string;
    }>(response);
  }

  /**
   * Resume a canceled plan
   * @returns Success status and message
   */
  async resumePlan(): Promise<{
    success: boolean;
    message: string;
    plan: PlanDetails;
  }> {
    const url = `${this.client.baseUrl}/api/plans/resume`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
    });
    return this.handleResponse<{
      success: boolean;
      message: string;
      plan: PlanDetails;
    }>(response);
  }

  /**
   * Get billing history
   * @param options - Pagination options
   * @returns Billing history with pagination info
   */
  async getBillingHistory(options?: {
    limit?: number;
    cursor?: string;
  }): Promise<{
    invoices: Array<{
      id: string;
      amount: number;
      currency: string;
      status: "PAID" | "PENDING" | "FAILED";
      createdAt: string;
      paidAt?: string;
      periodStart: string;
      periodEnd: string;
      items: Array<{
        description: string;
        amount: number;
        quantity: number;
      }>;
    }>;
    nextCursor?: string;
  }> {
    const queryParams = new URLSearchParams();

    if (options?.limit) queryParams.append("limit", options.limit.toString());
    if (options?.cursor) queryParams.append("cursor", options.cursor);

    const url = `${this.client.baseUrl}/api/plans/billing/history?${queryParams.toString()}`;
    const response = await this.fetchWithAuth(url);

    return this.handleResponse<{
      invoices: Array<{
        id: string;
        amount: number;
        currency: string;
        status: "PAID" | "PENDING" | "FAILED";
        createdAt: string;
        paidAt?: string;
        periodStart: string;
        periodEnd: string;
        items: Array<{
          description: string;
          amount: number;
          quantity: number;
        }>;
      }>;
      nextCursor?: string;
    }>(response);
  }

  /**
   * Get upcoming invoice preview
   * @returns Preview of the next invoice
   */
  async getUpcomingInvoice(): Promise<{
    amount: number;
    currency: string;
    periodStart: string;
    periodEnd: string;
    items: Array<{
      description: string;
      amount: number;
      quantity: number;
    }>;
  }> {
    const url = `${this.client.baseUrl}/api/plans/billing/upcoming`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<{
      amount: number;
      currency: string;
      periodStart: string;
      periodEnd: string;
      items: Array<{
        description: string;
        amount: number;
        quantity: number;
      }>;
    }>(response);
  }
}

// Export as singleton using the main ApiClient instance
export const plansModule = new PlansModule(apiClient);
export default plansModule;
