// src/services/GroupService.ts

import { In, Repository, DataSource } from "typeorm";
import { User } from "../entities/User";
import { Group, GroupVisibility } from "../entities/Group";
import {
  GroupMembership,
  GroupMemberRole,
  GroupMembershipStatus,
} from "../entities/GroupMembership";
import { Category } from "../entities/Category";
import { Event } from "../entities/Event";
import { OpenAIService, OpenAIModel } from "./shared/OpenAIService"; // Reusing from AuthService for content moderation
import type { CreateGroupDto, UpdateGroupDto } from "../dtos/group.dto";
import { CacheService } from "./shared/CacheService";
import { Like } from "typeorm";
import { Brackets } from "typeorm";

interface CursorPaginationParams {
  cursor?: string;
  limit?: number;
  direction?: "forward" | "backward";
}

interface SearchGroupsParams extends CursorPaginationParams {
  query: string;
  categoryId?: string;
}

interface GetGroupEventsParams extends CursorPaginationParams {
  query?: string;
  categoryId?: string;
  startDate?: Date;
  endDate?: Date;
}

export class GroupService {
  private userRepository: Repository<User>;
  private groupRepository: Repository<Group>;
  private groupMembershipRepository: Repository<GroupMembership>;
  private categoryRepository: Repository<Category>;
  private eventRepository: Repository<Event>;
  private dataSource: DataSource;

