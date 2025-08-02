/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Hardcoded mapping of entity names to table names
 * This is a temporary fix until we resolve the reflection metadata issue
 */
const ENTITY_TO_TABLE_MAPPING: Record<string, string> = {
  User: "users",
  Event: "events",
  Category: "categories",
  Filter: "filters",
  QueryAnalytics: "query_analytics",
  UserEventView: "user_event_views",
  UserEventDiscovery: "user_event_discoveries",
  UserEventRsvp: "user_event_rsvps",
  UserEventSave: "user_event_saves",
  CivicEngagement: "civic_engagements",
  UserPushToken: "user_push_tokens",
};

/**
 * Get table names from DataSource entities
 * This is the most reliable method as it uses the actual DataSource configuration
 */
export function getTableNamesFromDataSource(dataSource: any): string[] {
  if (!dataSource || !dataSource.options || !dataSource.options.entities) {
    console.warn("DataSource not properly configured or entities not found");
    return [];
  }

  const tableNames: string[] = [];

  // Handle the MixedList type properly
  const entities = dataSource.options.entities as Array<
    string | (new () => object)
  >;

  for (const entity of entities) {
    if (typeof entity === "function") {
      // First try the hardcoded mapping
      const entityName = entity.name;
      if (entityName && ENTITY_TO_TABLE_MAPPING[entityName]) {
        tableNames.push(ENTITY_TO_TABLE_MAPPING[entityName]);
        continue;
      }

      // Try to get table name from entity metadata using reflection
      const tableName = Reflect.getMetadata("table:name", entity);
      if (tableName) {
        tableNames.push(tableName);
      } else {
        // If reflection fails, try to get from the entity's prototype
        const prototype = entity.prototype;
        if (prototype && prototype.constructor) {
          const prototypeTableName = Reflect.getMetadata(
            "table:name",
            prototype.constructor,
          );
          if (prototypeTableName) {
            tableNames.push(prototypeTableName);
          } else {
            // Last resort: use entity name + "s"
            const entityName = entity.name?.toLowerCase();
            if (entityName) {
              tableNames.push(entityName + "s");
            }
          }
        } else {
          // Last resort: use entity name + "s"
          const entityName = entity.name?.toLowerCase();
          if (entityName) {
            tableNames.push(entityName + "s");
          }
        }
      }
    }
  }

  console.log(`Found ${tableNames.length} tables from DataSource:`, tableNames);
  return tableNames;
}

/**
 * Get all required table names including system tables
 */
export function getAllRequiredTableNames(dataSource: any): string[] {
  const entityTableNames = getTableNamesFromDataSource(dataSource);

  // Add system tables that are always required
  const systemTables = ["migrations"];

  const allTables = [...entityTableNames, ...systemTables];

  // Remove duplicates
  const uniqueTables = [...new Set(allTables)];

  console.log(`Total required tables: ${uniqueTables.length}`, uniqueTables);
  return uniqueTables;
}
