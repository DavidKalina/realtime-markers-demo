"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";

interface Toast {
  id: string;
  type: "success" | "error" | "info";
  title: string;
  description?: string;
}

interface ToastContextType {
  toasts: Toast[];
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
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

  return (
    <ToastContext.Provider
      value={{
        toasts,
        success,
        error,
        info,
        removeToast,
      }}
    >
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

// Export convenience functions that work with the context
export const toast = {
  success: (message: string) => {
    // This will be called from components that have access to the context
    console.warn(
      "toast.success() called outside of component context. Use useToast() hook instead.",
    );
  },
  error: (message: string) => {
    console.warn(
      "toast.error() called outside of component context. Use useToast() hook instead.",
    );
  },
  info: (message: string) => {
    console.warn(
      "toast.info() called outside of component context. Use useToast() hook instead.",
    );
  },
};
