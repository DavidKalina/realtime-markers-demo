import { DataSource, Repository } from "typeorm";
import { User } from "../entities/User";
import { Friendship, FriendshipStatus } from "../entities/Friendship";
import { In, Not } from "typeorm";

export class FriendshipService {
  private userRepository: Repository<User>;
  private friendshipRepository: Repository<Friendship>;

  constructor(private dataSource: DataSource) {
    this.userRepository = dataSource.getRepository(User);
    this.friendshipRepository = dataSource.getRepository(Friendship);
  }

  /**
   * Send a friend request to another user
   */
  async sendFriendRequest(requesterId: string, addresseeId: string): Promise<Friendship> {
    // Check if users exist
    const [requester, addressee] = await Promise.all([
      this.userRepository.findOne({ where: { id: requesterId } }),
      this.userRepository.findOne({ where: { id: addresseeId } }),
    ]);

    if (!requester || !addressee) {
      throw new Error("User not found");
    }

    // Check if friendship already exists
    const existingFriendship = await this.friendshipRepository.findOne({
      where: [
        { requesterId, addresseeId },
        { requesterId: addresseeId, addresseeId: requesterId },
      ],
    });

    if (existingFriendship) {
      throw new Error("Friendship already exists");
    }

    // Create new friendship
    const friendship = this.friendshipRepository.create({
      requesterId,
      addresseeId,
      status: FriendshipStatus.PENDING,
    });

    return this.friendshipRepository.save(friendship);
  }

  /**
   * Accept a friend request
   */
  async acceptFriendRequest(friendshipId: string, userId: string): Promise<Friendship> {
    const friendship = await this.friendshipRepository.findOne({
      where: { id: friendshipId, addresseeId: userId },
    });

    if (!friendship) {
      throw new Error("Friend request not found");
    }

    if (friendship.status !== FriendshipStatus.PENDING) {
      throw new Error("Friend request is not pending");
    }

    friendship.status = FriendshipStatus.ACCEPTED;
    return this.friendshipRepository.save(friendship);
  }

  /**
   * Reject a friend request
   */
  async rejectFriendRequest(friendshipId: string, userId: string): Promise<Friendship> {
    const friendship = await this.friendshipRepository.findOne({
      where: { id: friendshipId, addresseeId: userId },
    });

    if (!friendship) {
      throw new Error("Friend request not found");
    }

    if (friendship.status !== FriendshipStatus.PENDING) {
      throw new Error("Friend request is not pending");
    }

    friendship.status = FriendshipStatus.REJECTED;
    return this.friendshipRepository.save(friendship);
  }

  /**
   * Get all friends for a user
   */
  async getFriends(userId: string): Promise<User[]> {
    const friendships = await this.friendshipRepository.find({
      where: [
        { requesterId: userId, status: FriendshipStatus.ACCEPTED },
        { addresseeId: userId, status: FriendshipStatus.ACCEPTED },
      ],
      relations: ["requester", "addressee"],
    });

    return friendships.map((friendship) =>
      friendship.requesterId === userId ? friendship.addressee : friendship.requester
    );
  }

  /**
   * Get pending friend requests for a user
   */
  async getPendingFriendRequests(userId: string): Promise<Friendship[]> {
    return this.friendshipRepository.find({
      where: { addresseeId: userId, status: FriendshipStatus.PENDING },
      relations: ["requester"],
    });
  }

  /**
   * Get outgoing friend requests for a user
   */
  async getOutgoingFriendRequests(userId: string): Promise<Friendship[]> {
    return this.friendshipRepository.find({
      where: { requesterId: userId, status: FriendshipStatus.PENDING },
      relations: ["addressee"],
    });
  }

  /**
   * Cancel an outgoing friend request
   */
  async cancelFriendRequest(friendshipId: string, userId: string): Promise<Friendship> {
    const friendship = await this.friendshipRepository.findOne({
      where: { id: friendshipId, requesterId: userId, status: FriendshipStatus.PENDING },
    });

    if (!friendship) {
      throw new Error("Friend request not found");
    }

    // Delete the friendship record
    await this.friendshipRepository.remove(friendship);
    return friendship;
  }

  /**
   * Update user's contacts
   */
  async updateContacts(userId: string, contacts: User["contacts"]): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error("User not found");
    }

    user.contacts = contacts;
    return this.userRepository.save(user);
  }

  /**
   * Find potential friends from contacts
   */
  async findPotentialFriendsFromContacts(userId: string): Promise<User[]> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ["contacts"],
    });

    if (!user || !user.contacts) {
      return [];
    }

    // Get all email addresses and phone numbers from contacts
    const contactEmails = user.contacts
      .map((contact) => contact.email)
      .filter((email): email is string => !!email);

    const contactPhones = user.contacts
      .map((contact) => contact.phone)
      .filter((phone): phone is string => !!phone)
      .map((phone) => phone.replace(/\D/g, "")); // Remove non-digits for matching

    if (contactEmails.length === 0 && contactPhones.length === 0) {
      return [];
    }

    // Find users with matching emails or phones who aren't already friends
    const existingFriendships = await this.friendshipRepository.find({
      where: [{ requesterId: userId }, { addresseeId: userId }],
    });

    const existingFriendIds = new Set(
      existingFriendships.map((f) => (f.requesterId === userId ? f.addresseeId : f.requesterId))
    );

    // Find users by email
    const usersByEmail = await this.userRepository.find({
      where: {
        email: In(contactEmails),
        id: Not(In([...existingFriendIds, userId])),
      },
    });

    // Find users by phone (if we had a phone field in the User entity)
    // const usersByPhone = await this.userRepository.find({
    //   where: {
    //     phone: In(contactPhones),
    //     id: Not(In([...existingFriendIds, userId])),
    //   },
    // });

    // Combine and deduplicate results
    const allUsers = [...usersByEmail];
    // const allUsers = [...usersByEmail, ...usersByPhone];
    const uniqueUsers = Array.from(new Map(allUsers.map((user) => [user.id, user])).values());

    return uniqueUsers;
  }

  /**
   * Find user by friend code
   */
  async findUserByFriendCode(friendCode: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { friendCode },
    });
  }

  /**
   * Find user by username
   */
  async findUserByUsername(username: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { username },
    });
  }

  /**
   * Generate a unique friend code for a user
   */
  async generateFriendCode(userId: string): Promise<string> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error("User not found");
    }

    // Generate a random 6-character code
    const generateCode = () => {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let code = "";
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };

    // Keep generating until we find a unique code
    let friendCode = generateCode();
    let isUnique = false;
    while (!isUnique) {
      const existingUser = await this.userRepository.findOne({ where: { friendCode } });
      if (!existingUser) {
        isUnique = true;
      } else {
        friendCode = generateCode();
      }
    }

    // Save the friend code to the user
    user.friendCode = friendCode;
    await this.userRepository.save(user);

    return friendCode;
  }

  /**
   * Send a friend request to another user by friend code
   */
  async sendFriendRequestByCode(requesterId: string, friendCode: string): Promise<Friendship> {
    const addressee = await this.findUserByFriendCode(friendCode);
    if (!addressee) {
      throw new Error("User not found with this friend code");
    }
    return this.sendFriendRequest(requesterId, addressee.id);
  }

  /**
   * Send a friend request to another user by username
   */
  async sendFriendRequestByUsername(requesterId: string, username: string): Promise<Friendship> {
    const addressee = await this.findUserByUsername(username);
    if (!addressee) {
      throw new Error("User not found with this username");
    }
    return this.sendFriendRequest(requesterId, addressee.id);
  }
}
