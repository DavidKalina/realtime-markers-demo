import { BaseApiModule } from "../base/BaseApiModule";
import type { BaseApiClient } from "../base/ApiClient";

export interface DeckStatsResponse {
  totalCards: number;
  cardsPlayed: number;
  cardsActive: number;
  cardsInDeck: number;
  newThisWeek: number;
  byTier: { tier: string; label: string; count: number }[];
  byStatus: { status: string; label: string; count: number }[];
  recentCards: { name: string; tier: string; daysAgo: number }[];
}

export class DeckStatsModule extends BaseApiModule {
  constructor(client: BaseApiClient) {
    super(client);
  }

  async getStats(): Promise<DeckStatsResponse> {
    const url = `${this.client.baseUrl}/api/sidequests/deck-stats`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<DeckStatsResponse>(response);
  }
}
