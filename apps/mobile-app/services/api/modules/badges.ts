import { BaseApiModule } from "../base/BaseApiModule";
import type { BaseApiClient } from "../base/ApiClient";

export interface UserBadge {
  badgeId: string;
  name: string;
  emoji: string;
  description: string;
  threshold: number;
  progress: number;
  unlockedAt: string | null;
}

export class BadgesModule extends BaseApiModule {
  constructor(client: BaseApiClient) {
    super(client);
  }

  async getMyBadges(): Promise<UserBadge[]> {
    const url = `${this.client.baseUrl}/api/users/me/badges`;
    const response = await this.fetchWithAuth(url);
    return this.handleResponse<UserBadge[]>(response);
  }
}
