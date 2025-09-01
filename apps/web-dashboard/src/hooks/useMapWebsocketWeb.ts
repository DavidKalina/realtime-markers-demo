// hooks/useMapWebsocket.ts
import {
  useMapWebSocket as useMapWebSocketShared,
  UseMapWebSocketConfig,
} from "@realtime-markers/shared";
import { eventBroker, EventTypes } from "@/services/EventBroker";
import { useLocationStore } from "@/stores/useLocationStoreWeb";
import { useAuth } from "@/contexts/AuthContext";

export const useMapWebSocket = (url: string) => {
  const { user, isAuthenticated } = useAuth();

  const config: UseMapWebSocketConfig = {
    clientType: "dashboard",
    useLocationStore,
    eventBroker,
    EventTypes,
    useAuth: () => ({ user, isAuthenticated }),
  };

  return useMapWebSocketShared(url, config);
};
