import { DataSource, Repository } from "typeorm";
import { Category } from "../entities/Category";
import { Event } from "../entities/Event";
import { User } from "../entities/User";
import { UserEventSave } from "../entities/UserEventSave";
import { UserEventDiscovery } from "../entities/UserEventDiscovery";
import { UserEventRsvp } from "../entities/UserEventRsvp";
import { EventShare } from "../entities/EventShare";
import { Notification } from "../entities/Notification";
import { Filter } from "../entities/Filter";
import { Friendship } from "../entities/Friendship";
import { ensureDatabaseReadyForServices } from "../utils/databaseInitializer";

export interface RepositoryContainer {
  categoryRepository: Repository<Category>;
  eventRepository: Repository<Event>;
  userRepository: Repository<User>;
  userEventSaveRepository: Repository<UserEventSave>;
  userEventDiscoveryRepository: Repository<UserEventDiscovery>;
  userEventRsvpRepository: Repository<UserEventRsvp>;
  eventShareRepository: Repository<EventShare>;
  notificationRepository: Repository<Notification>;
  filterRepository: Repository<Filter>;
  friendshipRepository: Repository<Friendship>;
}

export class RepositoryInitializer {
  private dataSource: DataSource;
  private repositories: RepositoryContainer | null = null;

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
  }

  async initialize(): Promise<RepositoryContainer> {
    console.log("Initializing repositories...");

    // Ensure DataSource is initialized
    if (!this.dataSource.isInitialized) {
      throw new Error(
        "DataSource must be initialized before creating repositories",
      );
    }

    // Ensure database is fully ready (migrations run, tables exist)
    await ensureDatabaseReadyForServices(this.dataSource);

    // Create repositories only once
    if (!this.repositories) {
      this.repositories = {
        categoryRepository: this.dataSource.getRepository(Category),
        eventRepository: this.dataSource.getRepository(Event),
        userRepository: this.dataSource.getRepository(User),
        userEventSaveRepository: this.dataSource.getRepository(UserEventSave),
        userEventDiscoveryRepository:
          this.dataSource.getRepository(UserEventDiscovery),
        userEventRsvpRepository: this.dataSource.getRepository(UserEventRsvp),
        eventShareRepository: this.dataSource.getRepository(EventShare),
        notificationRepository: this.dataSource.getRepository(Notification),
        filterRepository: this.dataSource.getRepository(Filter),
        friendshipRepository: this.dataSource.getRepository(Friendship),
      };
    }

    console.log("Repositories initialized successfully");
    return this.repositories;
  }

  // Method to check if repositories are ready
  isReady(): boolean {
    return this.repositories !== null && this.dataSource.isInitialized;
  }
}
