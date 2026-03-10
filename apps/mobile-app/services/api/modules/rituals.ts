import { BaseApiModule } from "../base/BaseApiModule";
import { BaseApiClient } from "../base/ApiClient";

export interface RitualResponse {
  id: string;
  name: string;
  emoji: string;
  budgetMin: number;
  budgetMax: number;
  durationHours: number;
  activityTypes: string[];
  stopCount: number;
  categoryNames: string[];
  usageCount: number;
  lastUsedAt?: string;
  createdAt: string;
}

export interface CreateRitualParams {
  name: string;
  emoji?: string;
  budgetMin?: number;
  budgetMax?: number;
  durationHours: number;
  activityTypes?: string[];
  stopCount?: number;
  categoryNames?: string[];
}

export interface UpdateRitualParams {
  name?: string;
  emoji?: string;
  budgetMin?: number;
  budgetMax?: number;
  durationHours?: number;
  activityTypes?: string[];
  stopCount?: number;
  categoryNames?: string[];
}

export class RitualsModule extends BaseApiModule {
  constructor(client: BaseApiClient) {
    super(client);
  }

  async create(params: CreateRitualParams): Promise<RitualResponse> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/rituals`,
      {
        method: "POST",
        body: JSON.stringify(params),
        headers: { "Content-Type": "application/json" },
      },
    );
    return this.handleResponse<RitualResponse>(response);
  }

  async list(): Promise<RitualResponse[]> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/rituals`,
    );
    return this.handleResponse<RitualResponse[]>(response);
  }

  async getById(id: string): Promise<RitualResponse> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/rituals/${id}`,
    );
    return this.handleResponse<RitualResponse>(response);
  }

  async update(
    id: string,
    params: UpdateRitualParams,
  ): Promise<RitualResponse> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/rituals/${id}`,
      {
        method: "PUT",
        body: JSON.stringify(params),
        headers: { "Content-Type": "application/json" },
      },
    );
    return this.handleResponse<RitualResponse>(response);
  }

  async deleteById(id: string): Promise<void> {
    const response = await this.fetchWithAuth(
      `${this.client.baseUrl}/api/rituals/${id}`,
      { method: "DELETE" },
    );
    await this.handleResponse(response);
  }
}
