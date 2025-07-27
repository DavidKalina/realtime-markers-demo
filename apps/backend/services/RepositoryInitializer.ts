import { DataSource, Repository } from "typeorm";
import {
  Category,
  Event,
  User,
  UserEventSave,
  UserEventDiscovery,
  UserEventRsvp,
  EventShare,
  Filter,
  CivicEngagement,
} from "@realtime-markers/database";
import { ensureDatabaseReadyForServices } from "../utils/databaseInitializer";

export interface RepositoryContainer {
  categoryRepository: Repository<Category>;
  eventRepository: Repository<Event>;
  userRepository: Repository<User>;
  userEventSaveRepository: Repository<UserEventSave>;
  userEventDiscoveryRepository: Repository<UserEventDiscovery>;
  userEventRsvpRepository: Repository<UserEventRsvp>;
  eventShareRepository: Repository<EventShare>;
  filterRepository: Repository<Filter>;
  civicEngagementRepository: Repository<CivicEngagement>;
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
        filterRepository: this.dataSource.getRepository(Filter),
        civicEngagementRepository:
          this.dataSource.getRepository(CivicEngagement),
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
