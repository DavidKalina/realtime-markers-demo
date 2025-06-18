import React, { useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { eventBroker, EventTypes, BaseEvent } from "@/services/EventBroker";

interface ConnectionIndicatorProps {
  className?: string;
}

const ConnectionIndicator: React.FC<ConnectionIndicatorProps> = ({
  className = "",
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    const handleConnected = (event: BaseEvent) => {
      setIsConnected(true);
      setIsConnecting(false);
    };

    const handleDisconnected = (event: BaseEvent) => {
      setIsConnected(false);
      setIsConnecting(false);
    };

    const unsubscribeConnected = eventBroker.on(
      EventTypes.WEBSOCKET_CONNECTED,
      handleConnected,
    );
    const unsubscribeDisconnected = eventBroker.on(
      EventTypes.WEBSOCKET_DISCONNECTED,
      handleDisconnected,
    );

    return () => {
      unsubscribeConnected();
      unsubscribeDisconnected();
    };
  }, []);

  const getConnectionStatus = () => {
    if (isConnecting) {
      return {
        text: "Connecting...",
        color: "text-yellow-400",
        bgColor: "bg-yellow-400/20",
        borderColor: "border-yellow-400/30",
        icon: Wifi,
      };
    }

    if (isConnected) {
      return {
        text: "Connected",
        color: "text-green-400",
        bgColor: "bg-green-400/20",
        borderColor: "border-green-400/30",
        icon: Wifi,
      };
    }

    return {
      text: "Disconnected",
      color: "text-red-400",
      bgColor: "bg-red-400/20",
      borderColor: "border-red-400/30",
      icon: WifiOff,
    };
  };

  const status = getConnectionStatus();
  const Icon = status.icon;

  const getTextColor = () => {
    if (isConnected) {
      return "text-green-400";
    }
    return "text-white";
  };

  const textColor = getTextColor();

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border shadow-lg backdrop-blur-sm ${className}`}
      style={{
        backgroundColor: "rgba(51, 51, 51, 0.95)",
        backdropFilter: "blur(8px)",
        borderColor: "rgba(255, 255, 255, 0.2)",
      }}
    >
      <Icon size={16} className={textColor} />
      <span className={`text-sm font-mono font-semibold ${textColor}`}>
        {status.text}
      </span>
    </div>
  );
};

export default ConnectionIndicator;
