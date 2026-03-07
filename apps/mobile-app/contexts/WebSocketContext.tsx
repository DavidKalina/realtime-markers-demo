import React, { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { webSocketService } from "@/services/WebSocketService";

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      const url = process.env.EXPO_PUBLIC_WEB_SOCKET_URL;
      if (url) {
        webSocketService.connect(url, user.id);
      }
    } else {
      webSocketService.disconnect();
    }

    return () => {
      webSocketService.disconnect();
    };
  }, [isAuthenticated, user?.id]);

  return <>{children}</>;
}
