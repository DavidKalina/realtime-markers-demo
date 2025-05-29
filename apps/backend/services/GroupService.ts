// src/services/GroupService.ts

import { Brackets, DataSource, In, Repository } from "typeorm";
import type { CreateGroupDto, UpdateGroupDto } from "../dtos/group.dto";
import { Category } from "../entities/Category";
import { Event } from "../entities/Event";
import { Group, GroupVisibility } from "../entities/Group";
import {
  GroupMemberRole,
  GroupMembership,
  GroupMembershipStatus,
} from "../entities/GroupMembership";
import { User } from "../entities/User";
import { GroupCacheService } from "./shared/GroupCacheService";
import { OpenAIModel, OpenAIService } from "./shared/OpenAIService"; // Reusing from AuthService for content moderation
import { CategoryProcessingService } from "./CategoryProcessingService";

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

interface NearbyGroupsParams extends CursorPaginationParams {
  coordinates: { lat: number; lng: number };
  maxDistance?: number; // in kilometers, default 60km
  categoryId?: string;
  minMemberCount?: number;
}

interface GroupWithDistance extends Group {
  distance: number;
}

export class GroupService {
  private userRepository: Repository<User>;
  private groupRepository: Repository<Group>;
  private groupMembershipRepository: Repository<GroupMembership>;
  private categoryRepository: Repository<Category>;
  private eventRepository: Repository<Event>;
  private dataSource: DataSource;
  private categoryProcessingService: CategoryProcessingService;

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
    this.userRepository = dataSource.getRepository(User);
    this.groupRepository = dataSource.getRepository(Group);
    this.groupMembershipRepository = dataSource.getRepository(GroupMembership);
    this.categoryRepository = dataSource.getRepository(Category);
    this.eventRepository = dataSource.getRepository(Event);
    this.categoryProcessingService = new CategoryProcessingService(
      this.categoryRepository,
    );

    // Log the table name to verify
    console.log("Group table name:", this.groupRepository.metadata.tableName);
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

