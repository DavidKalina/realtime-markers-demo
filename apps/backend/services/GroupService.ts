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

export class GroupService {
  private userRepository: Repository<User>;
  private groupRepository: Repository<Group>;
  private groupMembershipRepository: Repository<GroupMembership>;
  private categoryRepository: Repository<Category>;
  private eventRepository: Repository<Event>;
  private dataSource: DataSource;

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

      return savedGroup;
    });
  }

  async getGroupById(
    groupId: string,
    relations: string[] = ["owner", "categories", "memberships", "memberships.user"]
  ): Promise<Group | null> {
    return this.groupRepository.findOne({ where: { id: groupId }, relations });
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
      return deleteResult.affected !== null && deleteResult.affected! > 0;
    });
  }

  async listPublicGroups(
    page: number = 1,
    limit: number = 10,
    categoryId?: string
  ): Promise<{ groups: Group[]; total: number }> {
    const whereClause: any = { visibility: GroupVisibility.PUBLIC };
    if (categoryId) {
      // This requires a more complex query if filtering by ManyToMany relation directly in `findAndCount`
      // A common approach is to use QueryBuilder or fetch groups and then filter, or join.
      // For simplicity, if using QueryBuilder:
      const [groups, total] = await this.groupRepository
        .createQueryBuilder("group")
        .leftJoinAndSelect("group.categories", "category")
        .where("group.visibility = :visibility", { visibility: GroupVisibility.PUBLIC })
        .andWhere(categoryId ? "category.id = :categoryId" : "1=1", { categoryId })
        .skip((page - 1) * limit)
        .take(limit)
        .orderBy("group.createdAt", "DESC")
        .getManyAndCount();
      return { groups, total };
    }

    const [groups, total] = await this.groupRepository.findAndCount({
      where: whereClause,
      relations: ["owner", "categories"],
      order: { createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { groups, total };
  }

  async getUserGroups(
    userId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{ groups: Group[]; total: number }> {
    const [memberships, total] = await this.groupMembershipRepository.findAndCount({
      where: { userId: userId, status: GroupMembershipStatus.APPROVED },
      relations: ["group", "group.owner", "group.categories"],
      order: { joinedAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });
    const groups = memberships.map((m) => m.group);
    return { groups, total };
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
        return true;
      }
      return false;
    });
  }

  async getGroupMembers(
    groupId: string,
    page: number = 1,
    limit: number = 10,
    status: GroupMembershipStatus = GroupMembershipStatus.APPROVED
  ): Promise<{ memberships: GroupMembership[]; total: number }> {
    const [memberships, total] = await this.groupMembershipRepository.findAndCount({
      where: { groupId, status },
      relations: ["user"], // Ensure user details are fetched (select specific fields if needed)
      order: { joinedAt: "ASC" },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { memberships, total };
  }

  async getGroupEvents(
    groupId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{ events: Event[]; total: number }> {
    const [events, total] = await this.eventRepository.findAndCount({
      where: { groupId: groupId },
      relations: ["creator", "categories"], // Add relations as needed
      order: { eventDate: "ASC" },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { events, total };
  }
}
