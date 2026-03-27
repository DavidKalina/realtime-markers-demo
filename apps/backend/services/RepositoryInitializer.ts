import { DataSource, Repository } from "typeorm";
import { User } from "@realtime-markers/database";
import { ensureDatabaseReadyForServices } from "../utils/databaseInitializer";

export interface RepositoryContainer {
  userRepository: Repository<User>;
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
        userRepository: this.dataSource.getRepository(User),
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
