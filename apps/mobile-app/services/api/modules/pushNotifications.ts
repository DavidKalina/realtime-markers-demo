// Types-only module — methods moved to ApiClient

export interface DeviceInfo {
  platform: "ios" | "android" | "web";
  version?: string;
  model?: string;
  osVersion?: string;
  appVersion?: string;
  [key: string]: unknown;
}

export interface PushToken {
  id: string;
  token: string;
  deviceInfo: DeviceInfo | null;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}
