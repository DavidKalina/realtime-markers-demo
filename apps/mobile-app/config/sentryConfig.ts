import { isRunningInExpoGo } from "expo";

export const SENTRY_CONFIG = {
  dsn: "https://9c69ddf62f2bf7490416ba65f2d5dd2d@o4509054186815488.ingest.us.sentry.io/4509054187798528",
  debug: false,
  tracesSampleRate: 0.1,
  enableNativeFramesTracking: !isRunningInExpoGo(),
  sendDefaultPii: true,
} as const;