      if (!response.choices[0]?.message?.content) {
        throw new Error("No content in OpenAI response");
      }
      const result = JSON.parse(response.choices[0].message.content);
      return result.isAppropriate;
    } catch (error) {
      console.error("Error checking content appropriateness:", error);
      return true; // Default to true if moderation fails
    }
  }

  private async processGroupTags(tags: string[]): Promise<Category[]> {
    if (!tags || tags.length === 0) {
      return [];
    }

    // Process tags using CategoryProcessingService
    return this.categoryProcessingService.getOrCreateCategories(tags);
  }

  async createGroup(userId: string, groupData: CreateGroupDto): Promise<Group> {
    const owner = await this.userRepository.findOneBy({ id: userId });
    if (!owner) {
      throw new Error("Owner user not found");
    }

    if (!(await this.isContentAppropriate(groupData.name))) {
      throw new Error("Group name contains inappropriate content.");
    }
    if (
      groupData.description &&
      !(await this.isContentAppropriate(groupData.description))
    ) {
      throw new Error("Group description contains inappropriate content.");
    }

    // Check for existing group with the same name
    const existingGroup = await this.groupRepository.findOneBy({
      name: groupData.name,
    });
    if (existingGroup) {
      throw new Error(
        `A group with the name "${groupData.name}" already exists.`,
      );
    }

    // Process both explicit categories and tags
    let categories: Category[] = [];
    if (groupData.categoryIds && groupData.categoryIds.length > 0) {
      const explicitCategories = await this.categoryRepository.findBy({
        id: In(groupData.categoryIds),
      });
      categories = [...explicitCategories];
    }

    // Process tags if provided
    if (groupData.tags && groupData.tags.length > 0) {
      const tagCategories = await this.processGroupTags(groupData.tags);
      // Merge with existing categories, avoiding duplicates
      const categoryMap = new Map(categories.map((cat) => [cat.id, cat]));
      tagCategories.forEach((cat) => {
        if (!categoryMap.has(cat.id)) {
          categoryMap.set(cat.id, cat);
        }
      });
      categories = Array.from(categoryMap.values());
    }

    // Extract headquarters data if provided
    const { headquarters, ...restGroupData } = groupData;
    const headquartersData = headquarters
      ? {
          headquartersPlaceId: headquarters.placeId,
          headquartersName: headquarters.name,
          headquartersAddress: headquarters.address,
          headquartersLocation: headquarters.coordinates,
        }
      : {};

    return this.dataSource.transaction(async (transactionalEntityManager) => {
      const group = transactionalEntityManager.create(Group, {
        ...restGroupData,
        ...headquartersData,
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

      // Invalidate all relevant caches
      await Promise.all([
        // Invalidate the specific group cache
        GroupCacheService.invalidateGroup(savedGroup.id),
        // Invalidate user's groups cache since they're now a member
        GroupCacheService.invalidateUserGroups(userId),
        // Invalidate search caches since a new group is added
        GroupCacheService.invalidateSearchCaches(),
        // Invalidate recent groups cache
        GroupCacheService.invalidateRecentGroupsCache(),
        // Invalidate nearby groups cache since a new group with location is added
        GroupCacheService.invalidateNearbyGroupsCache(),
      ]);

      return savedGroup;
    });
  }

  async getGroupById(
    groupId: string,
    relations: string[] = [
      "owner",
      "categories",
      "memberships",
      "memberships.user",
    ],
  ): Promise<Group | null> {
    // Try cache first
    const cachedGroup = await GroupCacheService.getGroup(groupId);
    if (cachedGroup) {
      return cachedGroup;
    }

    const group = await this.groupRepository.findOne({
      where: { id: groupId },
      relations,
    });

    if (group) {
      await GroupCacheService.setGroup(group);
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

  async getUserRoleInGroup(
    groupId: string,
    userId: string,
  ): Promise<GroupMemberRole | null> {
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
    updateData: UpdateGroupDto,
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

    if (
      updateData.name &&
      !(await this.isContentAppropriate(updateData.name))
    ) {
      throw new Error("Group name contains inappropriate content.");
    }
    if (
      updateData.description &&
      !(await this.isContentAppropriate(updateData.description))
    ) {
      throw new Error("Group description contains inappropriate content.");
    }

    // Handle categories update
    if (updateData.categoryIds) {
      if (updateData.categoryIds.length > 0) {
        group.categories = await this.categoryRepository.findBy({
          id: In(updateData.categoryIds),
        });
      } else {
        group.categories = []; // Clear categories if an empty array is passed
      }
    }

    // Extract headquarters data if provided
    const { headquarters, ...restUpdateData } = updateData;
    const headquartersData = headquarters
      ? {
          headquartersPlaceId: headquarters.placeId,
          headquartersName: headquarters.name,
          headquartersAddress: headquarters.address,
          headquartersLocation: headquarters.coordinates,
        }
      : {};

    // Update the group with all fields
    await this.groupRepository.update(groupId, {
      ...restUpdateData,
      ...headquartersData,
    });

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
      await transactionalEntityManager.update(
        Event,
        { groupId: group.id },
        { groupId: null },
      );
      // Delete memberships
      await transactionalEntityManager.delete(GroupMembership, {
        groupId: group.id,
      });
      // Delete group
      const deleteResult = await transactionalEntityManager.delete(Group, {
        id: group.id,
      });
      await this.invalidateGroupCaches(groupId);
      return deleteResult.affected !== null && deleteResult.affected! > 0;
    });
  }

  async listPublicGroups(
    params: CursorPaginationParams & { categoryId?: string },
  ): Promise<{
    groups: Group[];
    nextCursor?: string;
    prevCursor?: string;
  }> {
    // Try cache first
    const cached = await GroupCacheService.getPublicGroups(params);
    if (cached) {
      return cached;
    }

    const { categoryId, cursor, limit = 10, direction = "forward" } = params;

    const queryBuilder = this.groupRepository
      .createQueryBuilder("group")
      .leftJoinAndSelect("group.owner", "owner")
      .leftJoinAndSelect("group.categories", "categories")
      .where("group.visibility = :visibility", {
        visibility: GroupVisibility.PUBLIC,
      });

    if (categoryId) {
      queryBuilder.andWhere("categories.id = :categoryId", { categoryId });
    }

    if (cursor) {
      const decodedCursor = Buffer.from(cursor, "base64").toString();
      const [timestamp, id] = decodedCursor.split(":");

      if (direction === "forward") {
        queryBuilder.andWhere(
          "(group.createdAt < :timestamp OR (group.createdAt = :timestamp AND group.id < :id))",
          { timestamp, id },
        );
      } else {
        queryBuilder.andWhere(
          "(group.createdAt > :timestamp OR (group.createdAt = :timestamp AND group.id > :id))",
          { timestamp, id },
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
      hasMore && direction === "backward"
        ? this.createCursor(results[0])
        : undefined;

    const response = {
      groups: results,
      nextCursor,
      prevCursor,
    };

    await GroupCacheService.setPublicGroups(params, response);
    return response;
  }

  async getUserGroups(
    userId: string,
    params: CursorPaginationParams,
  ): Promise<{
    groups: Group[];
    nextCursor?: string;
    prevCursor?: string;
  }> {
    // Try cache first
    const cached = await GroupCacheService.getUserGroups(userId, params);
    if (cached) {
      return cached;
    }

    const { cursor, limit = 10, direction = "forward" } = params;

    const queryBuilder = this.groupMembershipRepository
      .createQueryBuilder("membership")
      .leftJoinAndSelect("membership.group", "group")
      .leftJoinAndSelect("group.owner", "owner")
      .leftJoinAndSelect("group.categories", "categories")
      .where("membership.userId = :userId", { userId })
      .andWhere("membership.status = :status", {
        status: GroupMembershipStatus.APPROVED,
      });

    if (cursor) {
      const decodedCursor = Buffer.from(cursor, "base64").toString();
      const [timestamp, id] = decodedCursor.split(":");

      if (direction === "forward") {
        queryBuilder.andWhere(
          "(membership.joinedAt < :timestamp OR (membership.joinedAt = :timestamp AND membership.id < :id))",
          { timestamp, id },
        );
      } else {
        queryBuilder.andWhere(
          "(membership.joinedAt > :timestamp OR (membership.joinedAt = :timestamp AND membership.id > :id))",
          { timestamp, id },
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
            }`,
          ).toString("base64")
        : undefined;

    const prevCursor =
      hasMore && direction === "backward"
        ? Buffer.from(
            `${results[0].joinedAt.toISOString()}:${results[0].id}`,
          ).toString("base64")
        : undefined;

    const response = {
      groups,
      nextCursor,
      prevCursor,
    };

    await GroupCacheService.setUserGroups(userId, params, response);
    return response;
  }

  async joinGroup(groupId: string, userId: string): Promise<GroupMembership> {
    const group = await this.groupRepository.findOneBy({ id: groupId });
    if (!group) throw new Error("Group not found");

    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) throw new Error("User not found");

    let existingMembership = await this.groupMembershipRepository.findOneBy({
      groupId,
      userId,
    });
    if (
      existingMembership &&
      existingMembership.status === GroupMembershipStatus.APPROVED
    ) {
      throw new Error("User is already a member of this group");
    }
    if (
      existingMembership &&
      existingMembership.status === GroupMembershipStatus.BANNED
    ) {
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
        existingMembership = transactionalEntityManager.create(
          GroupMembership,
          {
            groupId,
            userId,
            group,
            user,
            role,
            status,
          },
        );
        await transactionalEntityManager.save(existingMembership);
      }

      if (status === GroupMembershipStatus.APPROVED) {
        group.memberCount = await transactionalEntityManager.count(
          GroupMembership,
          {
            where: { groupId, status: GroupMembershipStatus.APPROVED },
          },
        );
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
      throw new Error(
        "Owner cannot leave the group. Transfer ownership or delete the group.",
      );
    }

    return this.dataSource.transaction(async (transactionalEntityManager) => {
      const result = await transactionalEntityManager.delete(GroupMembership, {
        groupId,
        userId,
      });
      if (result.affected && result.affected > 0) {
        group.memberCount = await transactionalEntityManager.count(
          GroupMembership,
          {
            where: { groupId, status: GroupMembershipStatus.APPROVED },
          },
        );
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
    newRole?: GroupMemberRole, // Optional: set role upon approval
  ): Promise<GroupMembership> {
    const group = await this.groupRepository.findOneBy({ id: groupId });
    if (!group) throw new Error("Group not found");

    const adminRole = await this.getUserRoleInGroup(groupId, adminUserId);
    if (group.ownerId !== adminUserId && adminRole !== GroupMemberRole.ADMIN) {
      throw new Error(
        "User is not authorized to manage memberships for this group",
      );
    }

    const membership = await this.groupMembershipRepository.findOneBy({
      groupId,
      userId: memberUserId,
    });
    if (!membership) throw new Error("Membership request not found");

    if (
      memberUserId === group.ownerId &&
      newStatus !== GroupMembershipStatus.APPROVED
    ) {
      throw new Error(
        "Cannot change the status of the group owner other than approved.",
      );
    }

    return this.dataSource.transaction(async (transactionalEntityManager) => {
      membership.status = newStatus;
      if (newStatus === GroupMembershipStatus.APPROVED) {
        membership.role = newRole || membership.role || GroupMemberRole.MEMBER; // Keep existing role if approved, or set to member
        membership.joinedAt = new Date(); // Set joinedAt on approval
      }
      const updatedMembership =
        await transactionalEntityManager.save(membership);

      group.memberCount = await transactionalEntityManager.count(
        GroupMembership,
        {
          where: { groupId, status: GroupMembershipStatus.APPROVED },
        },
      );
      await transactionalEntityManager.save(group);

      await this.invalidateGroupCaches(groupId);
      return updatedMembership;
    });
  }

  async updateMemberRole(
    groupId: string,
    memberUserId: string,
    adminUserId: string,
    newRole: GroupMemberRole,
  ): Promise<GroupMembership> {
    const group = await this.groupRepository.findOneBy({ id: groupId });
    if (!group) throw new Error("Group not found");

    const adminRole = await this.getUserRoleInGroup(groupId, adminUserId);
    if (group.ownerId !== adminUserId && adminRole !== GroupMemberRole.ADMIN) {
      throw new Error(
        "User is not authorized to update member roles for this group",
      );
    }

    if (memberUserId === group.ownerId && newRole !== GroupMemberRole.ADMIN) {
      // Owner must remain an admin at least
      throw new Error(
        "Owner role cannot be changed from Admin. To change ownership, use a dedicated transfer ownership function.",
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

  async removeMember(
    groupId: string,
    memberUserId: string,
    adminUserId: string,
  ): Promise<boolean> {
    const group = await this.groupRepository.findOneBy({ id: groupId });
    if (!group) throw new Error("Group not found");

    if (memberUserId === group.ownerId) {
      throw new Error(
        "Owner cannot be removed. Transfer ownership or delete the group.",
      );
    }

    const adminRole = await this.getUserRoleInGroup(groupId, adminUserId);
    if (group.ownerId !== adminUserId && adminRole !== GroupMemberRole.ADMIN) {
      throw new Error(
        "User is not authorized to remove members from this group",
      );
    }

    return this.dataSource.transaction(async (transactionalEntityManager) => {
      const result = await transactionalEntityManager.delete(GroupMembership, {
        groupId,
        userId: memberUserId,
      });
      if (result.affected && result.affected > 0) {
        group.memberCount = await transactionalEntityManager.count(
          GroupMembership,
          {
            where: { groupId, status: GroupMembershipStatus.APPROVED },
          },
        );
        await transactionalEntityManager.save(group);
        await this.invalidateGroupCaches(groupId);
        return true;
      }
      return false;
    });
  }

  async getGroupMembers(
    groupId: string,
    params: CursorPaginationParams & { status?: GroupMembershipStatus },
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

    // Try cache first
    const cached = await GroupCacheService.getGroupMembers(groupId, status, {
      cursor,
      limit,
      direction,
    });
    if (cached) {
      return cached;
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
          { timestamp, id },
        );
      } else {
        queryBuilder.andWhere(
          "(membership.joinedAt > :timestamp OR (membership.joinedAt = :timestamp AND membership.id > :id))",
          { timestamp, id },
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
            }`,
          ).toString("base64")
        : undefined;

    const prevCursor =
      hasMore && direction === "backward"
        ? Buffer.from(
            `${results[0].joinedAt.toISOString()}:${results[0].id}`,
          ).toString("base64")
        : undefined;

    const response = {
      memberships: results,
      nextCursor,
      prevCursor,
    };

    await GroupCacheService.setGroupMembers(
      groupId,
      status,
      { cursor, limit, direction },
      response,
    );

    return response;
  }

  async getGroupEvents(
    groupId: string,
    params: GetGroupEventsParams = {},
  ): Promise<{
    events: Event[];
    nextCursor?: string;
    prevCursor?: string;
  }> {
    // Verify group exists
    const group = await this.groupRepository.findOneBy({ id: groupId });
    if (!group) {
      throw new Error("Group not found");
    }

    // Try cache first
    const cached = await GroupCacheService.getGroupEvents(groupId, params);
    if (cached) {
      return cached;
    }

    const {
      query,
      categoryId,
      cursor,
      limit = 10,
      direction = "forward",
      startDate,
      endDate,
    } = params;

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
        }),
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
          { timestamp, id },
        );
      } else {
        queryBuilder.andWhere(
          "(event.eventDate > :timestamp OR (event.eventDate = :timestamp AND event.id > :id))",
          { timestamp, id },
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
            }`,
          ).toString("base64")
        : undefined;

    const prevCursor =
      hasMore && direction === "backward"
        ? Buffer.from(
            `${results[0].eventDate.toISOString()}:${results[0].id}`,
          ).toString("base64")
        : undefined;

    const response = {
      events: results,
      nextCursor,
      prevCursor,
    };

    await GroupCacheService.setGroupEvents(groupId, params, response);
    return response;
  }

  private createCursor(group: Group): string {
    return Buffer.from(`${group.createdAt.toISOString()}:${group.id}`).toString(
      "base64",
    );
  }

  private async invalidateGroupCaches(groupId: string): Promise<void> {
    await GroupCacheService.invalidateGroup(groupId);
  }

  async searchGroups(params: SearchGroupsParams): Promise<{
    groups: Group[];
    nextCursor?: string;
    prevCursor?: string;
  }> {
    // Try cache first
    const cached = await GroupCacheService.getGroupSearch(params);
    if (cached) {
      return cached;
    }

    const {
      query,
      categoryId,
      cursor,
      limit = 10,
      direction = "forward",
    } = params;

    // Create base query builder
    const queryBuilder = this.groupRepository
      .createQueryBuilder("group")
      .leftJoinAndSelect("group.owner", "owner")
      .leftJoinAndSelect("group.categories", "categories")
      .where("group.visibility = :visibility", {
        visibility: GroupVisibility.PUBLIC,
      });

    // Add search conditions using ILIKE for case-insensitive search
    if (query && query.trim()) {
      queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where("group.name ILIKE :searchPattern", {
            searchPattern: `%${query.trim()}%`,
          }).orWhere("group.description ILIKE :searchPattern", {
            searchPattern: `%${query.trim()}%`,
          });
        }),
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
          { timestamp, id },
        );
      } else {
        queryBuilder.andWhere(
          "(group.createdAt > :timestamp OR (group.createdAt = :timestamp AND group.id > :id))",
          { timestamp, id },
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
      hasMore && direction === "backward"
        ? this.createCursor(results[0])
        : undefined;

    const response = {
      groups: results,
      nextCursor,
      prevCursor,
    };

    await GroupCacheService.setGroupSearch(params, response);
    return response;
  }

  async recentGroups(
    params: CursorPaginationParams & {
      categoryId?: string;
      minMemberCount?: number;
      maxDistance?: number;
      userCoordinates?: { lat: number; lng: number };
    } = {},
  ): Promise<{
    groups: Group[];
    nextCursor?: string;
    prevCursor?: string;
  }> {
    // Try cache first
    const cached = await GroupCacheService.getRecentGroups(params);
    if (cached) {
      return cached;
    }

    const {
      categoryId,
      minMemberCount,
      maxDistance,
      userCoordinates,
      cursor,
      limit = 10,
      direction = "forward",
    } = params;

    // Create base query builder
    const queryBuilder = this.groupRepository
      .createQueryBuilder("group")
      .leftJoinAndSelect("group.owner", "owner")
      .leftJoinAndSelect("group.categories", "categories")
      .where("group.visibility = :visibility", {
        visibility: GroupVisibility.PUBLIC,
      });

    // Add category filter if provided
    if (categoryId) {
      queryBuilder.andWhere("categories.id = :categoryId", { categoryId });
    }

    // Add minimum member count filter if provided
    if (minMemberCount) {
      queryBuilder.andWhere("group.memberCount >= :minMemberCount", {
        minMemberCount,
      });
    }

    // Add distance filter if user coordinates and max distance are provided
    if (userCoordinates && maxDistance) {
      queryBuilder.andWhere(
        `ST_DWithin(
          group.headquarters_location::geography,
          ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
          :maxDistance
        )`,
        {
          lng: userCoordinates.lng,
          lat: userCoordinates.lat,
          maxDistance: maxDistance * 1000, // Convert km to meters
        },
      );
    }

    // Add cursor-based pagination
    if (cursor) {
      const decodedCursor = Buffer.from(cursor, "base64").toString();
      const [timestamp, id] = decodedCursor.split(":");

      if (direction === "forward") {
        queryBuilder.andWhere(
          "(group.createdAt < :timestamp OR (group.createdAt = :timestamp AND group.id < :id))",
          { timestamp, id },
        );
      } else {
        queryBuilder.andWhere(
          "(group.createdAt > :timestamp OR (group.createdAt = :timestamp AND group.id > :id))",
          { timestamp, id },
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
      hasMore && direction === "backward"
        ? this.createCursor(results[0])
        : undefined;

    const response = {
      groups: results,
      nextCursor,
      prevCursor,
    };

    await GroupCacheService.setRecentGroups(params, response);
    return response;
  }

  async getNearbyGroups(params: NearbyGroupsParams): Promise<{
    groups: GroupWithDistance[];
    nextCursor?: string;
    prevCursor?: string;
  }> {
    // Try cache first
    const cached = await GroupCacheService.getNearbyGroups(params);
    if (cached) {
      return cached;
    }

    const {
      coordinates,
      maxDistance = 60, // Increased default to 60km radius
      categoryId,
      minMemberCount,
      cursor,
      limit = 10,
      direction = "forward",
    } = params;

    // Validate maxDistance
    if (maxDistance < 1 || maxDistance > 1000) {
      throw new Error("maxDistance must be between 1 and 1000 kilometers");
    }

    // Log input parameters
    console.log("DEBUG - Nearby groups search params:", {
      coordinates,
      maxDistance,
      categoryId,
      minMemberCount,
      cursor,
      limit,
      direction,
    });

    // Single detailed debug query to verify coordinates and distance
    const debugQuery = this.groupRepository
      .createQueryBuilder("g")
      .select("g.id", "id")
      .addSelect("g.name", "name")
      .addSelect("ST_AsText(g.headquarters_location)", "location_text")
      .addSelect("ST_X(g.headquarters_location::geometry)", "group_lng")
      .addSelect("ST_Y(g.headquarters_location::geometry)", "group_lat")
      .addSelect(
        `ST_Distance(
          g.headquarters_location::geography,
          ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
        ) / 1000`,
        "distance_km",
      )
      .where("g.visibility = :visibility", {
        visibility: GroupVisibility.PUBLIC,
      })
      .andWhere("g.headquarters_location IS NOT NULL");

    // Execute debug query
    const debugResults = await debugQuery
      .setParameters({
        lng: coordinates.lng,
        lat: coordinates.lat,
        visibility: GroupVisibility.PUBLIC,
      })
      .getRawMany();

    // Log detailed debug information
    console.log("DEBUG - Input coordinates:", {
      search: {
        lat: coordinates.lat,
        lng: coordinates.lng,
        point: `POINT(${coordinates.lng} ${coordinates.lat})`,
      },
    });
    console.log(
      "DEBUG - Group locations and distances:",
      JSON.stringify(debugResults, null, 2),
    );

    // Now proceed with the actual distance query
    const distanceSubquery = this.groupRepository
      .createQueryBuilder("g")
      .select("g.id", "id")
      .addSelect("ST_AsText(g.headquarters_location)", "location_text")
      .addSelect(
        `ST_Distance(
          g.headquarters_location::geography,
          ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
        ) / 1000`,
        "distance",
      )
      .where("g.visibility = :visibility", {
        visibility: GroupVisibility.PUBLIC,
      })
      .andWhere("g.headquarters_location IS NOT NULL")
      .andWhere(
        `ST_DWithin(
          g.headquarters_location::geography,
          ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
          :maxDistance
        )`,
        {
          lng: coordinates.lng,
          lat: coordinates.lat,
          maxDistance: maxDistance * 1000, // Convert km to meters
        },
      );

    // Execute the distance query
    const distanceResults = await distanceSubquery.getRawMany();
    console.log(
      "DEBUG - Groups within distance:",
      JSON.stringify(distanceResults, null, 2),
    );

    const groupIds = distanceResults.map((result) => result.id);
    const distanceMap = new Map<string, number>(
      distanceResults.map((result) => [result.id, result.distance]),
    );

    if (groupIds.length === 0) {
      console.log("DEBUG - No groups found within distance");
      return {
        groups: [],
        nextCursor: undefined,
        prevCursor: undefined,
      };
    }

    // Now fetch the full group data for the IDs we found
    const queryBuilder = this.groupRepository
      .createQueryBuilder("group")
      .leftJoinAndSelect("group.owner", "owner")
      .leftJoinAndSelect("group.categories", "categories")
      .where("group.id IN (:...groupIds)", { groupIds })
      .orderBy(
        "CASE group.id " +
          groupIds.map((id, index) => `WHEN '${id}' THEN ${index}`).join(" ") +
          " END",
      );

    const groups = await queryBuilder.getMany();
    const hasMore = groups.length > limit;
    const results = hasMore ? groups.slice(0, limit) : groups;

    // Add distances to the results
    const groupsWithDistance = results.map((group) => ({
      ...group,
      distance: distanceMap.get(group.id) || 0,
    })) as GroupWithDistance[];

    const nextCursor =
      hasMore && direction === "forward"
        ? Buffer.from(
            `${groupsWithDistance[groupsWithDistance.length - 1].distance}:${
              groupsWithDistance[groupsWithDistance.length - 1].id
            }`,
          ).toString("base64")
        : undefined;

    const prevCursor =
      hasMore && direction === "backward"
        ? Buffer.from(
            `${groupsWithDistance[0].distance}:${groupsWithDistance[0].id}`,
          ).toString("base64")
        : undefined;

    const response = {
      groups: groupsWithDistance,
      nextCursor,
      prevCursor,
    };

    await GroupCacheService.setNearbyGroups(params, response);
    return response;
  }
}
