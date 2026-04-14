import type { BaseApiClient } from "../base/ApiClient";

export class UsersModule {
  constructor(protected readonly client: BaseApiClient) {}

  async sendLocation(lat: number, lng: number): Promise<void> {
    const url = `${this.client.baseUrl}/api/users/location`;
    const response = await this.client.fetchWithAuth(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lng, lat }),
    });

    if (!response.ok) {
      console.error("[LocationSender] API error:", response.status);
    }
  }
}
