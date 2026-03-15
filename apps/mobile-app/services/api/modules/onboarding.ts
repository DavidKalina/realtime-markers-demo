import { BaseApiModule } from "../base/BaseApiModule";

export interface OnboardingProfile {
  activities: string[];
  vibes: string[];
  idealDay: string;
  pace: string;
}

export class OnboardingModule extends BaseApiModule {
  async submitOnboardingProfile(
    payload: OnboardingProfile,
  ): Promise<{ success: boolean }> {
    const url = `${this.client.baseUrl}/api/users/me/onboarding-profile`;
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return this.handleResponse<{ success: boolean }>(response);
  }
}
