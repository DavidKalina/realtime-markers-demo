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

export class DeckStatsModule {
  constructor(protected readonly client: BaseApiClient) {}

  async getStats(): Promise<DeckStatsResponse> {
    const url = `${this.client.baseUrl}/api/sidequests/deck-stats`;
    const response = await this.client.fetchWithAuth(url);
    return this.client.handleResponse<DeckStatsResponse>(response);
  }
}
