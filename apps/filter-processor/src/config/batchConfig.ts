export interface BatchUpdateConfig {
  batchIntervalMs: number; // Default: 15 minutes
  maxBatchSize: number; // Maximum events to process in one batch
  enableBatching: boolean; // Feature flag to enable/disable batching
}

export const defaultBatchConfig: BatchUpdateConfig = {
  batchIntervalMs: 15 * 60 * 1000, // 15 minutes
  maxBatchSize: 1000,
  enableBatching: true,
};

export function getBatchConfig(): BatchUpdateConfig {
  return {
    batchIntervalMs: parseInt(process.env.BATCH_INTERVAL_MS || "900000"), // 15 minutes default
    maxBatchSize: parseInt(process.env.MAX_BATCH_SIZE || "1000"),
    enableBatching: process.env.ENABLE_BATCHING !== "false", // true by default
  };
}