  private static readonly GROUP_CACHE_TTL = 300; // 5 minutes
  private static readonly GROUP_SEARCH_CACHE_TTL = 60; // 1 minute
  private static readonly GROUP_MEMBERS_CACHE_TTL = 300; // 5 minutes

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
    this.userRepository = dataSource.getRepository(User);
    this.groupRepository = dataSource.getRepository(Group);
    this.groupMembershipRepository = dataSource.getRepository(GroupMembership);
    this.categoryRepository = dataSource.getRepository(Category);
    this.eventRepository = dataSource.getRepository(Event);
  }

  private async isContentAppropriate(content: string): Promise<boolean> {
    // Re-using the content moderation logic from AuthService
    // You might want to move this to a shared utility if used in many places
    try {
      const prompt = `Please analyze if the following content is appropriate for a general audience platform. Consider:
1. No profanity or offensive language
2. No hate speech or discriminatory content
3. No impersonation of public figures
4. No explicit sexual content
5. No promotion of harmful activities

Content to analyze: "${content}"

Respond with a JSON object containing:
{
  "isAppropriate": boolean,
  "reason": string
}`;

      const response = await OpenAIService.executeChatCompletion({
        model: OpenAIModel.GPT4OMini, // Or your preferred model
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0].message.content);
      return result.isAppropriate;
    } catch (error) {
      console.error("Error checking content appropriateness:", error);
      return true; // Default to true if moderation fails
    }
  }

  private getGroupCacheKey(groupId: string): string {
    return `group:${groupId}`;
  }

  private getGroupMembersCacheKey(groupId: string, status: GroupMembershipStatus): string {
    return `group:${groupId}:members:${status}`;
  }

  private getGroupSearchCacheKey(params: SearchGroupsParams): string {
    const { query, categoryId, cursor, limit, direction } = params;
    return `group:search:${query}:${categoryId || "all"}:${cursor || "start"}:${limit || 10}:${
      direction || "forward"
    }`;
  }

  private getGroupEventsCacheKey(groupId: string, params: GetGroupEventsParams): string {
    const { query, categoryId, cursor, limit, direction, startDate, endDate } = params;
    return `group:${groupId}:events:${query || "all"}:${categoryId || "all"}:${cursor || "start"}:${
      limit || 10
    }:${direction || "forward"}:${startDate?.toISOString() || "all"}:${
      endDate?.toISOString() || "all"
    }`;
  }

  async createGroup(userId: string, groupData: CreateGroupDto): Promise<Group> {
    const owner = await this.userRepository.findOneBy({ id: userId });
    if (!owner) {
      throw new Error("Owner user not found");
    }

    if (!(await this.isContentAppropriate(groupData.name))) {
      throw new Error("Group name contains inappropriate content.");
    }
    if (groupData.description && !(await this.isContentAppropriate(groupData.description))) {
      throw new Error("Group description contains inappropriate content.");
    }

    // Check for existing group with the same name (optional, but good for uniqueness)
    const existingGroup = await this.groupRepository.findOneBy({ name: groupData.name });
    if (existingGroup) {
      throw new Error(`A group with the name "${groupData.name}" already exists.`);
    }

    let categories: Category[] = [];
    if (groupData.categoryIds && groupData.categoryIds.length > 0) {
      categories = await this.categoryRepository.findBy({ id: In(groupData.categoryIds) });
    }

    return this.dataSource.transaction(async (transactionalEntityManager) => {
      const group = transactionalEntityManager.create(Group, {
        ...groupData,
        ownerId: userId,
        owner: owner,
        categories: categories,
        visibility: groupData.visibility || GroupVisibility.PUBLIC,
        memberCount: 1, // Starts with the owner
      });
      const savedGroup = await transactionalEntityManager.save(group);

      const membership = transactionalEntityManager.create(GroupMembership, {
        userId: userId,
        groupId: savedGroup.id,
        user: owner,
        group: savedGroup,
        role: GroupMemberRole.ADMIN, // Owner is an ADMIN by default
        status: GroupMembershipStatus.APPROVED,
      });
      await transactionalEntityManager.save(membership);

      await this.invalidateGroupCaches(savedGroup.id);
      return savedGroup;
    });
  }

  async getGroupById(
    groupId: string,
    relations: string[] = ["owner", "categories", "memberships", "memberships.user"]
  ): Promise<Group | null> {
    const cacheKey = this.getGroupCacheKey(groupId);
    const cached = await CacheService.getCachedData(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const group = await this.groupRepository.findOne({
      where: { id: groupId },
      relations,
    });

    if (group) {
      await CacheService.setCachedData(
        cacheKey,
        JSON.stringify(group),
        GroupService.GROUP_CACHE_TTL
      );
    }

    return group;
  }

  async getPublicGroupById(groupId: string): Promise<Group | null> {
    return this.groupRepository.findOne({
      where: { id: groupId, visibility: GroupVisibility.PUBLIC },
      relations: ["owner", "categories"], // Limit relations for public view
    });
  }

  async isUserMember(groupId: string, userId: string): Promise<boolean> {
    const membership = await this.groupMembershipRepository.findOneBy({
      groupId,
      userId,
      status: GroupMembershipStatus.APPROVED,
    });
    return !!membership;
  }

  async getUserRoleInGroup(groupId: string, userId: string): Promise<GroupMemberRole | null> {
    const membership = await this.groupMembershipRepository.findOneBy({
      groupId,
      userId,
      status: GroupMembershipStatus.APPROVED,
    });
    return membership ? membership.role : null;
  }

  async updateGroup(
    groupId: string,
    userId: string,
    updateData: UpdateGroupDto
  ): Promise<Group | null> {
    const group = await this.groupRepository.findOne({
      where: { id: groupId },
      relations: ["owner"],
    });
    if (!group) {
      throw new Error("Group not found");
    }

    const userRole = await this.getUserRoleInGroup(groupId, userId);
    if (group.ownerId !== userId && userRole !== GroupMemberRole.ADMIN) {
      throw new Error("User is not authorized to update this group");
    }

    if (updateData.name && !(await this.isContentAppropriate(updateData.name))) {
      throw new Error("Group name contains inappropriate content.");
    }
    if (updateData.description && !(await this.isContentAppropriate(updateData.description))) {
      throw new Error("Group description contains inappropriate content.");
    }

    // Handle categories update
    if (updateData.categoryIds) {
      if (updateData.categoryIds.length > 0) {
        group.categories = await this.categoryRepository.findBy({ id: In(updateData.categoryIds) });
      } else {
        group.categories = []; // Clear categories if an empty array is passed
      }
    }
    // Remove categoryIds from updateData to prevent TypeORM from trying to set it directly
    const { categoryIds, ...restOfUpdateData } = updateData;

    await this.groupRepository.update(groupId, restOfUpdateData);
    // If categories were part of updateData, save the group entity to persist ManyToMany relation changes
    if (updateData.categoryIds) {
      await this.groupRepository.save(group);
    }
    await this.invalidateGroupCaches(groupId);
    return this.getGroupById(groupId);
  }

  async deleteGroup(groupId: string, userId: string): Promise<boolean> {
    const group = await this.groupRepository.findOneBy({ id: groupId });
    if (!group) {
      throw new Error("Group not found");
    }

    if (group.ownerId !== userId) {
      throw new Error("Only the group owner can delete the group");
    }

    // Transaction to ensure all related data is deleted or handled
    return this.dataSource.transaction(async (transactionalEntityManager) => {
      // Optional: Set groupId to null for events belonging to this group
      await transactionalEntityManager.update(Event, { groupId: group.id }, { groupId: null });
      // Delete memberships
      await transactionalEntityManager.delete(GroupMembership, { groupId: group.id });
      // Delete group
      const deleteResult = await transactionalEntityManager.delete(Group, { id: group.id });
      await this.invalidateGroupCaches(groupId);
      return deleteResult.affected !== null && deleteResult.affected! > 0;
    });
  }

  async listPublicGroups(params: CursorPaginationParams & { categoryId?: string }): Promise<{
    groups: Group[];
    nextCursor?: string;
    prevCursor?: string;
  }> {
    const { categoryId, cursor, limit = 10, direction = "forward" } = params;
    const cacheKey = `group:public:${categoryId || "all"}:${
      cursor || "start"
    }:${limit}:${direction}`;

    const cached = await CacheService.getCachedData(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const queryBuilder = this.groupRepository
      .createQueryBuilder("group")
      .leftJoinAndSelect("group.owner", "owner")
      .leftJoinAndSelect("group.categories", "categories")
      .where("group.visibility = :visibility", { visibility: GroupVisibility.PUBLIC });

    if (categoryId) {
      queryBuilder.andWhere("categories.id = :categoryId", { categoryId });
    }

    if (cursor) {
      const decodedCursor = Buffer.from(cursor, "base64").toString();
      const [timestamp, id] = decodedCursor.split(":");

      if (direction === "forward") {
        queryBuilder.andWhere(
          "(group.createdAt < :timestamp OR (group.createdAt = :timestamp AND group.id < :id))",
          { timestamp, id }
        );
      } else {
        queryBuilder.andWhere(
          "(group.createdAt > :timestamp OR (group.createdAt = :timestamp AND group.id > :id))",
          { timestamp, id }
        );
      }
    }

    queryBuilder
      .orderBy("group.createdAt", direction === "forward" ? "DESC" : "ASC")
      .addOrderBy("group.id", direction === "forward" ? "DESC" : "ASC")
      .take(limit + 1);

    const groups = await queryBuilder.getMany();
    const hasMore = groups.length > limit;
    const results = hasMore ? groups.slice(0, limit) : groups;

    const nextCursor =
      hasMore && direction === "forward"
        ? this.createCursor(results[results.length - 1])
        : undefined;

    const prevCursor =
      hasMore && direction === "backward" ? this.createCursor(results[0]) : undefined;

    const response = {
      groups: results,
      nextCursor,
      prevCursor,
    };

    await CacheService.setCachedData(
      cacheKey,
      JSON.stringify(response),
      GroupService.GROUP_CACHE_TTL
    );

    return response;
  }

  async getUserGroups(
    userId: string,
    params: CursorPaginationParams
  ): Promise<{
    groups: Group[];
    nextCursor?: string;
    prevCursor?: string;
  }> {
    const { cursor, limit = 10, direction = "forward" } = params;
    const cacheKey = `group:user:${userId}:${cursor || "start"}:${limit}:${direction}`;

    const cached = await CacheService.getCachedData(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const queryBuilder = this.groupMembershipRepository
      .createQueryBuilder("membership")
      .leftJoinAndSelect("membership.group", "group")
      .leftJoinAndSelect("group.owner", "owner")
      .leftJoinAndSelect("group.categories", "categories")
      .where("membership.userId = :userId", { userId })
      .andWhere("membership.status = :status", { status: GroupMembershipStatus.APPROVED });

    if (cursor) {
      const decodedCursor = Buffer.from(cursor, "base64").toString();
      const [timestamp, id] = decodedCursor.split(":");

      if (direction === "forward") {
        queryBuilder.andWhere(
          "(membership.joinedAt < :timestamp OR (membership.joinedAt = :timestamp AND membership.id < :id))",
          { timestamp, id }
        );
      } else {
        queryBuilder.andWhere(
          "(membership.joinedAt > :timestamp OR (membership.joinedAt = :timestamp AND membership.id > :id))",
          { timestamp, id }
        );
      }
    }

    queryBuilder
      .orderBy("membership.joinedAt", direction === "forward" ? "DESC" : "ASC")
      .addOrderBy("membership.id", direction === "forward" ? "DESC" : "ASC")
      .take(limit + 1);

    const memberships = await queryBuilder.getMany();
    const hasMore = memberships.length > limit;
    const results = hasMore ? memberships.slice(0, limit) : memberships;

    const groups = results.map((m) => m.group);

    const nextCursor =
      hasMore && direction === "forward"
        ? Buffer.from(
            `${results[results.length - 1].joinedAt.toISOString()}:${
              results[results.length - 1].id
            }`
          ).toString("base64")
        : undefined;

    const prevCursor =
      hasMore && direction === "backward"
        ? Buffer.from(`${results[0].joinedAt.toISOString()}:${results[0].id}`).toString("base64")
        : undefined;

    const response = {
      groups,
      nextCursor,
      prevCursor,
    };

    await CacheService.setCachedData(
      cacheKey,
      JSON.stringify(response),
      GroupService.GROUP_CACHE_TTL
    );

    return response;
  }

  async joinGroup(groupId: string, userId: string): Promise<GroupMembership> {
    const group = await this.groupRepository.findOneBy({ id: groupId });
    if (!group) throw new Error("Group not found");

    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) throw new Error("User not found");

    let existingMembership = await this.groupMembershipRepository.findOneBy({ groupId, userId });
    if (existingMembership && existingMembership.status === GroupMembershipStatus.APPROVED) {
      throw new Error("User is already a member of this group");
    }
    if (existingMembership && existingMembership.status === GroupMembershipStatus.BANNED) {
      throw new Error("User is banned from this group");
    }

    const status =
      group.visibility === GroupVisibility.PRIVATE
        ? GroupMembershipStatus.PENDING
        : GroupMembershipStatus.APPROVED;
    const role = GroupMemberRole.MEMBER;

    return this.dataSource.transaction(async (transactionalEntityManager) => {
      if (existingMembership) {
        // e.g. was PENDING and now re-requesting or was REJECTED
        existingMembership.status = status;
        existingMembership.role = role; // Reset role if they were previously rejected/pending
        existingMembership.joinedAt = new Date(); // Update joinedAt/requestedAt
        await transactionalEntityManager.save(existingMembership);
      } else {
        existingMembership = transactionalEntityManager.create(GroupMembership, {
          groupId,
          userId,
          group,
          user,
          role,
          status,
        });
        await transactionalEntityManager.save(existingMembership);
      }

      if (status === GroupMembershipStatus.APPROVED) {
        group.memberCount = await transactionalEntityManager.count(GroupMembership, {
          where: { groupId, status: GroupMembershipStatus.APPROVED },
        });
        await transactionalEntityManager.save(group);
      }
      await this.invalidateGroupCaches(groupId);
      return existingMembership;
    });
  }

  async leaveGroup(groupId: string, userId: string): Promise<boolean> {
    const group = await this.groupRepository.findOneBy({ id: groupId });
    if (!group) throw new Error("Group not found");

    if (group.ownerId === userId) {
      throw new Error("Owner cannot leave the group. Transfer ownership or delete the group.");
    }

    return this.dataSource.transaction(async (transactionalEntityManager) => {
      const result = await transactionalEntityManager.delete(GroupMembership, { groupId, userId });
      if (result.affected && result.affected > 0) {
        group.memberCount = await transactionalEntityManager.count(GroupMembership, {
          where: { groupId, status: GroupMembershipStatus.APPROVED },
        });
        await transactionalEntityManager.save(group);
        await this.invalidateGroupCaches(groupId);
        return true;
      }
      return false;
    });
  }

  async manageMembershipStatus(
    groupId: string,
    memberUserId: string,
    adminUserId: string,
    newStatus:
      | GroupMembershipStatus.APPROVED
      | GroupMembershipStatus.REJECTED
      | GroupMembershipStatus.BANNED,
    newRole?: GroupMemberRole // Optional: set role upon approval
  ): Promise<GroupMembership> {
    const group = await this.groupRepository.findOneBy({ id: groupId });
    if (!group) throw new Error("Group not found");

    const adminRole = await this.getUserRoleInGroup(groupId, adminUserId);
    if (group.ownerId !== adminUserId && adminRole !== GroupMemberRole.ADMIN) {
      throw new Error("User is not authorized to manage memberships for this group");
    }

    const membership = await this.groupMembershipRepository.findOneBy({
      groupId,
      userId: memberUserId,
    });
    if (!membership) throw new Error("Membership request not found");

    if (memberUserId === group.ownerId && newStatus !== GroupMembershipStatus.APPROVED) {
      throw new Error("Cannot change the status of the group owner other than approved.");
    }

    return this.dataSource.transaction(async (transactionalEntityManager) => {
      membership.status = newStatus;
      if (newStatus === GroupMembershipStatus.APPROVED) {
        membership.role = newRole || membership.role || GroupMemberRole.MEMBER; // Keep existing role if approved, or set to member
        membership.joinedAt = new Date(); // Set joinedAt on approval
      }
      const updatedMembership = await transactionalEntityManager.save(membership);

      group.memberCount = await transactionalEntityManager.count(GroupMembership, {
        where: { groupId, status: GroupMembershipStatus.APPROVED },
      });
      await transactionalEntityManager.save(group);

      await this.invalidateGroupCaches(groupId);
      return updatedMembership;
    });
  }

  async updateMemberRole(
    groupId: string,
    memberUserId: string,
    adminUserId: string,
    newRole: GroupMemberRole
  ): Promise<GroupMembership> {
    const group = await this.groupRepository.findOneBy({ id: groupId });
    if (!group) throw new Error("Group not found");

    const adminRole = await this.getUserRoleInGroup(groupId, adminUserId);
    if (group.ownerId !== adminUserId && adminRole !== GroupMemberRole.ADMIN) {
      throw new Error("User is not authorized to update member roles for this group");
    }

    if (memberUserId === group.ownerId && newRole !== GroupMemberRole.ADMIN) {
      // Owner must remain an admin at least
      throw new Error(
        "Owner role cannot be changed from Admin. To change ownership, use a dedicated transfer ownership function."
      );
    }
    if (
      memberUserId !== group.ownerId &&
      newRole === GroupMemberRole.ADMIN &&
      group.ownerId === adminUserId
    ) {
      // Owner is making someone else an admin, this is fine.
    } else if (
      memberUserId !== group.ownerId &&
      newRole === GroupMemberRole.ADMIN &&
      adminRole !== GroupMemberRole.ADMIN
    ) {
      throw new Error("Only admins or the owner can promote others to admin.");
    }

    const membership = await this.groupMembershipRepository.findOneBy({
      groupId,
      userId: memberUserId,
      status: GroupMembershipStatus.APPROVED,
    });
    if (!membership) throw new Error("Approved member not found");

    membership.role = newRole;
    await this.invalidateGroupCaches(groupId);
    return this.groupMembershipRepository.save(membership);
  }

  async removeMember(groupId: string, memberUserId: string, adminUserId: string): Promise<boolean> {
    const group = await this.groupRepository.findOneBy({ id: groupId });
    if (!group) throw new Error("Group not found");

    if (memberUserId === group.ownerId) {
      throw new Error("Owner cannot be removed. Transfer ownership or delete the group.");
    }

    const adminRole = await this.getUserRoleInGroup(groupId, adminUserId);
    if (group.ownerId !== adminUserId && adminRole !== GroupMemberRole.ADMIN) {
      throw new Error("User is not authorized to remove members from this group");
    }

    return this.dataSource.transaction(async (transactionalEntityManager) => {
      const result = await transactionalEntityManager.delete(GroupMembership, {
        groupId,
        userId: memberUserId,
      });
      if (result.affected && result.affected > 0) {
        group.memberCount = await transactionalEntityManager.count(GroupMembership, {
          where: { groupId, status: GroupMembershipStatus.APPROVED },
        });
        await transactionalEntityManager.save(group);
        await this.invalidateGroupCaches(groupId);
        return true;
      }
      return false;
    });
  }

  async getGroupMembers(
    groupId: string,
    params: CursorPaginationParams & { status?: GroupMembershipStatus }
  ): Promise<{
    memberships: GroupMembership[];
    nextCursor?: string;
    prevCursor?: string;
  }> {
    const {
      status = GroupMembershipStatus.APPROVED,
      cursor,
      limit = 10,
      direction = "forward",
    } = params;
    const cacheKey =
      this.getGroupMembersCacheKey(groupId, status) + `:${cursor || "start"}:${limit}:${direction}`;

    const cached = await CacheService.getCachedData(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const queryBuilder = this.groupMembershipRepository
      .createQueryBuilder("membership")
      .leftJoinAndSelect("membership.user", "user")
      .where("membership.groupId = :groupId", { groupId })
      .andWhere("membership.status = :status", { status });

    if (cursor) {
      const decodedCursor = Buffer.from(cursor, "base64").toString();
      const [timestamp, id] = decodedCursor.split(":");

      if (direction === "forward") {
        queryBuilder.andWhere(
          "(membership.joinedAt < :timestamp OR (membership.joinedAt = :timestamp AND membership.id < :id))",
          { timestamp, id }
        );
      } else {
        queryBuilder.andWhere(
          "(membership.joinedAt > :timestamp OR (membership.joinedAt = :timestamp AND membership.id > :id))",
          { timestamp, id }
        );
      }
    }

    queryBuilder
      .orderBy("membership.joinedAt", direction === "forward" ? "ASC" : "DESC")
      .addOrderBy("membership.id", direction === "forward" ? "ASC" : "DESC")
      .take(limit + 1);

    const memberships = await queryBuilder.getMany();
    const hasMore = memberships.length > limit;
    const results = hasMore ? memberships.slice(0, limit) : memberships;

    const nextCursor =
      hasMore && direction === "forward"
        ? Buffer.from(
            `${results[results.length - 1].joinedAt.toISOString()}:${
              results[results.length - 1].id
            }`
          ).toString("base64")
        : undefined;

    const prevCursor =
      hasMore && direction === "backward"
        ? Buffer.from(`${results[0].joinedAt.toISOString()}:${results[0].id}`).toString("base64")
        : undefined;

    const response = {
      memberships: results,
      nextCursor,
      prevCursor,
    };

    await CacheService.setCachedData(
      cacheKey,
      JSON.stringify(response),
      GroupService.GROUP_MEMBERS_CACHE_TTL
    );

    return response;
  }

  async getGroupEvents(
    groupId: string,
    params: GetGroupEventsParams = {}
  ): Promise<{
    events: Event[];
    nextCursor?: string;
    prevCursor?: string;
  }> {
    const {
      query,
      categoryId,
      cursor,
      limit = 10,
      direction = "forward",
      startDate,
      endDate,
    } = params;

    // Verify group exists
    const group = await this.groupRepository.findOneBy({ id: groupId });
    if (!group) {
      throw new Error("Group not found");
    }

    // Try to get from cache
    const cacheKey = this.getGroupEventsCacheKey(groupId, params);
    const cached = await CacheService.getCachedData(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Build query
    const queryBuilder = this.eventRepository
      .createQueryBuilder("event")
      .leftJoinAndSelect("event.categories", "category")
      .leftJoinAndSelect("event.creator", "creator")
      .where("event.groupId = :groupId", { groupId });

    // Add search conditions if query is provided
    if (query) {
      queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where("LOWER(event.title) LIKE LOWER(:query)", {
            query: `%${query.toLowerCase()}%`,
          })
            .orWhere("LOWER(event.description) LIKE LOWER(:query)", {
              query: `%${query.toLowerCase()}%`,
            })
            .orWhere("LOWER(event.address) LIKE LOWER(:query)", {
              query: `%${query.toLowerCase()}%`,
            })
            .orWhere("LOWER(event.locationNotes) LIKE LOWER(:query)", {
              query: `%${query.toLowerCase()}%`,
            })
            .orWhere("LOWER(event.emojiDescription) LIKE LOWER(:query)", {
              query: `%${query.toLowerCase()}%`,
            });
        })
      );
    }

    // Add category filter if provided
    if (categoryId) {
      queryBuilder.andWhere("category.id = :categoryId", { categoryId });
    }

    // Add date range filters if provided
    if (startDate) {
      queryBuilder.andWhere("event.eventDate >= :startDate", { startDate });
    }
    if (endDate) {
      queryBuilder.andWhere("event.eventDate <= :endDate", { endDate });
    }

    // Add cursor-based pagination
    if (cursor) {
      const decodedCursor = Buffer.from(cursor, "base64").toString();
      const [timestamp, id] = decodedCursor.split(":");

      if (direction === "forward") {
        queryBuilder.andWhere(
          "(event.eventDate < :timestamp OR (event.eventDate = :timestamp AND event.id < :id))",
          { timestamp, id }
        );
      } else {
        queryBuilder.andWhere(
          "(event.eventDate > :timestamp OR (event.eventDate = :timestamp AND event.id > :id))",
          { timestamp, id }
        );
      }
    }

    // Execute query with pagination
    const events = await queryBuilder
      .orderBy("event.eventDate", direction === "forward" ? "DESC" : "ASC")
      .addOrderBy("event.id", direction === "forward" ? "DESC" : "ASC")
      .take(limit + 1)
      .getMany();

    // Process results
    const hasMore = events.length > limit;
    const results = hasMore ? events.slice(0, limit) : events;

    // Generate cursors
    const nextCursor =
      hasMore && direction === "forward"
        ? Buffer.from(
            `${results[results.length - 1].eventDate.toISOString()}:${
              results[results.length - 1].id
            }`
          ).toString("base64")
        : undefined;

    const prevCursor =
      hasMore && direction === "backward"
        ? Buffer.from(`${results[0].eventDate.toISOString()}:${results[0].id}`).toString("base64")
        : undefined;

    const response = {
      events: results,
      nextCursor,
      prevCursor,
    };

    // Cache the results
    await CacheService.setCachedData(cacheKey, JSON.stringify(response), 300); // 5 minutes TTL

    return response;
  }

  private createCursor(group: Group): string {
    return Buffer.from(`${group.createdAt.toISOString()}:${group.id}`).toString("base64");
  }

  private async invalidateGroupCaches(groupId: string): Promise<void> {
    const keys = [
      this.getGroupCacheKey(groupId),
      this.getGroupMembersCacheKey(groupId, GroupMembershipStatus.APPROVED),
      this.getGroupMembersCacheKey(groupId, GroupMembershipStatus.PENDING),
      this.getGroupMembersCacheKey(groupId, GroupMembershipStatus.BANNED),
    ];

    // Invalidate search caches
    const searchKeys = (await CacheService.getRedisClient()?.keys("group:search:*")) || [];
    keys.push(...searchKeys);

    // Invalidate public groups cache
    const publicKeys = (await CacheService.getRedisClient()?.keys("group:public:*")) || [];
    keys.push(...publicKeys);

    // Invalidate group events cache
    const eventKeys =
      (await CacheService.getRedisClient()?.keys(`group:${groupId}:events:*`)) || [];
    keys.push(...eventKeys);

    if (keys.length > 0) {
      await CacheService.getRedisClient()?.del(...keys);
    }
  }

  async searchGroups(params: SearchGroupsParams): Promise<{
    groups: Group[];
    nextCursor?: string;
    prevCursor?: string;
  }> {
    const { query, categoryId, cursor, limit = 10, direction = "forward" } = params;
    const cacheKey = this.getGroupSearchCacheKey(params);

    const cached = await CacheService.getCachedData(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Create base query builder
    const queryBuilder = this.groupRepository
      .createQueryBuilder("group")
      .leftJoinAndSelect("group.owner", "owner")
      .leftJoinAndSelect("group.categories", "categories")
      .where("group.visibility = :visibility", { visibility: GroupVisibility.PUBLIC });

    // Add search conditions using ILIKE for case-insensitive search
    if (query && query.trim()) {
      queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where("group.name ILIKE :searchPattern", {
            searchPattern: `%${query.trim()}%`,
          }).orWhere("group.description ILIKE :searchPattern", {
            searchPattern: `%${query.trim()}%`,
          });
        })
      );
    }

    // Add category filter if provided
    if (categoryId) {
      queryBuilder.andWhere("categories.id = :categoryId", { categoryId });
    }

    // Add cursor-based pagination
    if (cursor) {
      const decodedCursor = Buffer.from(cursor, "base64").toString();
      const [timestamp, id] = decodedCursor.split(":");

      if (direction === "forward") {
        queryBuilder.andWhere(
          "(group.createdAt < :timestamp OR (group.createdAt = :timestamp AND group.id < :id))",
          { timestamp, id }
        );
      } else {
        queryBuilder.andWhere(
          "(group.createdAt > :timestamp OR (group.createdAt = :timestamp AND group.id > :id))",
          { timestamp, id }
        );
      }
    }

    // Add ordering and limit
    queryBuilder
      .orderBy("group.createdAt", direction === "forward" ? "DESC" : "ASC")
      .addOrderBy("group.id", direction === "forward" ? "DESC" : "ASC")
      .take(limit + 1);

    const groups = await queryBuilder.getMany();
    const hasMore = groups.length > limit;
    const results = hasMore ? groups.slice(0, limit) : groups;

    const nextCursor =
      hasMore && direction === "forward"
        ? this.createCursor(results[results.length - 1])
        : undefined;

    const prevCursor =
      hasMore && direction === "backward" ? this.createCursor(results[0]) : undefined;

    const response = {
      groups: results,
      nextCursor,
      prevCursor,
    };

    await CacheService.setCachedData(
      cacheKey,
      JSON.stringify(response),
      GroupService.GROUP_SEARCH_CACHE_TTL
    );

    return response;
  }
}
