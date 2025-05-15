import { DataSource, Repository } from "typeorm";
import { User, PlanType } from "../entities/User";
import { subWeeks, isAfter } from "date-fns";

export class PlanService {
  private userRepository: Repository<User>;

  constructor(private dataSource: DataSource) {
    this.userRepository = dataSource.getRepository(User);
  }

  /**
   * Get the scan limit for a user based on their plan
   */
  getScanLimit(planType: PlanType): number {
    switch (planType) {
      case PlanType.PRO:
        return 100000;
      case PlanType.FREE:
      default:
        return 10000;
    }
  }

  /**
   * Check if a user has reached their scan limit
   */
  async hasReachedScanLimit(userId: string): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Reset weekly scan count if it's been a week since last reset
    if (user.lastScanReset) {
      const oneWeekAgo = subWeeks(new Date(), 1);
      if (isAfter(oneWeekAgo, user.lastScanReset)) {
        await this.resetWeeklyScanCount(userId);
        return false;
      }
    } else {
      // First time checking, set the reset date
      await this.userRepository.update(userId, {
        lastScanReset: new Date(),
      });
      return false;
    }

    const limit = this.getScanLimit(user.planType);
    return user.weeklyScanCount >= limit;
  }

  /**
   * Reset the weekly scan count for a user
   */
  async resetWeeklyScanCount(userId: string): Promise<void> {
    await this.userRepository.update(userId, {
      weeklyScanCount: 0,
      lastScanReset: new Date(),
    });
  }

  /**
   * Increment the weekly scan count for a user
   */
  async incrementWeeklyScanCount(userId: string): Promise<void> {
    await this.userRepository
      .createQueryBuilder()
      .update(User)
      .set({
        weeklyScanCount: () => "weekly_scan_count + 1",
      })
      .where("id = :userId", { userId })
      .execute();
  }

  /**
   * Get plan details for a user
   */
  async getPlanDetails(userId: string): Promise<{
    planType: PlanType;
    weeklyScanCount: number;
    scanLimit: number;
    remainingScans: number;
    lastReset: Date | null;
  }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const scanLimit = this.getScanLimit(user.planType);
    const remainingScans = Math.max(0, scanLimit - user.weeklyScanCount);

    return {
      planType: user.planType,
      weeklyScanCount: user.weeklyScanCount,
      scanLimit,
      remainingScans,
      lastReset: user.lastScanReset || null,
    };
  }

  /**
   * Update a user's plan
   */
  async updatePlan(userId: string, planType: PlanType): Promise<void> {
    await this.userRepository.update(userId, {
      planType,
    });
  }
}
