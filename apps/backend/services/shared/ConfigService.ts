// services/shared/ConfigService.ts

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

export interface ConfigServiceDependencies {
  // No external dependencies needed for now
}

/**
 * Service for managing application configuration
 * Loads from environment variables and config files
 */
export class ConfigService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private config: Record<string, any> = {};

  constructor(private dependencies: ConfigServiceDependencies) {
    // Load environment variables
    dotenv.config();

    // Load from services configuration files
    this.loadConfigFiles();

    // Set default values
    this.setDefaults();
  }

  /**
   * Get configuration value by key
   * Supports dot notation for nested values
   * @param key Configuration key in dot notation
   * @param defaultValue Optional default value if key not found
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public get(key: string, defaultValue?: any): any {
    const parts = key.split(".");
    let current = this.config;

    for (const part of parts) {
      if (current === undefined || current === null) {
        return defaultValue;
      }
      current = current[part];
    }

    return current !== undefined ? current : defaultValue;
  }

  /**
   * Set configuration value
   * @param key Configuration key
   * @param value Value to set
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public set(key: string, value: any): void {
    const parts = key.split(".");
    let current = this.config;

    // Navigate to the right level in the object
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part] || typeof current[part] !== "object") {
        current[part] = {};
      }
      current = current[part];
    }

    // Set the value at the deepest level
    current[parts[parts.length - 1]] = value;
  }

  /**
   * Load configuration from JSON files in the config directory
   */
  private loadConfigFiles(): void {
    const configDir = path.resolve(process.cwd(), "config");

    try {
      if (fs.existsSync(configDir)) {
        const files = fs
          .readdirSync(configDir)
          .filter(
            (file) =>
              file.endsWith(".json") ||
              file.endsWith(".js") ||
              file.endsWith(".ts"),
          );

        for (const file of files) {
          try {
            const configName = path.basename(file).split(".")[0];
            const configPath = path.join(configDir, file);

            // For JS/TS files, require them
            if (file.endsWith(".js") || file.endsWith(".ts")) {
              // eslint-disable-next-line @typescript-eslint/no-var-requires
              const fileConfig = require(configPath);
              this.config[configName] = fileConfig;
            }
            // For JSON files, parse them
            else if (file.endsWith(".json")) {
              const fileContent = fs.readFileSync(configPath, "utf8");
              const fileConfig = JSON.parse(fileContent);
              this.config[configName] = fileConfig;
            }
          } catch (err) {
            console.error(`Error loading config file ${file}:`, err);
          }
        }
      }
    } catch (err) {
      console.error("Error reading config directory:", err);
    }

    // Load environment-specific config if exists
    const env = process.env.NODE_ENV || "development";
    const envConfigPath = path.join(configDir, `${env}.json`);

    if (fs.existsSync(envConfigPath)) {
      try {
        const envConfig = JSON.parse(fs.readFileSync(envConfigPath, "utf8"));
        this.mergeDeep(this.config, envConfig);
      } catch (err) {
        console.error(
          `Error loading environment config file ${env}.json:`,
          err,
        );
      }
    }
  }

  /**
   * Set default configuration values
   */
  private setDefaults(): void {
    // Set service-specific defaults
    // Event Processing
    this.setIfNotExists("eventProcessing.similarityThreshold", 0.72);
    this.setIfNotExists("eventProcessing.locationThreshold", 0.65);
    this.setIfNotExists("eventProcessing.confidenceThreshold", 0.75);

    // OpenAI
    this.setIfNotExists("openai.embeddingModel", "text-embedding-3-small");
    this.setIfNotExists("openai.visionModel", "gpt-4o");

    // Cache
    this.setIfNotExists("cache.ttl", 86400); // 24 hours
    this.setIfNotExists("cache.embeddingCacheSize", 3000);
    this.setIfNotExists("cache.visionCacheSize", 200);

    // Location
    this.setIfNotExists("location.cacheExpiry", 604800000); // 7 days

    // Misc application settings
    this.setIfNotExists("app.debug", process.env.DEBUG === "true");
  }

  /**
   * Set configuration value only if it doesn't already exist
   * @param key Configuration key
   * @param value Default value
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private setIfNotExists(key: string, value: any): void {
    if (this.get(key) === undefined) {
      this.set(key, value);
    }
  }

  /**
   * Deep merge objects for configuration
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mergeDeep(target: any, source: any): any {
    for (const key in source) {
      if (
        source[key] &&
        typeof source[key] === "object" &&
        !Array.isArray(source[key])
      ) {
        if (!target[key]) target[key] = {};
        this.mergeDeep(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
    return target;
  }
}

export function createConfigService(
  dependencies: ConfigServiceDependencies = {},
): ConfigService {
  return new ConfigService(dependencies);
}
