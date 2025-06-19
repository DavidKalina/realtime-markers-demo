import { useState, useCallback } from "react";

interface Toast {
  id: string;
  type: "success" | "error" | "info";
  title: string;
  description?: string;
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast = { ...toast, id };

    setToasts((prev) => [...prev, newToast]);

    // Auto remove after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const success = useCallback(
    (message: string) => {
      addToast({
        type: "success",
        title: "Success",
        description: message,
      });
    },
    [addToast],
  );

  const error = useCallback(
    (message: string) => {
      addToast({
        type: "error",
        title: "Error",
        description: message,
      });
    },
    [addToast],
  );

  const info = useCallback(
    (message: string) => {
      addToast({
        type: "info",
        title: "Info",
        description: message,
      });
    },
    [addToast],
  );

  return {
    toasts,
    success,
    error,
    info,
    removeToast,
  };
}

// Create a global toast instance
let globalToast: ReturnType<typeof useToast> | null = null;

export function getGlobalToast() {
  if (!globalToast) {
    globalToast = useToast();
  }
  return globalToast;
}

// Export convenience functions
export const toast = {
  success: (message: string) => getGlobalToast().success(message),
  error: (message: string) => getGlobalToast().error(message),
  info: (message: string) => getGlobalToast().info(message),
};
