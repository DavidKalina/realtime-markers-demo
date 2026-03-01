import type { DataSource } from "typeorm";
import { User, UserFollow } from "@realtime-markers/database";

interface FollowServiceDependencies {
  dataSource: DataSource;
}

export interface FollowService {
  toggleFollow(
    followerId: string,
    followingId: string,
  ): Promise<{
    following: boolean;
    followerCount: number;
    followingCount: number;
  }>;
  isFollowing(followerId: string, followingId: string): Promise<boolean>;
  getFollowerIds(userId: string): Promise<string[]>;
  getFollowers(
    userId: string,
    options: { limit?: number; cursor?: string },
  ): Promise<{ users: Partial<User>[]; nextCursor?: string }>;
  getFollowing(
    userId: string,
    options: { limit?: number; cursor?: string },
  ): Promise<{ users: Partial<User>[]; nextCursor?: string }>;
}

export function createFollowService(
  deps: FollowServiceDependencies,
): FollowService {
  const { dataSource } = deps;

  async function toggleFollow(
    followerId: string,
    followingId: string,
  ): Promise<{
    following: boolean;
    followerCount: number;
    followingCount: number;
  }> {
    if (followerId === followingId) {
      throw new Error("Cannot follow yourself");
    }

    return dataSource.transaction(async (em) => {
      const follower = await em.findOne(User, { where: { id: followerId } });
      if (!follower) {
        throw new Error("Follower user not found");
      }

      const followedUser = await em.findOne(User, {
        where: { id: followingId },
      });
      if (!followedUser) {
        throw new Error("User to follow not found");
      }

      const existing = await em.findOne(UserFollow, {
        where: { followerId, followingId },
      });

      let following: boolean;

      if (existing) {
        await em.remove(existing);
        follower.followingCount = Math.max(0, follower.followingCount - 1);
        followedUser.followerCount = Math.max(
          0,
          followedUser.followerCount - 1,
        );
        following = false;
      } else {
        const newFollow = em.create(UserFollow, { followerId, followingId });
        await em.save(newFollow);
        follower.followingCount = (follower.followingCount || 0) + 1;
        followedUser.followerCount = (followedUser.followerCount || 0) + 1;
        following = true;
      }

      await em.save(follower);
      await em.save(followedUser);

      return {
        following,
        followerCount: followedUser.followerCount,
        followingCount: followedUser.followingCount,
      };
    });
  }

  async function isFollowing(
    followerId: string,
    followingId: string,
  ): Promise<boolean> {
    const repo = dataSource.getRepository(UserFollow);
    const count = await repo.count({ where: { followerId, followingId } });
    return count > 0;
  }

  async function getFollowerIds(userId: string): Promise<string[]> {
    const repo = dataSource.getRepository(UserFollow);
    const follows = await repo.find({
      where: { followingId: userId },
      select: ["followerId"],
    });
    return follows.map((f) => f.followerId);
  }

  async function getFollowers(
    userId: string,
    options: { limit?: number; cursor?: string },
  ): Promise<{ users: Partial<User>[]; nextCursor?: string }> {
    const limit = Math.min(options.limit || 20, 50);
    const repo = dataSource.getRepository(UserFollow);

    const qb = repo
      .createQueryBuilder("follow")
      .leftJoinAndSelect("follow.follower", "user")
      .where("follow.followingId = :userId", { userId })
      .orderBy("follow.createdAt", "DESC")
      .take(limit + 1);

    if (options.cursor) {
      qb.andWhere("follow.createdAt < :cursor", {
        cursor: new Date(options.cursor),
      });
    }

    const follows = await qb.getMany();
    const hasMore = follows.length > limit;
    if (hasMore) follows.pop();

    const users = follows.map((f) => ({
      id: f.follower.id,
      firstName: f.follower.firstName,
      lastName: f.follower.lastName,
      avatarUrl: f.follower.avatarUrl,
      currentTier: f.follower.currentTier,
      totalXp: f.follower.totalXp,
      discoveryCount: f.follower.discoveryCount,
    }));

    return {
      users,
      nextCursor: hasMore
        ? follows[follows.length - 1].createdAt.toISOString()
        : undefined,
    };
  }

  async function getFollowing(
    userId: string,
    options: { limit?: number; cursor?: string },
  ): Promise<{ users: Partial<User>[]; nextCursor?: string }> {
    const limit = Math.min(options.limit || 20, 50);
    const repo = dataSource.getRepository(UserFollow);

    const qb = repo
      .createQueryBuilder("follow")
      .leftJoinAndSelect("follow.followedUser", "user")
      .where("follow.followerId = :userId", { userId })
      .orderBy("follow.createdAt", "DESC")
      .take(limit + 1);

    if (options.cursor) {
      qb.andWhere("follow.createdAt < :cursor", {
        cursor: new Date(options.cursor),
      });
    }

    const follows = await qb.getMany();
    const hasMore = follows.length > limit;
    if (hasMore) follows.pop();

    const users = follows.map((f) => ({
      id: f.followedUser.id,
      firstName: f.followedUser.firstName,
      lastName: f.followedUser.lastName,
      avatarUrl: f.followedUser.avatarUrl,
      currentTier: f.followedUser.currentTier,
      totalXp: f.followedUser.totalXp,
      discoveryCount: f.followedUser.discoveryCount,
    }));

    return {
      users,
      nextCursor: hasMore
        ? follows[follows.length - 1].createdAt.toISOString()
        : undefined,
    };
  }

  return {
    toggleFollow,
    isFollowing,
    getFollowerIds,
    getFollowers,
    getFollowing,
  };
}
